import { GeminiGenerateRequest, GeminiGenerateResponse, GeminiContent } from '../providers/base.js';
import { ToolsConverter } from './tools-converter.js';
import { ThoughtSignatureCache } from '../services/thought-signature-cache.js';

export interface CodexCompletionRequest {
  model?: string;
  prompt?: string | string[];
  suffix?: string;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  logprobs?: number | null;
  echo?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  best_of?: number;
  user?: string;
}

export interface CodexCompletionChoice {
  text: string;
  index: number;
  logprobs: null | Record<string, any>;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface CodexCompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: CodexCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CodexEditRequest {
  model?: string;
  input?: string;
  instruction: string;
  temperature?: number;
  top_p?: number;
  n?: number;
}

export class CodexConverter {
  /**
   * Converts a Codex / OpenAI Completions (or FIM) request to Gemini API format
   */
  public static requestToGemini(body: CodexCompletionRequest, targetModel: string): GeminiGenerateRequest {
    const promptText = Array.isArray(body.prompt) ? body.prompt.join('\n') : (body.prompt || '');
    const isFim = Boolean(body.suffix && body.suffix.trim().length > 0);

    let userContent = '';
    let systemInstruction = '';

    if (isFim) {
      // Fill-In-the-Middle format
      systemInstruction = 'You are an advanced code completion AI (Codex FIM engine). Complete the code that fits between the prefix (<PRE>) and the suffix (<SUF>). Return ONLY the code to insert at <MID>, with no markdown code blocks, backticks, or extra explanations.';
      userContent = `<PRE>\n${promptText}\n<SUF>\n${body.suffix}\n<MID>`;
    } else {
      systemInstruction = 'You are an expert Codex code completion model. Seamlessly continue writing the code precisely from the prompt. Output ONLY valid continuation code without markdown formatting or introductory text.';
      userContent = promptText;
    }

    const stopSequences = Array.isArray(body.stop)
      ? body.stop
      : body.stop
      ? [body.stop]
      : undefined;

    const maxTokens = body.max_tokens || body.max_completion_tokens || 2048;

    return {
      model: targetModel,
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: body.temperature !== undefined ? Math.min(Math.max(body.temperature, 0), 2) : 0.2,
        topP: body.top_p,
        maxOutputTokens: maxTokens,
        stopSequences
      }
    };
  }

