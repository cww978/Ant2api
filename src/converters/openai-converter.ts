import crypto from 'crypto';
import {
  GeminiGenerateRequest,
  GeminiGenerateResponse,
  GeminiContent,
  GeminiContentPart
} from '../providers/base.js';
import { ToolsConverter } from './tools-converter.js';
import { ThoughtSignatureCache } from '../services/thought-signature-cache.js';

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content?: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface OpenAiChatRequest {
  model: string;
  messages: OpenAiChatMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  max_completion_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  tools?: any[];
  tool_choice?: any;
  response_format?: { type: 'json_object' | 'text' | 'json_schema'; json_schema?: any };
  user?: string;
}

export class OpenAiConverter {
  public static requestToGemini(req: OpenAiChatRequest, targetModel: string): GeminiGenerateRequest {
    let systemInstruction: GeminiContent | undefined = undefined;
    // Step 1: Pre-scan messages to build tool_call_id -> function_name mapping
    const callIdToNameMap = new Map<string, string>();
    for (const msg of req.messages || []) {
      if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc.id && tc.function?.name) {
            callIdToNameMap.set(tc.id, tc.function.name);
          }
        }
      }
    }

    const rawContents: GeminiContent[] = [];

    for (const msg of req.messages || []) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (!systemInstruction) {
          systemInstruction = { role: 'system', parts: [{ text }] };
        } else {
          systemInstruction.parts.push({ text });
        }
        continue;
      }

      const parts: GeminiContentPart[] = [];

      // Parse content
      if (typeof msg.content === 'string') {
        if (msg.content) parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === 'text' && item.text) {
            parts.push({ text: item.text });
          } else if (item.type === 'image_url' && item.image_url?.url) {
            const url = item.image_url.url;
            if (url.startsWith('data:')) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2]
                  }
                });
              }
            } else {
              parts.push({
                fileData: {
                  mimeType: 'image/jpeg',
                  fileUri: url
                }
              });
            }
          }
        }
      }

      // Handle assistant tool_calls
      if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          try {
            const partObj: any = {
              functionCall: {
                name: tc.function.name,
                args: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments || '{}') : tc.function.arguments || {}
              }
            };
            const cachedSig = ThoughtSignatureCache.get(tc.id, tc.function?.name);
            const sig = (tc as any).thought_signature || (tc as any).thoughtSignature || cachedSig;
            if (sig) {
              partObj.thought_signature = sig;
            }
            parts.push(partObj);
          } catch (e) {
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: {}
              }
            });
          }
        }
      }

      // Handle tool responses
      if (msg.role === 'tool') {
        const toolName = msg.name || (msg.tool_call_id ? callIdToNameMap.get(msg.tool_call_id) : null) || 'tool';
        let respObj: Record<string, any> = {};
        if (msg.content && typeof msg.content === 'object' && !Array.isArray(msg.content)) {
          respObj = msg.content as any;
        } else if (typeof msg.content === 'string') {
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              respObj = parsed;
            } else {
              respObj = { content: msg.content };
            }
          } catch {
            respObj = { content: msg.content };
          }
        } else {
          respObj = { content: String(msg.content ?? '') };
        }

        parts.push({
          functionResponse: {
            name: toolName,
            response: respObj
          }
        });
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

    const tools = ToolsConverter.openAiToolsToGemini(req.tools);

    const generationConfig: any = {};
    if (typeof req.temperature === 'number') generationConfig.temperature = req.temperature;
    if (typeof req.top_p === 'number') generationConfig.topP = req.top_p;
    const maxTokens = req.max_completion_tokens || req.max_tokens;
    if (typeof maxTokens === 'number') generationConfig.maxOutputTokens = maxTokens;

    if (req.stop) {
      generationConfig.stopSequences = Array.isArray(req.stop) ? req.stop : [req.stop];
    }

    if (req.response_format?.type === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

    // Support OpenAI o1 / o3 reasoning effort and thinking budget
    if ((req as any).reasoning_effort || (req as any).thinking) {
      const effort = (req as any).reasoning_effort;
      let budget = 4096;
      if (effort === 'low') budget = 1024;
      else if (effort === 'medium') budget = 8192;
      else if (effort === 'high') budget = 24576;
      else if (typeof (req as any).thinking?.budget_tokens === 'number') {
        budget = (req as any).thinking.budget_tokens;
      }
      generationConfig.thinkingConfig = { thinkingBudget: budget };
    }

    if (tools && tools.length > 0) {
      const toolGuidance = `You are an expert autonomous AI software engineer and coding assistant integrated into an IDE. You have access to tools for interacting with files and the workspace (such as read_file, view_file, list_dir, file_search, grep_search, apply_patch, edit_file, write_file, run_command, etc.).

CRITICAL AUTONOMOUS EXECUTION & TOOL INVOCATION RULES:
1. Immediate Tool Execution: Whenever you decide you need to read, view, search, list, or examine any files or directory structures to analyze or solve the user's request, you MUST immediately emit the appropriate function call(s) in this turn.
2. NO Conversational Delays/Promises: NEVER output conversational text stating what files you plan to read in the future (e.g., NEVER say "请稍等，我将查看以下文件", "我先查阅一些核心文件", "接下来我将开始阅读这些文件", "Wait while I inspect..."). Instead, invoke the tool call directly right now so the environment can execute it and return the file content to you in the next turn.
3. Multi-Step Exploration: You operate in an autonomous agent loop. Proactively call tools in every step until you have gathered all necessary information. Only deliver your final conversational response/analysis to the user when you have actually read the files and finished your investigation.
4. Direct Code Editing: When asked to modify, create, edit, or patch code files, you MUST use the appropriate tool (such as apply_patch or edit_file) to apply changes directly. Do NOT output full replacement file contents or markdown code blocks into conversational text when a tool is available. Always invoke tools to perform file edits so the IDE client can track modified files and diffs.`;

      if (!systemInstruction) {
        systemInstruction = { role: 'system', parts: [{ text: toolGuidance }] };
      } else {
        systemInstruction.parts.push({ text: `\n\n${toolGuidance}` });
      }
    }

    return {
      model: targetModel,
      contents,
      systemInstruction,
      tools,
      generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
    };
  }

  public static geminiResponseToOpenAi(
    geminiRes: GeminiGenerateResponse,
    model: string,
    id = `chatcmpl-${crypto.randomUUID()}`
  ) {
    const candidate = geminiRes.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let textContent = '';
    for (const p of parts) {
      if (p.text) textContent += p.text;
    }

    const toolCalls = ToolsConverter.geminiPartsToOpenAiToolCalls(parts);

    let finishReason = 'stop';
    if (candidate?.finishReason === 'MAX_TOKENS') finishReason = 'length';
    else if (candidate?.finishReason === 'SAFETY') finishReason = 'content_filter';
    else if (toolCalls && toolCalls.length > 0) finishReason = 'tool_calls';

    const message: any = {
      role: 'assistant',
      content: textContent || null
    };

    if (toolCalls) {
      message.tool_calls = toolCalls;
    }

    return {
      id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: finishReason
        }
      ],
      usage: {
        prompt_tokens: geminiRes.usageMetadata?.promptTokenCount || 0,
        completion_tokens: geminiRes.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: geminiRes.usageMetadata?.totalTokenCount || 0
      }
    };
  }
}
