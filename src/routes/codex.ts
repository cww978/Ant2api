import { Router, Response } from 'express';
import crypto from 'crypto';
import { apiKeyAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AccountPoolService } from '../services/account-pool.js';
import { KeyManagerService } from '../services/key-manager.js';
import { ModelRouterService } from '../services/model-router.js';
import { StatsLoggerService } from '../services/stats-logger.js';
import { CodexConverter, CodexCompletionRequest, CodexEditRequest } from '../converters/codex.js';
import { SseStreamHandler } from '../converters/stream-sse.js';
import { ThoughtSignatureCache } from '../services/thought-signature-cache.js';
import { PatchPreflightService } from '../services/patch-preflight.js';

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

function extractPatchFromText(text: string): string | null {
  if (!text || !text.includes('*** Begin Patch')) return null;
  const match = text.match(/\*\*\* Begin Patch[\s\S]*?(?:\*\*\* End Patch|```|$)/);
  if (match) {
    let patch = match[0].trim();
    if (patch.endsWith('```')) {
      patch = patch.slice(0, -3).trim();
    }
    if (!patch.endsWith('*** End Patch') && !patch.includes('*** End Patch')) {
      patch = `${patch}\n*** End Patch`;
    }
    return patch;
  }
  return null;
}

// POST /v1/responses (Codex Next-Gen Agent Responses API)
router.post('/responses', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const randomSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 24);
  const reqId = `resp-${randomSuffix}`;
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
        SseStreamHandler.initSseResponse(res);
        SseStreamHandler.startCodexResponsesStream(res, reqId, originalModel);

        let heartbeatTimer: NodeJS.Timeout | null = setInterval(() => {
          try {
            SseStreamHandler.writeHeartbeat(res);
          } catch {}
        }, 15000);

        let fullText = '';
        let accumulatedThinking = '';
        let reasoningOpen = false;
        let reasoningIndex = 0;
        let reasoningSeq = 0;
        let activeReasoningId = '';

        let messageItemStarted = false;
        let messageItemClosed = false;
        let messageIndex = 0;
        const messageId = `msg_${randomSuffix.substring(0, 16)}_0`;

        let nextOutputIndex = 0;
        let promptTokens = 0;
        let completionTokens = 0;
        let finishReason: string | null = null;

        const finalOutputItems: any[] = [];
        const seenFunctionCalls = new Set<string>();
        let hasSeenToolCalls = false;

        const cleanUpHeartbeat = () => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        };

        try {
          const geminiRes = await provider.streamGenerate(geminiReq, (chunk) => {
            const candidate = chunk.candidates?.[0];
            if (candidate?.finishReason) {
              finishReason = candidate.finishReason;
            }

            const parts = candidate?.content?.parts || [];
            for (const part of parts) {
              const isThought = Boolean((part as any).thought);

              // 1. Close reasoning commentary before starting normal text or tool calls
              const isTextOrTool = Boolean(part.text || part.functionCall);
              if (isTextOrTool && !isThought && reasoningOpen) {
                SseStreamHandler.closeCodexThinkingItem(res, activeReasoningId, accumulatedThinking, reasoningIndex);
                finalOutputItems.push({
                  id: activeReasoningId,
                  type: 'message',
                  role: 'assistant',
                  phase: 'commentary',
                  status: 'completed',
                  content: [{ type: 'output_text', text: accumulatedThinking, annotations: [] }]
                });
                reasoningOpen = false;
              }

              // 2. Handle Text (Thinking vs Assistant Output)
              if (part.text) {
                const cleanText = part.text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, '');

                if (isThought) {
                  if (!reasoningOpen) {
                    reasoningIndex = nextOutputIndex++;
                    activeReasoningId = `msg_thought_${randomSuffix.substring(0, 16)}_${reasoningSeq++}`;
                    accumulatedThinking = '';
                    SseStreamHandler.startCodexThinkingItem(res, activeReasoningId, reasoningIndex);
                    reasoningOpen = true;
                  }
                  accumulatedThinking += part.text;
                  SseStreamHandler.writeCodexThinkingDelta(res, activeReasoningId, part.text, reasoningIndex);
                } else if (cleanText) {
                  if (!messageItemStarted) {
                    messageIndex = nextOutputIndex++;
                    SseStreamHandler.startCodexMessageItem(res, messageId, messageIndex, 'commentary');
                    messageItemStarted = true;
                  }
                  fullText += cleanText;
                  SseStreamHandler.writeCodexResponsesDelta(res, messageId, cleanText, messageIndex);
                }
              }

              // 3. Handle Tool Calls (apply_patch, shell, or standard functions)
              if (part.functionCall) {
                const fcKey = `${part.functionCall.name}_${JSON.stringify(part.functionCall.args || {})}`;
                if (!seenFunctionCalls.has(fcKey)) {
                  seenFunctionCalls.add(fcKey);
                  hasSeenToolCalls = true;

                  // If text message was in progress, close it before opening the tool call item
                  if (messageItemStarted && !messageItemClosed) {
                    SseStreamHandler.closeCodexMessageItem(res, messageId, fullText, messageIndex, 'commentary');
                    messageItemClosed = true;
                    finalOutputItems.push({
                      id: messageId,
                      type: 'message',
                      role: 'assistant',
                      phase: 'commentary',
                      status: 'completed',
                      content: [{ type: 'output_text', text: fullText, annotations: [] }]
                    });
                  }

                  let funcName = part.functionCall.name || 'unknown_tool';
                  if (funcName === 'local_shell_call') funcName = 'shell';
                  if (funcName === 'apply_patch_call') funcName = 'apply_patch';

                  let rawArgs = part.functionCall.args || {};
                  let callId = `call_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
                  let toolItemId = `item-${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

                  const sig = (part as any).thought_signature || (part as any).thoughtSignature || (part.functionCall as any)?.thought_signature || (part.functionCall as any)?.thoughtSignature;
                  if (sig) {
                    ThoughtSignatureCache.save(callId, funcName, sig);
                  }

                  const isCustomTool = funcName === 'apply_patch' || funcName === 'apply_patch_v2' || funcName === 'shell';
                  const toolOutputIndex = nextOutputIndex++;

                  if (isCustomTool && (funcName === 'apply_patch' || funcName === 'apply_patch_v2')) {
                    // Extract & Preflight optimize patch
                    const extractedPatch = PatchPreflightService.extractPatchInput(rawArgs);
                    const { patch: optimizedPatch } = PatchPreflightService.optimizePatch(extractedPatch);

                    SseStreamHandler.writeCodexCustomToolCall(
                      res,
                      callId,
                      toolItemId,
                      toolOutputIndex,
                      funcName,
                      optimizedPatch
                    );

                    finalOutputItems.push({
                      id: toolItemId,
                      type: 'custom_tool_call',
                      status: 'completed',
                      name: funcName,
                      call_id: callId,
                      input: optimizedPatch
                    });
                  } else if (isCustomTool && funcName === 'shell') {
                    const normalized = typeof rawArgs === 'string' ? rawArgs : (rawArgs.command || JSON.stringify(rawArgs));
                    SseStreamHandler.writeCodexCustomToolCall(
                      res,
                      callId,
                      toolItemId,
                      toolOutputIndex,
                      funcName,
                      normalized
                    );

                    finalOutputItems.push({
                      id: toolItemId,
                      type: 'custom_tool_call',
                      status: 'completed',
                      name: funcName,
                      call_id: callId,
                      input: normalized
                    });
                  } else {
                    // Standard function call
                    const argsStr = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs);
                    SseStreamHandler.writeCodexFunctionCall(
                      res,
                      callId,
                      toolItemId,
                      toolOutputIndex,
                      funcName,
                      argsStr
                    );

                    finalOutputItems.push({
                      id: toolItemId,
                      type: 'function_call',
                      status: 'completed',
                      name: funcName,
                      call_id: callId,
                      arguments: argsStr
                    });
                  }
                }
              }
            }

            if (chunk.usageMetadata) {
              promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
              completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
            }
          });

          if (geminiRes.usageMetadata) {
            promptTokens = geminiRes.usageMetadata.promptTokenCount || promptTokens;
            completionTokens = geminiRes.usageMetadata.candidatesTokenCount || completionTokens;
          }
        } finally {
          cleanUpHeartbeat();
        }

        // Close thinking if still open at the end
        if (reasoningOpen) {
          SseStreamHandler.closeCodexThinkingItem(res, activeReasoningId, accumulatedThinking, reasoningIndex);
          finalOutputItems.push({
            id: activeReasoningId,
            type: 'message',
            role: 'assistant',
            phase: 'commentary',
            status: 'completed',
            content: [{ type: 'output_text', text: accumulatedThinking, annotations: [] }]
          });
          reasoningOpen = false;
        }

        // Safety Net Fallback: If model outputted a patch in text without tool call, convert to apply_patch custom_tool_call
        if (!hasSeenToolCalls && fullText.includes('*** Begin Patch')) {
          const fallbackPatch = extractPatchFromText(fullText);
          if (fallbackPatch) {
            const { patch: optimizedPatch } = PatchPreflightService.optimizePatch(fallbackPatch);
            const callId = `call_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
            const toolItemId = `item-${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
            const toolOutputIndex = nextOutputIndex++;

            if (messageItemStarted && !messageItemClosed) {
              SseStreamHandler.closeCodexMessageItem(res, messageId, fullText, messageIndex, 'commentary');
              messageItemClosed = true;
              finalOutputItems.push({
                id: messageId,
                type: 'message',
                role: 'assistant',
                phase: 'commentary',
                status: 'completed',
                content: [{ type: 'output_text', text: fullText, annotations: [] }]
              });
            }

            SseStreamHandler.writeCodexCustomToolCall(
              res,
              callId,
              toolItemId,
              toolOutputIndex,
              'apply_patch',
              optimizedPatch
            );

            finalOutputItems.push({
              id: toolItemId,
              type: 'custom_tool_call',
              status: 'completed',
              name: 'apply_patch',
              call_id: callId,
              input: optimizedPatch
            });
            hasSeenToolCalls = true;
          }
        }

        // Close text message if still open
        if (messageItemStarted && !messageItemClosed) {
          const phase = hasSeenToolCalls ? 'commentary' : 'final_answer';
          SseStreamHandler.closeCodexMessageItem(res, messageId, fullText, messageIndex, phase);
          finalOutputItems.push({
            id: messageId,
            type: 'message',
            role: 'assistant',
            phase,
            status: 'completed',
            content: [{ type: 'output_text', text: fullText, annotations: [] }]
          });
          messageItemClosed = true;
        }

        const totalTokens = (promptTokens || 20) + (completionTokens || Math.ceil(fullText.length / 4));
        SseStreamHandler.endCodexResponsesStream(
          res,
          reqId,
          originalModel,
          finalOutputItems,
          promptTokens,
          completionTokens,
          finishReason
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
        // Non-streaming /v1/responses
        const geminiRes = await provider.generate(geminiReq);
        const candidateParts = geminiRes.candidates?.[0]?.content?.parts || [];
        let text = '';
        const outputItems: any[] = [];
        let hasToolCalls = false;

        for (const part of candidateParts) {
          if (part.text && !(part as any).thought) {
            text += part.text;
          }
          if (part.functionCall) {
            hasToolCalls = true;
            let funcName = part.functionCall.name || 'unknown_tool';
            if (funcName === 'local_shell_call') funcName = 'shell';
            if (funcName === 'apply_patch_call') funcName = 'apply_patch';

            const callId = `call_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
            const isCustomTool = funcName === 'apply_patch' || funcName === 'apply_patch_v2' || funcName === 'shell';

            if (isCustomTool && (funcName === 'apply_patch' || funcName === 'apply_patch_v2')) {
              const rawPatch = PatchPreflightService.extractPatchInput(part.functionCall.args);
              const { patch: optimizedPatch } = PatchPreflightService.optimizePatch(rawPatch);
              outputItems.push({
                id: callId,
                type: 'custom_tool_call',
                name: funcName,
                call_id: callId,
                input: optimizedPatch
              });
            } else if (isCustomTool && funcName === 'shell') {
              const inputCmd = typeof part.functionCall.args === 'string'
                ? part.functionCall.args
                : (part.functionCall.args?.command || JSON.stringify(part.functionCall.args || {}));
              outputItems.push({
                id: callId,
                type: 'custom_tool_call',
                name: funcName,
                call_id: callId,
                input: inputCmd
              });
            } else {
              outputItems.push({
                id: callId,
                type: 'function_call',
                name: funcName,
                call_id: callId,
                arguments: typeof part.functionCall.args === 'string'
                  ? part.functionCall.args
                  : JSON.stringify(part.functionCall.args || {})
              });
            }
          }
        }

        // Safety Net Fallback for non-streaming
        if (!hasToolCalls && text.includes('*** Begin Patch')) {
          const fallbackPatch = extractPatchFromText(text);
          if (fallbackPatch) {
            const { patch: optimizedPatch } = PatchPreflightService.optimizePatch(fallbackPatch);
            const callId = `call_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
            outputItems.push({
              id: callId,
              type: 'custom_tool_call',
              name: 'apply_patch',
              call_id: callId,
              input: optimizedPatch
            });
            hasToolCalls = true;
          }
        }

        if (text || outputItems.length === 0) {
          const phase = hasToolCalls ? 'commentary' : 'final_answer';
          outputItems.unshift({
            id: `item_${reqId}`,
            type: 'message',
            status: 'completed',
            role: 'assistant',
            phase,
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

        const promptTok = geminiRes.usageMetadata?.promptTokenCount || 0;
        const compTok = geminiRes.usageMetadata?.candidatesTokenCount || 0;
        const totalTok = geminiRes.usageMetadata?.totalTokenCount || promptTok + compTok;

        return res.json({
          id: reqId,
          object: 'response',
          created: Math.floor(Date.now() / 1000),
          model: originalModel,
          output: outputItems,
          usage: {
            input_tokens: promptTok,
            output_tokens: compTok,
            total_tokens: totalTok,
            prompt_tokens: promptTok,
            completion_tokens: compTok,
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
        SseStreamHandler.endCodexResponsesStream(
          res,
          reqId,
          originalModel,
          [],
          0,
          0,
          'ERROR'
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
