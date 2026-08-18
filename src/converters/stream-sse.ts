import crypto from 'crypto';
import { Response } from 'express';
import { GeminiStreamChunk } from '../providers/base.js';

export class SseStreamHandler {
  /**
   * Sets up standard SSE headers on an Express response
   */
  public static initSseResponse(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    res.flushHeaders?.();
  }

  /**
   * Formats and writes an OpenAI Chat Completion Chunk
   */
  public static writeOpenAiChunk(
    res: Response,
    id: string,
    model: string,
    chunk: GeminiStreamChunk,
    isFirst = false
  ) {
    const candidate = chunk.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let textDelta = '';
    const toolCalls: any[] = [];

    for (const p of parts) {
      if (p.text) textDelta += p.text;
      if (p.functionCall) {
        toolCalls.push({
          index: 0,
          id: `call_${Math.random().toString(36).substring(2, 10)}`,
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args || {})
          }
        });
      }
    }

    const delta: any = {};
    if (isFirst) {
      delta.role = 'assistant';
    }
    if (textDelta) {
      delta.content = textDelta;
    }
    if (toolCalls.length > 0) {
      delta.tool_calls = toolCalls;
    }

    const openAiChunk = {
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta,
          finish_reason: candidate?.finishReason ? candidate.finishReason.toLowerCase() : null
        }
      ]
    };

    res.write(`data: ${JSON.stringify(openAiChunk)}\n\n`);
  }

  /**
   * Finalizes an OpenAI stream with [DONE]
   */
  public static endOpenAiStream(res: Response, id: string, model: string) {
    const finalChunk = {
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    };
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }

  /**
   * Starts a Claude SSE stream with message_start and content_block_start
   */
  public static startClaudeStream(res: Response, id: string, model: string, inputTokens = 0) {
    const msgStart = {
      type: 'message_start',
      message: {
        id,
        type: 'message',
        role: 'assistant',
        content: [],
        model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: inputTokens,
          output_tokens: 1
        }
      }
    };
    res.write(`event: message_start\ndata: ${JSON.stringify(msgStart)}\n\n`);

    const blockStart = {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'text',
        text: ''
      }
    };
    res.write(`event: content_block_start\ndata: ${JSON.stringify(blockStart)}\n\n`);
  }

  /**
   * Writes a Claude text delta event
   */
  public static writeClaudeDelta(res: Response, text: string) {
    if (!text) return;
    const deltaEvent = {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text
      }
    };
    res.write(`event: content_block_delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`);
  }

  /**
   * Closes a Claude SSE stream with content_block_stop, message_delta, and message_stop
   */
  public static endClaudeStream(
    res: Response,
    outputTokens = 10,
    stopReason: 'end_turn' | 'max_tokens' | 'tool_use' = 'end_turn'
  ) {
    res.write(`event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`);

    const msgDelta = {
      type: 'message_delta',
      delta: {
        stop_reason: stopReason,
        stop_sequence: null
      },
      usage: {
        output_tokens: outputTokens
      }
    };
    res.write(`event: message_delta\ndata: ${JSON.stringify(msgDelta)}\n\n`);
    res.write(`event: message_stop\ndata: {"type":"message_stop"}\n\n`);
    res.end();
  }

  /**
   * Formats and writes a Codex / OpenAI Text Completion Chunk
   */
  public static writeCodexChunk(
    res: Response,
    id: string,
    model: string,
    chunk: GeminiStreamChunk
  ) {
    const candidate = chunk.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let textDelta = '';
    for (const p of parts) {
      if (p.text) textDelta += p.text;
    }

    const codexChunk = {
      id: id.startsWith('cmpl-') ? id : `cmpl-${id}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          text: textDelta,
          index: 0,
          logprobs: null,
          finish_reason: candidate?.finishReason ? candidate.finishReason.toLowerCase() : null
        }
      ]
    };

    res.write(`data: ${JSON.stringify(codexChunk)}\n\n`);
  }

  /**
   * Finalizes a Codex / Text Completion stream with finish_reason: 'stop' and [DONE]
   */
  public static endCodexStream(res: Response, id: string, model: string) {
    const finalChunk = {
      id: id.startsWith('cmpl-') ? id : `cmpl-${id}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          text: '',
          index: 0,
          logprobs: null,
          finish_reason: 'stop'
        }
      ]
    };
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }

  /**
   * Starts a Codex Responses API SSE stream
   */
  public static startCodexResponsesStream(res: Response, id: string, model: string) {
    const createdEvent = {
      type: 'response.created',
      response: {
        id,
        object: 'response',
        status: 'in_progress',
        model,
        output: [],
        usage: null
      }
    };
    res.write(`event: response.created\ndata: ${JSON.stringify(createdEvent)}\n\n`);
  }

  /**
   * Begins a text message output item when text starts arriving
   */
  public static startCodexMessageItem(res: Response, id: string) {
    const itemAddedEvent = {
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        id: `item_${id}`,
        type: 'message',
        status: 'in_progress',
        role: 'assistant',
        content: []
      }
    };
    res.write(`event: response.output_item.added\ndata: ${JSON.stringify(itemAddedEvent)}\n\n`);

    const partAddedEvent = {
      type: 'response.content_part.added',
      output_index: 0,
      content_index: 0,
      part: {
        type: 'output_text',
        text: ''
      }
    };
    res.write(`event: response.content_part.added\ndata: ${JSON.stringify(partAddedEvent)}\n\n`);
  }

  /**
   * Writes a Codex Responses text delta
   */
  public static writeCodexResponsesDelta(res: Response, deltaText: string) {
    if (!deltaText) return;
    const deltaEvent = {
      type: 'response.output_text.delta',
      output_index: 0,
      content_index: 0,
      delta: deltaText
    };
    res.write(`event: response.output_text.delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`);
  }

  /**
   * Writes a complete tool call event sequence
   */
  public static writeCodexFunctionCall(
    res: Response,
    callId: string,
    outputIndex: number,
    name: string,
    args: any
  ) {
    const argsStr = typeof args === 'string' ? args : JSON.stringify(args || {});

    const itemAddedEvent = {
      type: 'response.output_item.added',
      output_index: outputIndex,
      item: {
        id: callId,
        type: 'function_call',
        name,
        call_id: callId,
        arguments: ''
      }
    };
    res.write(`event: response.output_item.added\ndata: ${JSON.stringify(itemAddedEvent)}\n\n`);

    const deltaEvent = {
      type: 'response.function_call_arguments.delta',
      output_index: outputIndex,
      call_id: callId,
      delta: argsStr
    };
    res.write(`event: response.function_call_arguments.delta\ndata: ${JSON.stringify(deltaEvent)}\n\n`);

    const doneArgsEvent = {
      type: 'response.function_call_arguments.done',
      output_index: outputIndex,
      call_id: callId,
      arguments: argsStr
    };
    res.write(`event: response.function_call_arguments.done\ndata: ${JSON.stringify(doneArgsEvent)}\n\n`);

    const itemDoneEvent = {
      type: 'response.output_item.done',
      output_index: outputIndex,
      item: {
        id: callId,
        type: 'function_call',
        name,
        call_id: callId,
        arguments: argsStr
      }
    };
    res.write(`event: response.output_item.done\ndata: ${JSON.stringify(itemDoneEvent)}\n\n`);
  }

  /**
   * Ends a Codex Responses stream with full events including response.completed and response.done
   */
  public static endCodexResponsesStream(
    res: Response,
    id: string,
    model: string,
    fullText: string,
    functionCalls: Array<{ id: string; name: string; args: any }> = [],
    promptTokens = 0,
    completionTokens = 0
  ) {
    const outputItems: any[] = [];

    if (fullText) {
      const partDoneEvent = {
        type: 'response.output_text.done',
        output_index: 0,
        content_index: 0,
        text: fullText
      };
      res.write(`event: response.output_text.done\ndata: ${JSON.stringify(partDoneEvent)}\n\n`);

      const contentPartDoneEvent = {
        type: 'response.content_part.done',
        output_index: 0,
        content_index: 0,
        part: {
          type: 'output_text',
          text: fullText
        }
      };
      res.write(`event: response.content_part.done\ndata: ${JSON.stringify(contentPartDoneEvent)}\n\n`);

      const itemDoneEvent = {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          id: `item_${id}`,
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: fullText
            }
          ]
        }
      };
      res.write(`event: response.output_item.done\ndata: ${JSON.stringify(itemDoneEvent)}\n\n`);

      outputItems.push({
        id: `item_${id}`,
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: fullText
          }
        ]
      });
    }

    for (const fc of functionCalls) {
      const argsStr = typeof fc.args === 'string' ? fc.args : JSON.stringify(fc.args || {});
      outputItems.push({
        id: fc.id,
        type: 'function_call',
        name: fc.name,
        call_id: fc.id,
        arguments: argsStr
      });
    }

    const completedEvent = {
      type: 'response.completed',
      response: {
        id,
        object: 'response',
        status: 'completed',
        model,
        output: outputItems,
        usage: {
          input_tokens: promptTokens,
          output_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          input_token_details: {
            cached_tokens: 0
          },
          output_token_details: {
            reasoning_tokens: 0
          }
        }
      }
    };
    res.write(`event: response.completed\ndata: ${JSON.stringify(completedEvent)}\n\n`);

    const doneEvent = {
      type: 'response.done',
      response: completedEvent.response
    };
    res.write(`event: response.done\ndata: ${JSON.stringify(doneEvent)}\n\n`);

    res.write('data: [DONE]\n\n');
    res.end();
  }
}


