import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { apiKeyAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AccountPoolService } from '../services/account-pool.js';
import { KeyManagerService } from '../services/key-manager.js';
import { ModelRouterService } from '../services/model-router.js';
import { StatsLoggerService } from '../services/stats-logger.js';
import { CodexConverter, CodexCompletionRequest, CodexEditRequest } from '../converters/codex.js';
import { SseStreamHandler } from '../converters/stream-sse.js';

const router = Router();
const accountPool = AccountPoolService.getInstance();
const keyManager = KeyManagerService.getInstance();
const modelRouter = ModelRouterService.getInstance();
const statsLogger = StatsLoggerService.getInstance();

async function handleCompletionRequest(req: AuthenticatedRequest, res: Response, engineModel?: string) {
  const start = Date.now();
  const reqId = `cmpl-${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
  const body = req.body as CodexCompletionRequest;

  const requestedModel = engineModel || body.model || 'gemini-3.7-flash';
  const { mappedModel, originalModel } = modelRouter.resolveModel(requestedModel);
  const isStream = Boolean(body.stream);

  if (!body.prompt && !body.suffix) {
    return res.status(400).json({
      error: {
        message: 'Missing required parameter: prompt or suffix',
        type: 'invalid_request_error',
        code: 'missing_parameter'
      }
    });
  }

  const geminiReq = CodexConverter.requestToGemini(body, mappedModel);
  const maxAttempts = Math.min(accountPool.getEnabledAccountsCount(), 3);
  const triedIds: string[] = [];
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let selectedAccount: any = null;
    try {
      const { account, provider } = accountPool.getNextAccount(triedIds);
      selectedAccount = account;
      triedIds.push(account.id);

      if (isStream) {
        let isFirst = true;
        let outputTokens = 0;

        const fullResponse = await provider.streamGenerate(geminiReq, chunk => {
          if (isFirst) {
            SseStreamHandler.initSseResponse(res);
            isFirst = false;
          }
          SseStreamHandler.writeCodexChunk(res, reqId, originalModel, chunk);
        });

        if (isFirst) {
          SseStreamHandler.initSseResponse(res);
        }

        SseStreamHandler.endCodexStream(res, reqId, originalModel);

        const latencyMs = Date.now() - start;
        const totalTokens = fullResponse.usageMetadata?.totalTokenCount || outputTokens;

        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, totalTokens);
        }

        statsLogger.logRequest({
          protocol: 'codex',
          endpoint: '/v1/completions',
          model: originalModel,
          mappedModel,
          statusCode: 200,
          latencyMs,
          stream: true,
          inputTokens: fullResponse.usageMetadata?.promptTokenCount || 0,
          outputTokens: fullResponse.usageMetadata?.candidatesTokenCount || outputTokens,
          totalTokens,
          apiKeyName: req.apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp: req.ip
        });

        return;
      } else {
        // Non-streaming completion
        const geminiRes = await provider.generate(geminiReq);
        const codexRes = CodexConverter.geminiResponseToCodex(geminiRes, originalModel, reqId);
        const latencyMs = Date.now() - start;

        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, codexRes.usage.total_tokens);
        }

        statsLogger.logRequest({
          protocol: 'codex',
          endpoint: '/v1/completions',
          model: originalModel,
          mappedModel,
          statusCode: 200,
          latencyMs,
          stream: false,
          inputTokens: codexRes.usage.prompt_tokens,
          outputTokens: codexRes.usage.completion_tokens,
          totalTokens: codexRes.usage.total_tokens,
          apiKeyName: req.apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp: req.ip
        });

        return res.json(codexRes);
      }
    } catch (error: any) {
      lastError = error;
      if (selectedAccount) {
        accountPool.reportError(selectedAccount.id, error);
      }
      if (res.headersSent) {
        break;
      }
    }
  }

  // All attempts failed
  const latencyMs = Date.now() - start;
  statsLogger.logRequest({
    protocol: 'codex',
    endpoint: '/v1/completions',
    model: originalModel,
    mappedModel,
    statusCode: 500,
    latencyMs,
    stream: isStream,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    apiKeyName: req.apiKeyItem?.name,
    clientIp: req.ip,
    errorMessage: lastError?.message || 'All candidate accounts failed'
  });

  if (res.headersSent) {
    res.write(`data: ${JSON.stringify({ error: { message: lastError?.message || 'Upstream error' } })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  return res.status(500).json({
    error: {
      message: lastError?.message || 'Internal Codex upstream proxy error',
      type: 'api_error',
      code: 'upstream_error'
    }
  });
}

// POST /v1/completions (OpenAI & Codex Standard Text/Code Completion & FIM)
router.post('/completions', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  await handleCompletionRequest(req, res);
});

