import { GeminiGenerateRequest } from '../providers/base.js';

export class GeminiConverter {
  public static normalizeRequest(body: any, targetModel: string): GeminiGenerateRequest {
    return {
      model: targetModel,
      contents: Array.isArray(body.contents) ? body.contents : [],
      systemInstruction: body.systemInstruction,
      tools: body.tools,
      generationConfig: body.generationConfig,
      safetySettings: body.safetySettings
    };
  }
}
