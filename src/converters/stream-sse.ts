import { Response } from 'express';
import { GeminiStreamChunk } from '../providers/base.js';
import { ThoughtSignatureCache } from '../services/thought-signature-cache.js';

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
   * Helper to write a dual named SSE frame (both `event:` and `data.type`)
   */
  public static writeSseFrame(res: Response, eventName: string, payload: any) {
    if (!payload.type) {
      payload.type = eventName;
    }
    const jsonStr = JSON.stringify(payload);
    res.write(`event: ${eventName}\ndata: ${jsonStr}\n\n`);
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
      if (p.text && !(p as any).thought) {
        textDelta += p.text;
      }
      if (p.functionCall) {
        const callId = `call_${Math.random().toString(36).substring(2, 10)}`;
        const sig = (p as any).thought_signature || (p as any).thoughtSignature || (p.functionCall as any)?.thought_signature || (p.functionCall as any)?.thoughtSignature;
        if (sig) {
          ThoughtSignatureCache.save(callId, p.functionCall.name, sig);
        }

        toolCalls.push({
          index: 0,
          id: callId,
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: typeof p.functionCall.args === 'string' ? p.functionCall.args : JSON.stringify(p.functionCall.args || {})
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
      if (p.text && !(p as any).thought) textDelta += p.text;
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
   * Starts a Codex Responses API SSE stream with created and in_progress events
   */
  public static startCodexResponsesStream(res: Response, id: string, model: string) {
    const createdAt = Math.floor(Date.now() / 1000);
    const lifecycleResponse = {
      id,
      object: 'response',
      created_at: createdAt,
      status: 'in_progress',
      model,
      output: [],
      error: null,
      incomplete_details: null,
      usage: null
    };

    this.writeSseFrame(res, 'response.created', {
      type: 'response.created',
      response: lifecycleResponse
    });

    this.writeSseFrame(res, 'response.in_progress', {
      type: 'response.in_progress',
      response: lifecycleResponse
    });
  }

  /**
   * Begins a reasoning (thinking) output item in the commentary phase
   */
  public static startCodexThinkingItem(res: Response, reasoningId: string, outputIndex: number) {
    this.writeSseFrame(res, 'response.output_item.added', {
      type: 'response.output_item.added',
      output_index: outputIndex,
      item: {
        id: reasoningId,
        type: 'message',
        role: 'assistant',
        phase: 'commentary',
        status: 'in_progress',
        content: []
      }
    });

    this.writeSseFrame(res, 'response.content_part.added', {
      type: 'response.content_part.added',
      item_id: reasoningId,
      output_index: outputIndex,
      content_index: 0,
      part: {
        type: 'output_text',
        text: '',
        annotations: []
      }
    });
  }

  /**
   * Streams reasoning delta text
   */
  public static writeCodexThinkingDelta(res: Response, reasoningId: string, deltaText: string, outputIndex: number) {
    if (!deltaText) return;
    this.writeSseFrame(res, 'response.output_text.delta', {
      type: 'response.output_text.delta',
      item_id: reasoningId,
      output_index: outputIndex,
      content_index: 0,
      delta: deltaText
    });
  }

  /**
   * Closes a reasoning (thinking) output item
   */
  public static closeCodexThinkingItem(res: Response, reasoningId: string, fullThinking: string, outputIndex: number) {
    this.writeSseFrame(res, 'response.output_text.done', {
      type: 'response.output_text.done',
      item_id: reasoningId,
      output_index: outputIndex,
      content_index: 0,
      text: fullThinking
    });

    this.writeSseFrame(res, 'response.content_part.done', {
      type: 'response.content_part.done',
      item_id: reasoningId,
      output_index: outputIndex,
      content_index: 0,
      part: {
        type: 'output_text',
        text: fullThinking,
        annotations: []
      }
    });

    this.writeSseFrame(res, 'response.output_item.done', {
      type: 'response.output_item.done',
      output_index: outputIndex,
      item: {
        id: reasoningId,
        type: 'message',
        role: 'assistant',
        phase: 'commentary',
        status: 'completed',
        content: [
          {
            type: 'output_text',
            text: fullThinking,
            annotations: []
          }
        ]
      }
    });
  }

  /**
   * Begins a regular text message output item
   */
  public static startCodexMessageItem(res: Response, messageId: string, outputIndex = 0, phase: 'commentary' | 'final_answer' = 'commentary') {
    this.writeSseFrame(res, 'response.output_item.added', {
      type: 'response.output_item.added',
      output_index: outputIndex,
      item: {
        id: messageId,
        type: 'message',
        status: 'in_progress',
        role: 'assistant',
        phase,
        content: []
      }
    });

    this.writeSseFrame(res, 'response.content_part.added', {
      type: 'response.content_part.added',
      item_id: messageId,
      output_index: outputIndex,
      content_index: 0,
      part: {
        type: 'output_text',
        text: '',
        annotations: []
      }
    });
  }

  /**
   * Writes a regular text delta
   */
  public static writeCodexResponsesDelta(res: Response, messageId: string, deltaText: string, outputIndex = 0) {
    if (!deltaText) return;
    this.writeSseFrame(res, 'response.output_text.delta', {
      type: 'response.output_text.delta',
      item_id: messageId,
      output_index: outputIndex,
      content_index: 0,
      delta: deltaText
    });
  }

  /**
   * Formally closes a text message item in the Codex Responses event stream
   */
  public static closeCodexMessageItem(
    res: Response,
    messageId: string,
    fullText: string,
    outputIndex = 0,
    phase: 'commentary' | 'final_answer' = 'commentary'
  ) {
    this.writeSseFrame(res, 'response.output_text.done', {
      type: 'response.output_text.done',
      item_id: messageId,
      output_index: outputIndex,
      content_index: 0,
      text: fullText
    });

    this.writeSseFrame(res, 'response.content_part.done', {
      type: 'response.content_part.done',
      item_id: messageId,
      output_index: outputIndex,
      content_index: 0,
      part: {
        type: 'output_text',
        text: fullText,
        annotations: []
      }
    });

    this.writeSseFrame(res, 'response.output_item.done', {
      type: 'response.output_item.done',
      output_index: outputIndex,
      item: {
        id: messageId,
        type: 'message',
        status: 'completed',
        role: 'assistant',
        phase,
        content: [
          {
            type: 'output_text',
            text: fullText,
            annotations: []
          }
        ]
      }
    });
  }

  /**
   * Writes a Custom Tool Call event sequence (e.g. apply_patch, shell)
   */
  public static writeCodexCustomToolCall(
    res: Response,
    callId: string,
    itemId: string,
    outputIndex: number,
    name: string,
    inputStr: string
  ) {
    // 1. output_item.added (in_progress)
    this.writeSseFrame(res, 'response.output_item.added', {
      type: 'response.output_item.added',
      output_index: outputIndex,
      item: {
        id: itemId,
        type: 'custom_tool_call',
        status: 'in_progress',
        name,
        call_id: callId,
        input: ''
      }
    });

    // 2. custom_tool_call_input.delta
    this.writeSseFrame(res, 'response.custom_tool_call_input.delta', {
      type: 'response.custom_tool_call_input.delta',
      item_id: itemId,
      output_index: outputIndex,
      call_id: callId,
      delta: inputStr
    });

    // 3. custom_tool_call_input.done
    this.writeSseFrame(res, 'response.custom_tool_call_input.done', {
      type: 'response.custom_tool_call_input.done',
      item_id: itemId,
      output_index: outputIndex,
      call_id: callId,
      input: inputStr
    });

    // 4. output_item.done
    this.writeSseFrame(res, 'response.output_item.done', {
      type: 'response.output_item.done',
      output_index: outputIndex,
      item: {
        id: itemId,
        type: 'custom_tool_call',
        status: 'completed',
        name,
        call_id: callId,
        input: inputStr
      }
    });
  }

  /**
   * Writes a standard Function Call event sequence
   */
  public static writeCodexFunctionCall(
    res: Response,
    callId: string,
    itemId: string,
    outputIndex: number,
    name: string,
    argsStr: string
  ) {
    // 1. output_item.added (in_progress)
    this.writeSseFrame(res, 'response.output_item.added', {
      type: 'response.output_item.added',
      output_index: outputIndex,
      item: {
        id: itemId,
        type: 'function_call',
        status: 'in_progress',
        name,
        call_id: callId,
        arguments: ''
      }
    });

    // 2. function_call_arguments.delta
    this.writeSseFrame(res, 'response.function_call_arguments.delta', {
      type: 'response.function_call_arguments.delta',
      item_id: itemId,
      output_index: outputIndex,
      call_id: callId,
      delta: argsStr
    });

    // 3. function_call_arguments.done
    this.writeSseFrame(res, 'response.function_call_arguments.done', {
      type: 'response.function_call_arguments.done',
      item_id: itemId,
      output_index: outputIndex,
      call_id: callId,
      arguments: argsStr
    });

    // 4. output_item.done
    this.writeSseFrame(res, 'response.output_item.done', {
      type: 'response.output_item.done',
      output_index: outputIndex,
      item: {
        id: itemId,
        type: 'function_call',
        status: 'completed',
        name,
        call_id: callId,
        arguments: argsStr
      }
    });
  }

  /**
   * Writes SSE keepalive ping
   */
  public static writeHeartbeat(res: Response) {
    res.write(': ping\n\n');
  }

  /**
   * Ends a Codex Responses stream with response.completed / response.done
   */
  public static endCodexResponsesStream(
    res: Response,
    id: string,
    model: string,
    outputItems: any[] = [],
    promptTokens = 0,
    completionTokens = 0,
    finishReason?: string | null
  ) {
    const isInterrupted = finishReason === 'MAX_TOKENS' || finishReason === 'SAFETY' || finishReason === 'RECITATION';
    const status = isInterrupted ? 'incomplete' : 'completed';
    const terminalType = `response.${status}`;

    let incompleteDetails: any = null;
    if (isInterrupted) {
      incompleteDetails = {
        reason: finishReason === 'MAX_TOKENS' ? 'max_output_tokens' : 'content_filter'
      };
    }

    const totalTokens = promptTokens + completionTokens;
    const createdAt = Math.floor(Date.now() / 1000);
    const completedAt = createdAt;

    const responsePayload = {
      id,
      object: 'response',
      created_at: createdAt,
      completed_at: completedAt,
      status,
      model,
      output: outputItems,
      incomplete_details: incompleteDetails,
      error: null,
      usage: {
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        input_token_details: {
          cached_tokens: 0
        },
        output_token_details: {
          reasoning_tokens: 0
        }
      }
    };

    this.writeSseFrame(res, terminalType, {
      type: terminalType,
      response: responsePayload
    });

    this.writeSseFrame(res, 'response.done', {
      type: 'response.done',
      response: responsePayload
    });

    res.write('data: [DONE]\n\n');
    res.end();
  }
}