// POST /v1/engines/:engine/completions (Legacy Copilot / OpenAI Engines Endpoint)
router.post('/engines/:engine/completions', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  await handleCompletionRequest(req, res, req.params.engine);
});

// POST /v1/edits (OpenAI Code / Text Edits Compatibility)
router.post('/edits', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const reqId = `edit-${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
  const body = req.body as CodexEditRequest;

  const requestedModel = body.model || 'gemini-3.7-flash';
  const { mappedModel, originalModel } = modelRouter.resolveModel(requestedModel);

  if (!body.instruction) {
    return res.status(400).json({
      error: {
        message: 'Missing required parameter: instruction',
        type: 'invalid_request_error',
        code: 'missing_parameter'
      }
    });
  }

  const geminiReq = CodexConverter.editRequestToGemini(body, mappedModel);
  const maxAttempts = Math.min(accountPool.getEnabledAccountsCount(), 3);
  const triedIds: string[] = [];
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let selectedAccount: any = null;
    try {
      const { account, provider } = accountPool.getNextAccount(triedIds);
      selectedAccount = account;
      triedIds.push(account.id);

      const geminiRes = await provider.generate(geminiReq);
      const codexRes = CodexConverter.geminiResponseToCodex(geminiRes, originalModel, reqId);
      const latencyMs = Date.now() - start;

      accountPool.reportSuccess(account.id);
      if (req.apiKeyItem) {
        keyManager.recordUsage(req.apiKeyItem.id, codexRes.usage.total_tokens);
      }

      statsLogger.logRequest({
        protocol: 'codex',
        endpoint: '/v1/edits',
        model: originalModel,
        mappedModel,
        statusCode: 200,
        latencyMs,
        stream: false,
        inputTokens: codexRes.usage.prompt_tokens,
        outputTokens: codexRes.usage.completion_tokens,
        totalTokens: codexRes.usage.total_tokens,
        apiKeyName: req.apiKeyItem?.name,
        accountId: account.id,
        accountName: account.name,
        clientIp: req.ip
      });

      return res.json({
        object: 'edit',
        created: Math.floor(Date.now() / 1000),
        choices: [
          {
            text: codexRes.choices[0]?.text || '',
            index: 0
          }
        ],
        usage: codexRes.usage
      });
    } catch (error: any) {
      lastError = error;
      if (selectedAccount) {
        accountPool.reportError(selectedAccount.id, error);
      }
    }
  }

  return res.status(500).json({
    error: {
      message: lastError?.message || 'Internal Codex edits proxy error',
      type: 'api_error',
      code: 'upstream_error'
    }
  });
});

// POST /v1/responses (Codex Next-Gen Agent Responses API from Antigravity)
router.post('/responses', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const reqId = `resp-${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
  const body = req.body;
  const isStream = !!body.stream || req.headers.accept?.includes('text/event-stream');

  const requestedModel = body.model || 'gemini-3.7-flash';
  const { mappedModel, originalModel } = modelRouter.resolveModel(requestedModel);

  const geminiReq = CodexConverter.responsesRequestToGemini(body, mappedModel);
  const maxAttempts = Math.min(accountPool.getEnabledAccountsCount(), 3);
  const triedIds: string[] = [];
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let selectedAccount: any = null;
    try {
      const { account, provider } = accountPool.getNextAccount(triedIds);
      selectedAccount = account;
      triedIds.push(account.id);

      if (isStream) {
        let isFirst = true;
        let fullText = '';
        let promptTokens = 0;
        let completionTokens = 0;
        let messageItemStarted = false;
        const functionCalls: Array<{ id: string; name: string; args: any }> = [];
        const seenFunctionCalls = new Set<string>();
        let callIdx = 0;

        const geminiRes = await provider.streamGenerate(geminiReq, (chunk) => {
          if (isFirst) {
            SseStreamHandler.initSseResponse(res);
            SseStreamHandler.startCodexResponsesStream(res, reqId, originalModel);
            isFirst = false;
          }

          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              if (!messageItemStarted) {
                SseStreamHandler.startCodexMessageItem(res, reqId);
                messageItemStarted = true;
              }
              fullText += part.text;
              SseStreamHandler.writeCodexResponsesDelta(res, part.text);
            }
            if (part.functionCall) {
              const fcKey = `${part.functionCall.name}_${JSON.stringify(part.functionCall.args || {})}`;
              if (!seenFunctionCalls.has(fcKey)) {
                seenFunctionCalls.add(fcKey);
                const callId = `call_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
                functionCalls.push({
                  id: callId,
                  name: part.functionCall.name,
                  args: part.functionCall.args || {}
                });
                SseStreamHandler.writeCodexFunctionCall(
                  res,
                  callId,
                  messageItemStarted ? 1 + callIdx : callIdx,
                  part.functionCall.name,
                  part.functionCall.args || {}
                );
                callIdx++;
              }
            }
          }

          if (chunk.usageMetadata) {
            promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
            completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
          }
        });

        if (isFirst) {
          SseStreamHandler.initSseResponse(res);
          SseStreamHandler.startCodexResponsesStream(res, reqId, originalModel);
        }

        if (geminiRes.usageMetadata) {
          promptTokens = geminiRes.usageMetadata.promptTokenCount || promptTokens;
          completionTokens = geminiRes.usageMetadata.candidatesTokenCount || completionTokens;
        }

        const totalTokens = (promptTokens || 20) + (completionTokens || Math.ceil(fullText.length / 4));
        SseStreamHandler.endCodexResponsesStream(
          res,
          reqId,
          originalModel,
          fullText,
          functionCalls,
          promptTokens,
          completionTokens
        );

        const latencyMs = Date.now() - start;
        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, totalTokens);
        }

        statsLogger.logRequest({
          protocol: 'codex',
          endpoint: '/v1/responses',
          model: originalModel,
          mappedModel,
          statusCode: 200,
          latencyMs,
          stream: true,
          inputTokens: promptTokens,
          outputTokens: completionTokens,
          totalTokens,
          apiKeyName: req.apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp: req.ip
        });

        return;
      } else {
        const geminiRes = await provider.generate(geminiReq);
        const candidateParts = geminiRes.candidates?.[0]?.content?.parts || [];
        let text = '';
        const outputItems: any[] = [];

        for (const part of candidateParts) {
          if (part.text) text += part.text;
          if (part.functionCall) {
            const callId = `call_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
            outputItems.push({
              id: callId,
              type: 'function_call',
              name: part.functionCall.name,
              call_id: callId,
              arguments: typeof part.functionCall.args === 'string'
                ? part.functionCall.args
                : JSON.stringify(part.functionCall.args || {})
            });
          }
        }

        if (text || outputItems.length === 0) {
          outputItems.unshift({
            id: `item_${reqId}`,
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text }]
          });
        }

        const latencyMs = Date.now() - start;

        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, geminiRes.usageMetadata?.totalTokenCount || 50);
        }

        statsLogger.logRequest({
          protocol: 'codex',
          endpoint: '/v1/responses',
          model: originalModel,
          mappedModel,
          statusCode: 200,
          latencyMs,
          stream: false,
          inputTokens: geminiRes.usageMetadata?.promptTokenCount || 0,
          outputTokens: geminiRes.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: geminiRes.usageMetadata?.totalTokenCount || 0,
          apiKeyName: req.apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp: req.ip
        });

        return res.json({
          id: reqId,
          object: 'response',
          created: Math.floor(Date.now() / 1000),
          model: originalModel,
          output: outputItems,
          usage: {
            input_tokens: geminiRes.usageMetadata?.promptTokenCount || 0,
            output_tokens: geminiRes.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: geminiRes.usageMetadata?.totalTokenCount || 0,
            prompt_tokens: geminiRes.usageMetadata?.promptTokenCount || 0,
            completion_tokens: geminiRes.usageMetadata?.candidatesTokenCount || 0,
            input_token_details: {
              cached_tokens: 0
            },
            output_token_details: {
              reasoning_tokens: 0
            }
          }
        });
      }
    } catch (error: any) {
      lastError = error;
      if (selectedAccount) {
        accountPool.reportError(selectedAccount.id, error);
      }
      if (res.headersSent) {
        // If stream headers were already sent, gracefully complete the stream so client does not disconnect abruptly
        SseStreamHandler.endCodexResponsesStream(
          res,
          reqId,
          originalModel,
          `\n\n[Error: ${error?.message || 'Upstream error'}]`,
          [],
          0,
          0
        );
        return;
      }
    }
  }

  return res.status(500).json({
    error: {
      message: lastError?.message || 'Internal Codex responses proxy error',
      type: 'api_error',
      code: 'upstream_error'
    }
  });
});

export default router;