  /**
   * Converts a Code Edit request into Gemini API format
   */
  public static editRequestToGemini(body: CodexEditRequest, targetModel: string): GeminiGenerateRequest {
    const systemInstruction = 'You are an expert code editor (Codex Edit). Apply the requested instruction to the provided input code. Return ONLY the modified code without markdown code blocks or explanations.';
    const userContent = `Instruction: ${body.instruction}\n\nInput Code:\n${body.input || ''}`;

    return {
      model: targetModel,
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: body.temperature ?? 0.2,
        topP: body.top_p
      }
    };
  }

  /**
   * Converts Gemini Response to Codex / text_completion response
   */
  public static geminiResponseToCodex(
    geminiRes: GeminiGenerateResponse,
    originalModel: string,
    reqId: string
  ): CodexCompletionResponse {
    const candidate = geminiRes.candidates?.[0];
    let text = '';

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          text += part.text;
        }
      }
    }

    let finishReason: 'stop' | 'length' | 'content_filter' = 'stop';
    if (candidate?.finishReason === 'MAX_TOKENS') finishReason = 'length';
    if (candidate?.finishReason === 'SAFETY') finishReason = 'content_filter';

    const promptTokens = geminiRes.usageMetadata?.promptTokenCount || 0;
    const completionTokens = geminiRes.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);

    return {
      id: reqId.startsWith('cmpl-') ? reqId : `cmpl-${reqId}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: originalModel,
      choices: [
        {
          text,
          index: 0,
          logprobs: null,
          finish_reason: finishReason
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }

  /**
   * Converts Codex /v1/responses request to Gemini Generate Request
   */
  public static responsesRequestToGemini(body: any, targetModel: string): GeminiGenerateRequest {
    const rawContents: GeminiContent[] = [];
    let systemInstruction: GeminiContent | undefined = undefined;

    const hasTools = Boolean(body.tools && Array.isArray(body.tools) && body.tools.length > 0);
    let baseInstructions = typeof body.instructions === 'string' ? body.instructions.trim() : '';

    if (hasTools) {
      const toolGuidance = `You are an expert autonomous AI software engineer and coding assistant integrated into an IDE. You have access to tools for interacting with files and the workspace (such as read_file, view_file, list_dir, file_search, grep_search, apply_patch, edit_file, write_file, run_command, etc.).

CRITICAL AUTONOMOUS EXECUTION & TOOL INVOCATION RULES:
1. Immediate Tool Execution: Whenever you decide you need to read, view, search, list, or examine any files or directory structures to analyze or solve the user's request, you MUST immediately invoke the appropriate function call(s) (such as read_file, view_file, grep_search, list_dir) in THIS turn.
2. NO Conversational Delays/Promises: NEVER output conversational text stating what files you plan to read in the future (e.g., NEVER say "请稍等，我将查看以下文件", "我先查阅一些核心文件", "接下来我将开始阅读这些文件", "Wait while I inspect..."). Instead, invoke the tool call directly right now so the environment can execute it and return the file content to you in the next turn.
3. Multi-Step Exploration: You operate in an autonomous agent loop. Proactively call tools in every step until you have gathered all necessary information.
4. MANDATORY apply_patch TOOL INVOCATION FOR CODE EDITS (NO MARKDOWN PATCH TEXT):
   - When asked to modify, create, edit, optimize, or patch any code or document, you MUST execute the \`apply_patch\` tool function call with the patch string as the \`patch\` parameter!
   - ABSOLUTELY NEVER output \`*** Begin Patch\` or \`\`\`patch / \`\`\`diff markdown code blocks into your conversational text!
   - NEVER say "请应用以下补丁" or "以下是修改补丁" in text. You MUST apply it directly by calling the \`apply_patch\` function.
   - The user's IDE client ONLY tracks modified files, writes to disk, and displays the "N files changed [Review]" diff UI when you invoke the \`apply_patch\` function call!`;
      if (baseInstructions) {
        baseInstructions = `${baseInstructions}\n\n${toolGuidance}`;
      } else {
        baseInstructions = toolGuidance;
      }
    }

    if (baseInstructions) {
      systemInstruction = {
        parts: [{ text: baseInstructions }]
      };
    }

    // Step 1: Pre-scan input items to build a mapping from call_id -> function_name
    const callIdToNameMap = new Map<string, string>();
    for (const item of body.input || []) {
      if (item.type === 'function_call' || item.type === 'custom_tool_call') {
        const id = item.call_id || item.id;
        if (id && item.name) {
          callIdToNameMap.set(id, item.name);
        }
      }
    }

    // Step 2: Convert each input item into Gemini content turns
    for (const item of body.input || []) {
      if (item.type === 'message' || !item.type) {
        const role: 'user' | 'model' = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
        let text = '';
        if (typeof item.content === 'string') {
          text = item.content;
        } else if (Array.isArray(item.content)) {
          text = item.content
            .map((c: any) => (typeof c === 'string' ? c : c.text || c.input_text || JSON.stringify(c)))
            .join('\n');
        } else if (item.content && typeof item.content === 'object') {
          text = item.content.text || item.content.input_text || JSON.stringify(item.content);
        }
        if (text) {
          rawContents.push({ role, parts: [{ text }] });
        }
      } else if (item.type === 'function_call' || item.type === 'custom_tool_call') {
        const id = item.call_id || item.id;
        const name = item.name || (id ? callIdToNameMap.get(id) : null) || 'unknown_tool';
        let args = item.arguments || item.input || {};
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch {
            args = { raw_args: args };
          }
        }
        const cachedSig = ThoughtSignatureCache.get(id, name);
        const sig = item.thought_signature || item.thought_signature_base64 || item.thoughtSignature || cachedSig;
        const partObj: any = {
          functionCall: {
            name,
            args: typeof args === 'object' && args !== null ? args : {}
          }
        };
        if (sig && typeof sig === 'string' && sig.trim().length > 0) {
          partObj.thought_signature = sig.trim();
        }
        rawContents.push({
          role: 'model',
          parts: [partObj]
        });
      } else if (item.type === 'function_call_output' || item.type === 'custom_tool_call_output') {
        const id = item.call_id || item.id;
        // CRITICAL: Look up the original function name using callIdToNameMap
        const name = item.name || (id ? callIdToNameMap.get(id) : null) || 'tool';
        
        let responseObj: Record<string, any> = {};
        if (item.output && typeof item.output === 'object' && !Array.isArray(item.output)) {
          responseObj = item.output;
        } else if (typeof item.output === 'string') {
          try {
            const parsed = JSON.parse(item.output);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              responseObj = parsed;
            } else {
              responseObj = { output: item.output };
            }
          } catch {
            responseObj = { output: item.output };
          }
        } else {
          responseObj = { output: String(item.output ?? '') };
        }

        rawContents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name,
                response: responseObj
              }
            }
          ]
        });
      }
    }

    // Step 3: Merge consecutive contents of the same role (required by Gemini API)
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

    // Step 4: Ensure contents starts with user role if needed
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    let tools: any = undefined;
    if (body.tools) {
      tools = ToolsConverter.openAiToolsToGemini(body.tools);
    }

    const generationConfig: any = {};
    if (typeof body.temperature === 'number') generationConfig.temperature = body.temperature;
    if (typeof body.top_p === 'number') generationConfig.topP = body.top_p;
    if (typeof body.max_tokens === 'number') generationConfig.maxOutputTokens = body.max_tokens;

    if (body.thinking) {
      const budget = body.thinking.thinkingBudget || body.thinking.budget_tokens || 4096;
      generationConfig.thinkingConfig = { thinkingBudget: budget };
    }

    return {
      model: targetModel,
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
      systemInstruction,
      tools,
      generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
    };
  }
}

