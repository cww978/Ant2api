export interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
}

export interface GeminiContent {
  role?: 'user' | 'model' | 'system';
  parts: GeminiContentPart[];
}

export interface GeminiToolDeclaration {
  functionDeclarations?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  }>;
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: Record<string, any>;
  candidateCount?: number;
}

export interface GeminiGenerateRequest {
  model: string;
  contents: GeminiContent[];
  systemInstruction?: GeminiContent;
  tools?: GeminiToolDeclaration[];
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

export interface GeminiCandidate {
  content: {
    role: 'model';
    parts: GeminiContentPart[];
  };
  finishReason?: string;
  index?: number;
  safetyRatings?: any[];
  groundingMetadata?: any;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  error?: {
    code: number;
    message: string;
    status?: string;
  };
}

export interface GeminiStreamChunk extends GeminiGenerateResponse {}

export abstract class BaseProvider {
  public abstract id: string;
  public abstract name: string;
  public abstract type: string;

  public abstract generate(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse>;
  public abstract streamGenerate(
    request: GeminiGenerateRequest,
    onChunk: (chunk: GeminiStreamChunk) => void
  ): Promise<GeminiGenerateResponse>;
  public abstract healthCheck(): Promise<{ ok: boolean; message?: string }>;
}
