import { Server as HttpServer, IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { KeyManagerService } from './key-manager.js';
import { AccountPoolService } from './account-pool.js';
import { ModelRouterService } from './model-router.js';
import { StatsLoggerService } from './stats-logger.js';
import { CodexConverter } from '../converters/codex.js';

export class WebSocketHandlerService {
  private static instance: WebSocketHandlerService;
  private wss: WebSocketServer;
  private keyManager = KeyManagerService.getInstance();
  private accountPool = AccountPoolService.getInstance();
  private modelRouter = ModelRouterService.getInstance();
  private statsLogger = StatsLoggerService.getInstance();

  private constructor() {
    this.wss = new WebSocketServer({ noServer: true });
  }

  public static getInstance(): WebSocketHandlerService {
    if (!WebSocketHandlerService.instance) {
      WebSocketHandlerService.instance = new WebSocketHandlerService();
    }
    return WebSocketHandlerService.instance;
  }

  /**
   * Attaches WebSocket upgrade listener to the HTTP Server
   */
  public attach(server: HttpServer) {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname.replace(/\/+$/, '');

      // Check if the requested path is supported for WebSocket transport
      if (
        pathname === '/v1/responses' ||
        pathname === '/v1/realtime' ||
        pathname === '/v1/chat/completions' ||
        pathname === '/ws'
      ) {
        // Authenticate the WebSocket request
        const apiKey = this.extractApiKey(req, url);
        let apiKeyItem: any = undefined;
        const allKeys = this.keyManager.getAllKeys().filter(k => k.enabled);
        if (allKeys.length > 0) {
          const res = this.keyManager.validateKey(apiKey || '');
          if (!res.valid) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
          apiKeyItem = res.keyItem;
        }

        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req, { apiKeyItem, url, pathname });
        });
      } else {
        // Not a recognized WS endpoint
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage, ctx: any) => {
      this.handleConnection(ws, req, ctx);
    });

    console.log('[WebSocket] Native WebSocket server attached for /v1/responses, /v1/realtime, and /v1/chat/completions');
  }

  private extractApiKey(req: IncomingMessage, url: URL): string | undefined {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    if (req.headers['x-api-key']) {
      return String(req.headers['x-api-key']).trim();
    }
    if (req.headers['api-key']) {
      return String(req.headers['api-key']).trim();
    }
    const queryKey = url.searchParams.get('api_key') || url.searchParams.get('key') || url.searchParams.get('token');
    if (queryKey) {
      return queryKey.trim();
    }
    // Sec-WebSocket-Protocol could carry the key
    const protocols = req.headers['sec-websocket-protocol'];
    if (protocols) {
      const parts = protocols.split(',').map(p => p.trim());
      for (const p of parts) {
        if (p.startsWith('bearer-') || p.startsWith('sk-ant2api-')) {
          return p.replace(/^bearer-/, '');
        }
      }
    }
    return undefined;
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage, ctx: any) {
    const { apiKeyItem, url, pathname } = ctx;
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    const conversationItems: any[] = [];
    let isProcessing = false;

    // Send connection acknowledgment / session created event
    const sessionId = `sess_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    this.sendJson(ws, {
      type: 'session.created',
      session: {
        id: sessionId,
        object: 'realtime.session',
        model: url.searchParams.get('model') || 'gemini-3.7-flash',
        modalities: ['text']
      }
    });

    ws.on('message', async (data: Buffer | string) => {
      try {
        const text = data.toString();
        const msg = JSON.parse(text);

        // Ping / Heartbeat
        if (msg.type === 'ping') {
          this.sendJson(ws, { type: 'pong' });
          return;
        }

        // Conversation item added
        if (msg.type === 'conversation.item.create') {
          const item = msg.item || {};
          if (!item.id) {
            item.id = `item_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
          }
          conversationItems.push(item);
          this.sendJson(ws, {
            type: 'conversation.item.created',
            previous_item_id: conversationItems.length > 1 ? conversationItems[conversationItems.length - 2].id : null,
            item
          });
          return;
        }

        // Response creation request (Codex / Realtime protocol)
        if (msg.type === 'response.create' || msg.input || msg.messages || !msg.type) {
          if (isProcessing) {
            this.sendJson(ws, {
              type: 'error',
              error: {
                message: 'A response is already in progress.',
                type: 'invalid_request_error'
              }
            });
            return;
          }

          isProcessing = true;
          try {
            await this.processResponseRequest(ws, msg, conversationItems, apiKeyItem, clientIp);
          } finally {
            isProcessing = false;
          }
          return;
        }

        // Response cancel request
        if (msg.type === 'response.cancel') {
          this.sendJson(ws, {
            type: 'response.cancelled',
            response_id: msg.response_id
          });
          return;
        }
      } catch (err: any) {
        this.sendJson(ws, {
          type: 'error',
          error: {
            message: `Failed to process message: ${err.message || err}`,
            type: 'invalid_request_error'
          }
        });
      }
    });

    ws.on('error', (err) => {
      console.warn(`[WebSocket] Client error (${clientIp}): ${err.message}`);
    });
  }

  private async processResponseRequest(
    ws: WebSocket,
    msg: any,
    conversationItems: any[],
    apiKeyItem: any,
    clientIp: string
  ) {
    const start = Date.now();
    const reqId = `resp-${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;
    
    // Prepare request body
    const body: any = {
      model: msg.model || msg.response?.model || 'gemini-3.7-flash',
      instructions: msg.instructions || msg.response?.instructions,
      tools: msg.tools || msg.response?.tools,
      temperature: msg.temperature || msg.response?.temperature,
      max_tokens: msg.max_tokens || msg.response?.max_output_tokens || 4096,
      input: []
    };

    if (msg.response?.input && Array.isArray(msg.response.input)) {
      body.input = msg.response.input;
    } else if (msg.input && Array.isArray(msg.input)) {
      body.input = msg.input;
    } else if (msg.messages && Array.isArray(msg.messages)) {
      body.input = msg.messages;
    } else if (conversationItems.length > 0) {
      body.input = [...conversationItems];
    }

    const { mappedModel, originalModel } = this.modelRouter.resolveModel(body.model);
    const geminiReq = CodexConverter.responsesRequestToGemini(body, mappedModel);

    // Send response.created
    this.sendJson(ws, {
      type: 'response.created',
      response: {
        id: reqId,
        object: 'response',
        status: 'in_progress',
        model: originalModel,
        output: [],
        usage: null
      }
    });

    const maxAttempts = Math.min(this.accountPool.getEnabledAccountsCount(), 3);
    const triedIds: string[] = [];
    let lastError: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let selectedAccount: any = null;
      try {
        const { account, provider } = this.accountPool.getNextAccount(triedIds);
        selectedAccount = account;
        triedIds.push(account.id);

        let fullText = '';
        let promptTokens = 0;
        let completionTokens = 0;
        let messageItemStarted = false;
        const functionCalls: Array<{ id: string; name: string; args: any }> = [];
        const seenFunctionCalls = new Set<string>();
        let callIdx = 0;

        const geminiRes = await provider.streamGenerate(geminiReq, (chunk) => {
          if (ws.readyState !== WebSocket.OPEN) return;

          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              if (!messageItemStarted) {
                this.sendJson(ws, {
                  type: 'response.output_item.added',
                  output_index: 0,
                  item: {
                    id: `item_${reqId}`,
                    type: 'message',
                    status: 'in_progress',
                    role: 'assistant',
                    content: []
                  }
                });
                this.sendJson(ws, {
                  type: 'response.content_part.added',
                  output_index: 0,
                  content_index: 0,
                  part: {
                    type: 'output_text',
                    text: ''
                  }
                });
                messageItemStarted = true;
              }
              fullText += part.text;
              this.sendJson(ws, {
                type: 'response.output_text.delta',
                output_index: 0,
                content_index: 0,
                delta: part.text
              });
            }

            if (part.functionCall) {
              const fcKey = `${part.functionCall.name}_${JSON.stringify(part.functionCall.args || {})}`;
              if (!seenFunctionCalls.has(fcKey)) {
                seenFunctionCalls.add(fcKey);
                const callId = `call_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
                const argsStr = JSON.stringify(part.functionCall.args || {});

                functionCalls.push({
                  id: callId,
                  name: part.functionCall.name,
                  args: part.functionCall.args || {}
                });

                const outIdx = messageItemStarted ? 1 + callIdx : callIdx;
                this.sendJson(ws, {
                  type: 'response.output_item.added',
                  output_index: outIdx,
                  item: {
                    id: callId,
                    type: 'function_call',
                    name: part.functionCall.name,
                    call_id: callId,
                    arguments: ''
                  }
                });
                this.sendJson(ws, {
                  type: 'response.function_call_arguments.delta',
                  output_index: outIdx,
                  call_id: callId,
                  delta: argsStr
                });
                this.sendJson(ws, {
                  type: 'response.function_call_arguments.done',
                  output_index: outIdx,
                  call_id: callId,
                  arguments: argsStr
                });
                this.sendJson(ws, {
                  type: 'response.output_item.done',
                  output_index: outIdx,
                  item: {
                    id: callId,
                    type: 'function_call',
                    name: part.functionCall.name,
                    call_id: callId,
                    arguments: argsStr
                  }
                });
                callIdx++;
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

        // Finalize response
        const outputItems: any[] = [];
        if (fullText) {
          this.sendJson(ws, {
            type: 'response.output_text.done',
            output_index: 0,
            content_index: 0,
            text: fullText
          });
          this.sendJson(ws, {
            type: 'response.content_part.done',
            output_index: 0,
            content_index: 0,
            part: {
              type: 'output_text',
              text: fullText
            }
          });
          this.sendJson(ws, {
            type: 'response.output_item.done',
            output_index: 0,
            item: {
              id: `item_${reqId}`,
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [{ type: 'output_text', text: fullText }]
            }
          });
          outputItems.push({
            id: `item_${reqId}`,
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text: fullText }]
          });
        }

        for (const fc of functionCalls) {
          outputItems.push({
            id: fc.id,
            type: 'function_call',
            name: fc.name,
            call_id: fc.id,
            arguments: JSON.stringify(fc.args || {})
          });
        }

        const totalTokens = (promptTokens || 20) + (completionTokens || Math.ceil(fullText.length / 4));
        const completedResponse = {
          id: reqId,
          object: 'response',
          status: 'completed',
          model: originalModel,
          output: outputItems,
          usage: {
            input_tokens: promptTokens,
            output_tokens: completionTokens,
            total_tokens: totalTokens,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            input_token_details: { cached_tokens: 0 },
            output_token_details: { reasoning_tokens: 0 }
          }
        };

        this.sendJson(ws, {
          type: 'response.completed',
          response: completedResponse
        });
        this.sendJson(ws, {
          type: 'response.done',
          response: completedResponse
        });

        // Store generated items into session conversation history
        conversationItems.push(...outputItems);

        const latencyMs = Date.now() - start;
        this.accountPool.reportSuccess(account.id);
        if (apiKeyItem) {
          this.keyManager.recordUsage(apiKeyItem.id, totalTokens);
        }

        this.statsLogger.logRequest({
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
          apiKeyName: apiKeyItem?.name,
          accountId: account.id,
          accountName: account.name,
          clientIp
        });

        return;
      } catch (err: any) {
        lastError = err;
        if (selectedAccount) {
          this.accountPool.reportError(selectedAccount.id, err);
        }
      }
    }

    // All attempts failed
    const latencyMs = Date.now() - start;
    this.statsLogger.logRequest({
      protocol: 'codex',
      endpoint: '/v1/responses',
      model: originalModel,
      mappedModel,
      statusCode: 500,
      latencyMs,
      stream: true,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      apiKeyName: apiKeyItem?.name,
      clientIp,
      errorMessage: lastError?.message || 'All accounts failed'
    });

    const failedResponse = {
      id: reqId,
      object: 'response',
      status: 'failed',
      model: originalModel,
      output: [
        {
          id: `item_${reqId}`,
          type: 'message',
          status: 'failed',
          role: 'assistant',
          content: [{ type: 'output_text', text: `[Error: ${lastError?.message || 'Upstream request failed'}]` }]
        }
      ],
      usage: null
    };

    this.sendJson(ws, {
      type: 'response.completed',
      response: failedResponse
    });
    this.sendJson(ws, {
      type: 'response.done',
      response: failedResponse
    });
    this.sendJson(ws, {
      type: 'error',
      error: {
        message: lastError?.message || 'Upstream request failed',
        type: 'api_error'
      }
    });
  }

  private sendJson(ws: WebSocket, obj: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }
}
