import { Router, Response } from 'express';
import { AuthenticatedRequest, apiKeyAuth } from '../middleware/auth.js';
import { ModelRouterService } from '../services/model-router.js';
import { AccountPoolService } from '../services/account-pool.js';
import { KeyManagerService } from '../services/key-manager.js';
import { StatsLoggerService } from '../services/stats-logger.js';
import { GeminiConverter } from '../converters/gemini-converter.js';
import { SseStreamHandler } from '../converters/stream-sse.js';

const router = Router();
const modelRouter = ModelRouterService.getInstance();
const accountPool = AccountPoolService.getInstance();
const keyManager = KeyManagerService.getInstance();
const statsLogger = StatsLoggerService.getInstance();

// GET /v1beta/models
router.get('/models', apiKeyAuth, (req: AuthenticatedRequest, res: Response) => {
  const models = modelRouter.getOpenAiModelsList();
  return res.json({
    models: models.map(m => ({
      name: `models/${m.id}`,
      version: '001',
      displayName: m.id,
      description: `Gemini / Antigravity bridged model: ${m.id}`,
      inputTokenLimit: 1048576,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent', 'countTokens', 'streamGenerateContent']
    }))
  });
});

// POST /v1beta/models/:model:generateContent
router.post('/models/:model:generateContent', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const rawModel = req.params.model;
  const { mappedModel, originalModel } = modelRouter.resolveModel(rawModel);

  let selectedAccount: any = null;

  try {
    const { account, provider } = accountPool.getNextAccount();
    selectedAccount = account;

    const geminiReq = GeminiConverter.normalizeRequest(req.body, mappedModel);
    const geminiRes = await provider.generate(geminiReq);
    const latencyMs = Date.now() - start;
    const totalTokens = geminiRes.usageMetadata?.totalTokenCount || 0;

    accountPool.reportSuccess(account.id);
    if (req.apiKeyItem) {
      keyManager.recordUsage(req.apiKeyItem.id, totalTokens);
    }

    statsLogger.logRequest({
      protocol: 'gemini',
      endpoint: `/v1beta/models/${rawModel}:generateContent`,
      model: originalModel,
      mappedModel,
      statusCode: 200,
      latencyMs,
      stream: false,
      inputTokens: geminiRes.usageMetadata?.promptTokenCount || 0,
      outputTokens: geminiRes.usageMetadata?.candidatesTokenCount || 0,
      totalTokens,
      apiKeyName: req.apiKeyItem?.name,
      accountId: account.id,
      accountName: account.name,
      clientIp: req.ip
    });

    return res.json(geminiRes);
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    if (selectedAccount) {
      accountPool.reportError(selectedAccount.id, error);
    }

    statsLogger.logRequest({
      protocol: 'gemini',
      endpoint: `/v1beta/models/${rawModel}:generateContent`,
      model: originalModel,
      mappedModel,
      statusCode: 500,
      latencyMs,
      stream: false,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      apiKeyName: req.apiKeyItem?.name,
      accountId: selectedAccount?.id,
      accountName: selectedAccount?.name,
      clientIp: req.ip,
      errorMessage: error.message
    });

    return res.status(500).json({
      error: {
        code: 500,
        message: error.message || 'Gemini upstream error',
        status: 'INTERNAL'
      }
    });
  }
});

// POST /v1beta/models/:model:streamGenerateContent
router.post('/models/:model:streamGenerateContent', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const rawModel = req.params.model;
  const { mappedModel, originalModel } = modelRouter.resolveModel(rawModel);

  let selectedAccount: any = null;

  try {
    const { account, provider } = accountPool.getNextAccount();
    selectedAccount = account;

    const geminiReq = GeminiConverter.normalizeRequest(req.body, mappedModel);

    SseStreamHandler.initSseResponse(res);

    const fullResponse = await provider.streamGenerate(geminiReq, chunk => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    res.write('data: [DONE]\n\n');
    res.end();

    const latencyMs = Date.now() - start;
    const totalTokens = fullResponse.usageMetadata?.totalTokenCount || 0;

    accountPool.reportSuccess(account.id);
    if (req.apiKeyItem) {
      keyManager.recordUsage(req.apiKeyItem.id, totalTokens);
    }

    statsLogger.logRequest({
      protocol: 'gemini',
      endpoint: `/v1beta/models/${rawModel}:streamGenerateContent`,
      model: originalModel,
      mappedModel,
      statusCode: 200,
      latencyMs,
      stream: true,
      inputTokens: fullResponse.usageMetadata?.promptTokenCount || 0,
      outputTokens: fullResponse.usageMetadata?.candidatesTokenCount || 0,
      totalTokens,
      apiKeyName: req.apiKeyItem?.name,
      accountId: account.id,
      accountName: account.name,
      clientIp: req.ip
    });
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    if (selectedAccount) {
      accountPool.reportError(selectedAccount.id, error);
    }

    statsLogger.logRequest({
      protocol: 'gemini',
      endpoint: `/v1beta/models/${rawModel}:streamGenerateContent`,
      model: originalModel,
      mappedModel,
      statusCode: 500,
      latencyMs,
      stream: true,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      apiKeyName: req.apiKeyItem?.name,
      accountId: selectedAccount?.id,
      accountName: selectedAccount?.name,
      clientIp: req.ip,
      errorMessage: error.message
    });

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: { message: error.message } })}\n\n`);
      return res.end();
    }

    return res.status(500).json({
      error: {
        code: 500,
        message: error.message || 'Gemini upstream stream error',
        status: 'INTERNAL'
      }
    });
  }
});

export default router;
