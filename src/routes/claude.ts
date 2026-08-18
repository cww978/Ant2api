import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest, apiKeyAuth } from '../middleware/auth.js';
import { ModelRouterService } from '../services/model-router.js';
import { AccountPoolService } from '../services/account-pool.js';
import { KeyManagerService } from '../services/key-manager.js';
import { StatsLoggerService } from '../services/stats-logger.js';
import { ClaudeConverter, ClaudeMessagesRequest } from '../converters/claude-converter.js';
import { SseStreamHandler } from '../converters/stream-sse.js';

const router = Router();
const modelRouter = ModelRouterService.getInstance();
const accountPool = AccountPoolService.getInstance();
const keyManager = KeyManagerService.getInstance();
const statsLogger = StatsLoggerService.getInstance();

// POST /v1/messages
router.post('/messages', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const body = req.body as ClaudeMessagesRequest;
  const reqId = `msg_${crypto.randomUUID().replace(/-/g, '')}`;

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'Missing or invalid messages array' }
    });
  }

  const { mappedModel, originalModel } = modelRouter.resolveModel(body.model);
  const isStream = Boolean(body.stream);

  let selectedAccount: any = null;

  const geminiReq = ClaudeConverter.requestToGemini(body, mappedModel);
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
        let generatedText = '';

        const fullResponse = await provider.streamGenerate(geminiReq, chunk => {
          if (isFirst) {
            SseStreamHandler.initSseResponse(res);
            SseStreamHandler.startClaudeStream(res, reqId, originalModel, 10);
            isFirst = false;
          }
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            generatedText += text;
            SseStreamHandler.writeClaudeDelta(res, text);
          }
        });

        if (isFirst) {
          SseStreamHandler.initSseResponse(res);
          SseStreamHandler.startClaudeStream(res, reqId, originalModel, 10);
        }

        const outputTokens = fullResponse.usageMetadata?.candidatesTokenCount || Math.ceil(generatedText.length / 4);
        SseStreamHandler.endClaudeStream(res, outputTokens, 'end_turn');

        const latencyMs = Date.now() - start;
        const totalTokens = (fullResponse.usageMetadata?.promptTokenCount || 0) + outputTokens;

        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, totalTokens);
        }

        statsLogger.logRequest({
          protocol: 'claude',
          endpoint: '/v1/messages',
          model: originalModel,
          mappedModel,
          statusCode: 200,
          latencyMs,
          stream: true,
          inputTokens: fullResponse.usageMetadata?.promptTokenCount || 0,
          outputTokens,
          totalTokens,
          apiKeyName: req.apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp: req.ip
        });

        return;
      } else {
        // Non-streaming Claude response
        const geminiRes = await provider.generate(geminiReq);
        const claudeRes = ClaudeConverter.geminiResponseToClaude(geminiRes, originalModel, reqId);
        const latencyMs = Date.now() - start;
        const totalTokens = claudeRes.usage.input_tokens + claudeRes.usage.output_tokens;

        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, totalTokens);
        }

        statsLogger.logRequest({
          protocol: 'claude',
          endpoint: '/v1/messages',
          model: originalModel,
          mappedModel,
          statusCode: 200,
          latencyMs,
          stream: false,
          inputTokens: claudeRes.usage.input_tokens,
          outputTokens: claudeRes.usage.output_tokens,
          totalTokens,
          apiKeyName: req.apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp: req.ip
        });

        return res.json(claudeRes);
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

  // If all attempts failed
  const latencyMs = Date.now() - start;
  statsLogger.logRequest({
    protocol: 'claude',
    endpoint: '/v1/messages',
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
    errorMessage: lastError?.message || 'All accounts failed'
  });

  if (res.headersSent) {
    res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: { message: lastError?.message || 'Upstream error' } })}\n\n`);
    return res.end();
  }

  return res.status(500).json({
    type: 'error',
    error: {
      type: 'api_error',
      message: lastError?.message || 'Internal Claude upstream bridge error'
    }
  });
});

// GET /v1/models (For Claude clients)
router.get('/models', apiKeyAuth, (req: AuthenticatedRequest, res: Response) => {
  const models = modelRouter.getOpenAiModelsList();
  return res.json({
    data: models.map(m => ({
      id: m.id,
      type: 'model',
      display_name: m.id,
      created_at: '2024-01-01T00:00:00Z'
    }))
  });
});

export default router;
