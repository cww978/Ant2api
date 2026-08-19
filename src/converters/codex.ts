import { GeminiGenerateRequest, GeminiGenerateResponse, GeminiContent, GeminiContentPart } from '../providers/base.js';
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
        if (part.text && !(part as any).thought) {
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
   * Normalizes tool arguments for standard tools like shell, bash, local_shell
   */
  private static normalizeToolArgs(name: string, rawArgs: any): any {
    let args = rawArgs;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        args = { raw_args: args };
      }
    }
    if (typeof args !== 'object' || args === null) {
      args = {};
    }

    const cleanName = name.replace(/^(local_shell_call|shell|bash|local_shell)$/, 'shell');
    if (cleanName === 'shell' && typeof args === 'object') {
      if (!args.command) {
        for (const altKey of ['cmd', 'code', 'script', 'shell_command']) {
          if (args[altKey]) {
            args.command = args[altKey];
            delete args[altKey];
            break;
          }
        }
      }
    }

    return args;
  }

  /**
   * Parses markdown images or base64 image urls into Gemini parts
   */
  private static parseContentBlocks(content: any): GeminiContentPart[] {
    const parts: GeminiContentPart[] = [];
    if (!content) return parts;

    if (typeof content === 'string') {
      parts.push({ text: content });
      return parts;
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'string') {
          parts.push({ text: item });
        } else if (typeof item === 'object' && item !== null) {
          if (item.type === 'text' || item.type === 'input_text' || item.text) {
            parts.push({ text: item.text || item.input_text || '' });
          } else if (item.type === 'image_url' || item.type === 'input_image') {
            const url = typeof item.image_url === 'string' ? item.image_url : (item.image_url?.url || item.url || '');
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
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
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
    } else if (typeof content === 'object') {
      const text = content.text || content.input_text || JSON.stringify(content);
      parts.push({ text });
    }

    return parts;
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
      const toolGuidance = `You are an expert autonomous AI software engineer and coding assistant integrated into an IDE. You have access to tools for interacting with files and the workspace (such as read_file, view_file, list_dir, file_search, grep_search, apply_patch, edit_file, write_file, shell, run_command, etc.).

CRITICAL AUTONOMOUS EXECUTION & TOOL INVOCATION RULES:
1. Immediate Tool Execution: Whenever you decide you need to read, view, search, list, or examine any files or directory structures to analyze or solve the user's request, you MUST immediately invoke the appropriate function call(s) in THIS turn.
2. NO Conversational Delays/Promises: NEVER output conversational text stating what files you plan to read in the future (e.g., NEVER say "请稍等，我将查看以下文件", "我先查阅一些核心文件", "Wait while I inspect..."). Instead, invoke the tool call directly right now.
3. Multi-Step Exploration: You operate in an autonomous agent loop. Proactively call tools in every step until you have gathered all necessary information.
4. MANDATORY apply_patch TOOL INVOCATION FOR CODE EDITS:
   - When asked to modify, create, edit, optimize, or patch any code or document, you MUST execute the \`apply_patch\` tool function call with the patch string as the \`patch\` parameter!
   - ABSOLUTELY NEVER output \`*** Begin Patch\` or markdown diff code blocks into your conversational text!
   - NEVER say "请应用以下补丁" in text. You MUST apply it directly by calling the \`apply_patch\` function.`;
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
        const name = item.name === 'local_shell_call' ? 'shell' : (item.name === 'apply_patch_call' ? 'apply_patch' : item.name);
        if (id && name) {
          callIdToNameMap.set(id, name);
        }
      }
    }

    // Step 2: Convert each input item into Gemini content turns
    const inputItems = body.input || [];
    for (let idx = 0; idx < inputItems.length; idx++) {
      const item = inputItems[idx];

      if (item.type === 'message' || !item.type) {
        let role: 'user' | 'model' = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';

        // Rewrite terminal plain-text assistant prefill to 'user' so Gemini doesn't reject
        if (idx === inputItems.length - 1 && role === 'model') {
          role = 'user';
        }

        const parts = this.parseContentBlocks(item.content);
        if (parts.length > 0) {
          rawContents.push({ role, parts });
        }
      } else if (item.type === 'function_call' || item.type === 'custom_tool_call') {
        const id = item.call_id || item.id;
        let name = item.name || (id ? callIdToNameMap.get(id) : null) || 'unknown_tool';
        if (name === 'local_shell_call') name = 'shell';
        if (name === 'apply_patch_call') name = 'apply_patch';

        let args = item.arguments || item.input || {};
        args = this.normalizeToolArgs(name, args);

        const sig = item.thought_signature || item.thought_signature_base64 || item.thoughtSignature || ThoughtSignatureCache.getOrSentinel(id, name);

        const partObj: any = {
          functionCall: {
            name,
            args
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
        let name = item.name || (id ? callIdToNameMap.get(id) : null) || 'tool';
        if (name === 'local_shell_call') name = 'shell';
        if (name === 'apply_patch_call') name = 'apply_patch';

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

    const generationConfig: any = {
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
      topP: typeof body.top_p === 'number' ? body.top_p : 1.0,
      topK: 40
    };

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
      generationConfig
    };
  }
}
