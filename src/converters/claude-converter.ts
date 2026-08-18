import crypto from 'crypto';
import {
  GeminiGenerateRequest,
  GeminiGenerateResponse,
  GeminiContent,
  GeminiContentPart
} from '../providers/base.js';
import { ToolsConverter } from './tools-converter.js';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content:
    | string
    | Array<{
        type: 'text' | 'image' | 'tool_use' | 'tool_result';
        text?: string;
        source?: { type: 'base64'; media_type: string; data: string };
        id?: string;
        name?: string;
        input?: Record<string, any>;
        tool_use_id?: string;
        content?: string | any[];
        is_error?: boolean;
      }>;
}

export interface ClaudeMessagesRequest {
  model: string;
  messages: ClaudeMessage[];
  system?: string | Array<{ type: string; text: string }>;
  max_tokens?: number;
  metadata?: any;
  stop_sequences?: string[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  tools?: any[];
  tool_choice?: any;
}

export class ClaudeConverter {
  public static requestToGemini(req: ClaudeMessagesRequest, targetModel: string): GeminiGenerateRequest {
    let systemInstruction: GeminiContent | undefined = undefined;

    // Parse system message
    if (req.system) {
      if (typeof req.system === 'string') {
        systemInstruction = { role: 'system', parts: [{ text: req.system }] };
      } else if (Array.isArray(req.system)) {
        const textParts = req.system.map(s => s.text || '').filter(Boolean);
        if (textParts.length > 0) {
          systemInstruction = { role: 'system', parts: textParts.map(t => ({ text: t })) };
        }
      }
    }

    // Step 1: Pre-scan messages to build tool_use_id -> name mapping
    const toolIdToNameMap = new Map<string, string>();
    for (const msg of req.messages || []) {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_use' && block.id && block.name) {
            toolIdToNameMap.set(block.id, block.name);
          }
        }
      }
    }

    const rawContents: GeminiContent[] = [];

    for (const msg of req.messages || []) {
      const parts: GeminiContentPart[] = [];

      if (typeof msg.content === 'string') {
        if (msg.content) parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            parts.push({ text: block.text });
          } else if (block.type === 'image' && block.source?.type === 'base64') {
            parts.push({
              inlineData: {
                mimeType: block.source.media_type || 'image/jpeg',
                data: block.source.data
              }
            });
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name || '',
                args: block.input || {}
              }
            });
          } else if (block.type === 'tool_result') {
            const toolName = (block.tool_use_id ? toolIdToNameMap.get(block.tool_use_id) : null) || block.name || 'tool';
            let resData: any = block.content;
            let respObj: Record<string, any> = {};

            if (resData && typeof resData === 'object' && !Array.isArray(resData)) {
              respObj = resData;
            } else if (typeof resData === 'string') {
              try {
                const parsed = JSON.parse(resData);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  respObj = parsed;
                } else {
                  respObj = { output: resData };
                }
              } catch {
                respObj = { output: resData };
              }
            } else {
              respObj = { output: String(resData ?? '') };
            }

            parts.push({
              functionResponse: {
                name: toolName,
                response: respObj
              }
            });
          }
        }
      }

      const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
      if (parts.length > 0) {
        rawContents.push({ role, parts });
      }
    }

    // Step 2: Merge consecutive contents of the same role (required by Gemini API)
    const contents: GeminiContent[] = [];
    for (const c of rawContents) {
      if (c.parts.length === 0) continue;
      const last = contents[contents.length - 1];
      if (last && last.role === c.role) {
        last.parts.push(...c.parts);
      } else {
        contents.push({ role: c.role, parts: [...c.parts] });
      }
    }

    // Step 3: Ensure contents starts with user role if needed
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const tools = ToolsConverter.claudeToolsToGemini(req.tools);

    const generationConfig: any = {};
    if (typeof req.temperature === 'number') generationConfig.temperature = req.temperature;
    if (typeof req.top_p === 'number') generationConfig.topP = req.top_p;
    if (typeof req.top_k === 'number') generationConfig.topK = req.top_k;
    if (req.stop_sequences) generationConfig.stopSequences = req.stop_sequences;

    // Support Claude 3.7 Sonnet Extended Thinking
    if ((req as any).thinking && (req as any).thinking.type === 'enabled') {
      generationConfig.thinkingConfig = {
        thinkingBudget: (req as any).thinking.budget_tokens || 4096
      };
    }

    return {
      model: targetModel,
      contents,
      systemInstruction,
      tools,
      generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
    };
  }

  public static geminiResponseToClaude(
    geminiRes: GeminiGenerateResponse,
    model: string,
    id = `msg_${crypto.randomUUID().replace(/-/g, '')}`
  ) {
    const candidate = geminiRes.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const contentBlocks = ToolsConverter.geminiPartsToClaudeContentBlocks(parts);

    let stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' = 'end_turn';
    if (candidate?.finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
    else if (contentBlocks.some(b => b.type === 'tool_use')) stopReason = 'tool_use';

    return {
      id,
      type: 'message',
      role: 'assistant',
      model,
      content: contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }],
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: geminiRes.usageMetadata?.promptTokenCount || 0,
        output_tokens: geminiRes.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }
}
