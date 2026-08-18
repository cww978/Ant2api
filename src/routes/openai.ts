import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest, apiKeyAuth } from '../middleware/auth.js';
import { ModelRouterService } from '../services/model-router.js';
import { AccountPoolService } from '../services/account-pool.js';
import { KeyManagerService } from '../services/key-manager.js';
import { StatsLoggerService } from '../services/stats-logger.js';
import { OpenAiConverter, OpenAiChatRequest } from '../converters/openai-converter.js';
import { SseStreamHandler } from '../converters/stream-sse.js';

const router = Router();
const modelRouter = ModelRouterService.getInstance();
const accountPool = AccountPoolService.getInstance();
const keyManager = KeyManagerService.getInstance();
const statsLogger = StatsLoggerService.getInstance();

// GET /v1/models
router.get('/models', apiKeyAuth, (req: AuthenticatedRequest, res: Response) => {
  const models = modelRouter.getOpenAiModelsList();
  return res.json({
    object: 'list',
    data: models
  });
});

// POST /v1/chat/completions
router.post('/chat/completions', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const body = req.body as OpenAiChatRequest;
  const reqId = `chatcmpl-${crypto.randomUUID()}`;

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({
      error: { message: 'Missing or invalid "messages" in request body', type: 'invalid_request_error' }
    });
  }

  const { mappedModel, originalModel } = modelRouter.resolveModel(body.model);
  const isStream = Boolean(body.stream);

  const geminiReq = OpenAiConverter.requestToGemini(body, mappedModel);
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
        let isFirst = true;
        let outputTokens = 0;

        const fullResponse = await provider.streamGenerate(geminiReq, chunk => {
          SseStreamHandler.writeOpenAiChunk(res, reqId, originalModel, chunk, isFirst);
          isFirst = false;
        });

        SseStreamHandler.endOpenAiStream(res, reqId, originalModel);

        const latencyMs = Date.now() - start;
        const totalTokens = fullResponse.usageMetadata?.totalTokenCount || outputTokens;
        
        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, totalTokens);
        }

        statsLogger.logRequest({
          protocol: 'openai',
          endpoint: '/v1/chat/completions',
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
        // Non-streaming response
        const geminiRes = await provider.generate(geminiReq);
        const openAiRes = OpenAiConverter.geminiResponseToOpenAi(geminiRes, originalModel, reqId);
        const latencyMs = Date.now() - start;

        accountPool.reportSuccess(account.id);
        if (req.apiKeyItem) {
          keyManager.recordUsage(req.apiKeyItem.id, openAiRes.usage.total_tokens);
        }

        statsLogger.logRequest({
          protocol: 'openai',
          endpoint: '/v1/chat/completions',
          model: originalModel,
          mappedModel,
          statusCode: 200,
          latencyMs,
          stream: false,
          inputTokens: openAiRes.usage.prompt_tokens,
          outputTokens: openAiRes.usage.completion_tokens,
          totalTokens: openAiRes.usage.total_tokens,
          apiKeyName: req.apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp: req.ip
        });

        return res.json(openAiRes);
      }
    } catch (error: any) {
      lastError = error;
      if (selectedAccount) {
        accountPool.reportError(selectedAccount.id, error);
      }
      // If headers already sent, we cannot retry with another account
      if (res.headersSent) {
        break;
      }
      // Otherwise, loop will automatically try next candidate account!
    }
  }

  // If all attempts failed
  const latencyMs = Date.now() - start;
  statsLogger.logRequest({
    protocol: 'openai',
    endpoint: '/v1/chat/completions',
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
    res.write(`data: ${JSON.stringify({ error: { message: lastError?.message || 'Upstream error' } })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  return res.status(500).json({
    error: {
      message: lastError?.message || 'Internal upstream proxy error',
      type: 'api_error',
      code: 'upstream_error'
    }
  });
});

// POST /v1/embeddings (Fallback/Compatibility)
router.post('/embeddings', apiKeyAuth, (req: AuthenticatedRequest, res: Response) => {
  const body = req.body;
  const input = Array.isArray(body.input) ? body.input : [body.input || ''];
  const data = input.map((_: any, idx: number) => ({
    object: 'embedding',
    index: idx,
    embedding: new Array(768).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  }));

  return res.json({
    object: 'list',
    data,
    model: body.model || 'text-embedding-004',
    usage: {
      prompt_tokens: input.join(' ').length,
      total_tokens: input.join(' ').length
    }
  });
});

// POST /v1/images/generations (Imagen 3 & DALL-E Compatibility)
router.post('/images/generations', apiKeyAuth, async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body;
  const prompt = body.prompt;
  if (!prompt) {
    return res.status(400).json({ error: { message: 'Missing prompt parameter' } });
  }

  try {
    const { account } = accountPool.getNextAccount();
    const apiKey = account.apiKey;
    let url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';
    if (apiKey) url += `?key=${apiKey}`;

    const aspectRatio = body.size === '1024x1792' ? '9:16' : body.size === '1792x1024' ? '16:9' : '1:1';
    const payload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: Math.min(body.n || 1, 4),
        aspectRatio,
        outputMimeType: 'image/jpeg'
      }
    };

    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return res.status(upstreamRes.status).json({ error: { message: `Imagen upstream error: ${errText}` } });
    }

    const data: any = await upstreamRes.json();
    const predictions = data.predictions || [];
    const responseData = predictions.map((p: any) => ({
      b64_json: p.bytesBase64Encoded || p.image?.imageBytes || '',
      revised_prompt: prompt
    }));

    return res.json({
      created: Math.floor(Date.now() / 1000),
      data: responseData
    });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Image generation error' } });
  }
});

export default router;
