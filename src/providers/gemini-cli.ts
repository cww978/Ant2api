import { BaseProvider, GeminiGenerateRequest, GeminiGenerateResponse, GeminiStreamChunk } from './base.js';
import { AccountItem, StorageService } from '../services/storage.js';
import { GoogleOAuthService } from './google-oauth.js';

export class GeminiCliProvider extends BaseProvider {
  public id: string;
  public name: string;
  public type = 'gemini_cli';
  private account: AccountItem;
  private storage: StorageService;

  constructor(account: AccountItem) {
    super();
    this.id = account.id;
    this.name = account.name;
    this.account = account;
    this.storage = StorageService.getInstance();
  }

  private async getAuthHeader(): Promise<{ header: Record<string, string>; queryKey?: string }> {
    // If API Key is provided
    if (this.account.apiKey) {
      return { header: {}, queryKey: this.account.apiKey };
    }

    const now = Date.now();
    if (this.account.accessToken && this.account.accessTokenExpiresAt && this.account.accessTokenExpiresAt > now + 60000) {
      return { header: { Authorization: `Bearer ${this.account.accessToken}` } };
    }

    if (this.account.refreshToken) {
      const tokenData = await GoogleOAuthService.refreshAccessToken(
        this.account.refreshToken,
        this.account.clientId,
        this.account.clientSecret
      );
      this.account.accessToken = tokenData.accessToken;
      this.account.accessTokenExpiresAt = now + (tokenData.expiresIn * 1000);
      this.storage.saveAccount(this.account);

      return { header: { Authorization: `Bearer ${tokenData.accessToken}` } };
    }

    if (this.account.accessToken) {
      return { header: { Authorization: `Bearer ${this.account.accessToken}` } };
    }

    throw new Error(`GeminiCLI account [${this.account.name}] has neither apiKey nor OAuth token.`);
  }

  private getUrl(model: string, stream = false, queryKey?: string): string {
    const cleanModel = model.replace(/^models\//, '');
    const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:${action}`;
    if (queryKey) {
      url += (url.includes('?') ? '&' : '?') + `key=${queryKey}`;
    }
    return url;
  }

  public async generate(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
    const { header, queryKey } = await this.getAuthHeader();
    const url = this.getUrl(request.model, false, queryKey);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GeminiCLI/1.0.0 (Darwin; x86_64)',
      'x-goog-api-client': 'gl-python/3.10.0 grpc/1.59.0 gax/2.12.0 gapic/0.1.0',
      ...header
    };

    const payload = {
      contents: request.contents,
      systemInstruction: request.systemInstruction,
      tools: request.tools,
      generationConfig: request.generationConfig,
      safetySettings: request.safetySettings
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GeminiCLI upstream error (${res.status}): ${errText}`);
    }

    return (await res.json()) as GeminiGenerateResponse;
  }

  public async streamGenerate(
    request: GeminiGenerateRequest,
    onChunk: (chunk: GeminiStreamChunk) => void
  ): Promise<GeminiGenerateResponse> {
    const { header, queryKey } = await this.getAuthHeader();
    const url = this.getUrl(request.model, true, queryKey);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GeminiCLI/1.0.0 (Darwin; x86_64)',
      'x-goog-api-client': 'gl-python/3.10.0 grpc/1.59.0 gax/2.12.0 gapic/0.1.0',
      'Accept': 'text/event-stream',
      ...header
    };

    const payload = {
      contents: request.contents,
      systemInstruction: request.systemInstruction,
      tools: request.tools,
      generationConfig: request.generationConfig,
      safetySettings: request.safetySettings
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GeminiCLI upstream stream error (${res.status}): ${errText}`);
    }

    if (!res.body) {
      throw new Error('GeminiCLI upstream response body is empty');
    }

    let fullResponse: GeminiGenerateResponse = { candidates: [] };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const chunk = JSON.parse(jsonStr) as GeminiStreamChunk;
            onChunk(chunk);
            if (chunk.candidates) {
              fullResponse.candidates = chunk.candidates;
            }
            if (chunk.usageMetadata) {
              fullResponse.usageMetadata = chunk.usageMetadata;
            }
          } catch (e) {
            // Ignore partial parse error
          }
        }
      }
    }

    return fullResponse;
  }

  public async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      const { header, queryKey } = await this.getAuthHeader();
      if (queryKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${queryKey}`;
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          let errMsg = text;
          try {
            const parsed = JSON.parse(text);
            errMsg = parsed.error?.message || text;
          } catch {}
          return { ok: false, message: `Gemini API Key 错误: ${errMsg}` };
        }
        return { ok: true, message: '连接测试成功！Gemini API Key 验证通过。' };
      }

      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: header });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, message: `OAuth 验证失败 (${res.status}): ${text}` };
      }
      const userInfo = (await res.json()) as { email?: string; name?: string };
      return { ok: true, message: `连接测试成功！已认证 GeminiCLI 账号: ${userInfo.email || 'Google User'}` };
    } catch (err: any) {
      return { ok: false, message: err.message || '连接失败' };
    }
  }
}
