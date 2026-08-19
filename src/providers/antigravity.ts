import { BaseProvider, GeminiGenerateRequest, GeminiGenerateResponse, GeminiStreamChunk } from './base.js';
import { AccountItem, StorageService } from '../services/storage.js';
import { GoogleOAuthService } from './google-oauth.js';
import { ThoughtSignatureCache } from '../services/thought-signature-cache.js';

const ANTIGRAVITY_ENDPOINTS = [
  'https://cloudcode-pa.googleapis.com/v1internal',
  'https://daily-cloudcode-pa.googleapis.com/v1internal',
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal'
];

export class AntigravityProvider extends BaseProvider {
  public id: string;
  public name: string;
  public type = 'antigravity';
  private account: AccountItem;
  private storage: StorageService;
  private cachedProjectId?: string;

  constructor(account: AccountItem) {
    super();
    this.id = account.id;
    this.name = account.name;
    this.account = account;
    this.storage = StorageService.getInstance();
  }

  private hasValidStudioApiKey(): boolean {
    return !!(this.account.apiKey && this.account.apiKey.startsWith('AIzaSy'));
  }

  public async getValidAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.account.accessToken && this.account.accessTokenExpiresAt && this.account.accessTokenExpiresAt > now + 60000) {
      return this.account.accessToken;
    }

    if (!this.account.refreshToken) {
      if (this.account.accessToken) {
        return this.account.accessToken;
      }
      throw new Error(`Account [${this.account.name}] has no refresh_token or access_token configured.`);
    }

    const tokenData = await GoogleOAuthService.refreshAccessToken(
      this.account.refreshToken,
      this.account.clientId,
      this.account.clientSecret
    );

    this.account.accessToken = tokenData.accessToken;
    this.account.accessTokenExpiresAt = now + (tokenData.expiresIn * 1000);
    this.storage.saveAccount(this.account);

    return tokenData.accessToken;
  }

  public async getCloudaicompanionProject(token: string): Promise<string> {
    if (this.cachedProjectId) return this.cachedProjectId;

    for (const base of ANTIGRAVITY_ENDPOINTS) {
      try {
        const res = await fetch(`${base}:loadCodeAssist`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'antigravity/2.0'
          },
          body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } })
        });
        if (res.ok) {
          const data: any = await res.json();
          if (data.cloudaicompanionProject) {
            this.cachedProjectId = data.cloudaicompanionProject;
            return data.cloudaicompanionProject;
          }
        }
      } catch {}
    }
    return '';
  }

  private resolveUpstreamModel(model: string): string {
    const clean = model.replace(/^models\//, '');
    if (clean === 'gemini-3.7-flash' || clean === 'gemini-3.6-flash') return 'gemini-2.5-pro';
    if (clean === 'gemini-3.5-flash') return 'gemini-2.5-flash';
    if (clean === 'gemini-3.1-pro') return 'gemini-2.5-pro';
    if (clean === 'gemini-3.7-thinking') return 'gemini-2.5-pro';
    return clean;
  }

  private ensureThoughtSignatures(contents?: any[]): any[] | undefined {
    if (!contents || !Array.isArray(contents)) return contents;
    for (const c of contents) {
      if (c && Array.isArray(c.parts)) {
        for (const p of c.parts) {
          if (p && p.functionCall) {
            if (!p.thought_signature && !p.thoughtSignature && !p.functionCall.thought_signature) {
              const sig = ThoughtSignatureCache.get(undefined, p.functionCall.name);
              p.thought_signature = sig;
            }
          }
        }
      }
    }
    return contents;
  }

  private getCandidateModels(request: GeminiGenerateRequest): string[] {
    const targetModel = this.resolveUpstreamModel(request.model);
    const models = [targetModel];
    if (!models.includes('gemini-2.5-pro')) models.push('gemini-2.5-pro');
    if (!models.includes('gemini-2.5-flash')) models.push('gemini-2.5-flash');
    if (!models.includes('gemini-3.5-flash-low')) models.push('gemini-3.5-flash-low');
    return models;
  }

  public async generate(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
    if (this.hasValidStudioApiKey()) {
      const cleanModel = request.model.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${this.account.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: request.contents,
          systemInstruction: request.systemInstruction,
          tools: request.tools,
          generationConfig: request.generationConfig,
          safetySettings: request.safetySettings
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google AI Studio error (${res.status}): ${errText}`);
      }
      return (await res.json()) as GeminiGenerateResponse;
    }

    this.ensureThoughtSignatures(request.contents);

    let token = await this.getValidAccessToken();
    const projectId = await this.getCloudaicompanionProject(token);
    const modelsToTry = this.getCandidateModels(request);

    let lastError: any = null;
    for (const m of modelsToTry) {
      const payload: any = {
        model: m,
        userAgent: 'antigravity',
        request: {
          contents: request.contents,
          systemInstruction: request.systemInstruction,
          tools: request.tools,
          generationConfig: request.generationConfig,
          safetySettings: request.safetySettings
        }
      };
      if (projectId) {
        payload.project = projectId;
      }

      for (const base of ANTIGRAVITY_ENDPOINTS) {
        try {
          let res = await fetch(`${base}:generateContent`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'antigravity/2.0'
            },
            body: JSON.stringify(payload)
          });

          if (res.status === 401) {
            token = await this.getValidAccessToken(true);
            res = await fetch(`${base}:generateContent`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'antigravity/2.0'
              },
              body: JSON.stringify(payload)
            });
          }

          if (res.ok) {
            const data: any = await res.json();
            return (data.response || data) as GeminiGenerateResponse;
          }
          const errText = await res.text();
          lastError = new Error(`Antigravity error (${res.status}): ${errText}`);
        } catch (err) {
          lastError = err;
        }
      }
    }

    throw lastError || new Error('Antigravity upstream generate error');
  }

  public async streamGenerate(
    request: GeminiGenerateRequest,
    onChunk: (chunk: GeminiStreamChunk) => void
  ): Promise<GeminiGenerateResponse> {
    if (this.hasValidStudioApiKey()) {
      const cleanModel = request.model.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${this.account.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({
          contents: request.contents,
          systemInstruction: request.systemInstruction,
          tools: request.tools,
          generationConfig: request.generationConfig,
          safetySettings: request.safetySettings
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google AI Studio stream error (${res.status}): ${errText}`);
      }

      return this.parseStreamResponse(res, onChunk);
    }

    this.ensureThoughtSignatures(request.contents);

    let token = await this.getValidAccessToken();
    const projectId = await this.getCloudaicompanionProject(token);
    const modelsToTry = this.getCandidateModels(request);

    let lastError: any = null;
    for (const m of modelsToTry) {
      const payload: any = {
        model: m,
        userAgent: 'antigravity',
        request: {
          contents: request.contents,
          systemInstruction: request.systemInstruction,
          tools: request.tools,
          generationConfig: request.generationConfig,
          safetySettings: request.safetySettings
        }
      };
      if (projectId) {
        payload.project = projectId;
      }

      for (const base of ANTIGRAVITY_ENDPOINTS) {
        try {
          let res = await fetch(`${base}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'antigravity/2.0',
              'Accept': 'text/event-stream'
            },
            body: JSON.stringify(payload)
          });

          if (res.status === 401) {
            token = await this.getValidAccessToken(true);
            res = await fetch(`${base}:streamGenerateContent?alt=sse`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'antigravity/2.0',
                'Accept': 'text/event-stream'
              },
              body: JSON.stringify(payload)
            });
          }

          if (res.ok && res.body) {
            return await this.parseStreamResponse(res, onChunk);
          }
          const errText = await res.text();
          lastError = new Error(`Antigravity stream error (${res.status}): ${errText}`);
        } catch (err) {
          lastError = err;
        }
      }
    }

    throw lastError || new Error('Antigravity upstream stream error');
  }

  private async parseStreamResponse(
    res: any,
    onChunk: (chunk: GeminiStreamChunk) => void
  ): Promise<GeminiGenerateResponse> {
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
            const parsed = JSON.parse(jsonStr);
            const chunk = (parsed.response || parsed) as GeminiStreamChunk;
            if (chunk.error) {
              throw new Error(`Antigravity stream error (${chunk.error.code || 400}): ${chunk.error.message || JSON.stringify(chunk.error)}`);
            }
            onChunk(chunk);
            if (chunk.candidates) {
              fullResponse.candidates = chunk.candidates;
              for (const cand of chunk.candidates) {
                for (const p of cand.content?.parts || []) {
                  const sig = (p as any).thought_signature || (p as any).thoughtSignature || (p.functionCall as any)?.thought_signature || (p.functionCall as any)?.thoughtSignature;
                  if (sig) {
                    ThoughtSignatureCache.save(undefined, p.functionCall?.name, sig);
                  }
                }
              }
            }
            if (chunk.usageMetadata) {
              fullResponse.usageMetadata = chunk.usageMetadata;
            }
          } catch (e: any) {
            if (e.message?.startsWith('Antigravity stream error')) {
              throw e;
            }
          }
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        const jsonStr = buffer.trim().slice(6).trim();
        if (jsonStr !== '[DONE]') {
          const parsed = JSON.parse(jsonStr);
          const chunk = (parsed.response || parsed) as GeminiStreamChunk;
          onChunk(chunk);
        }
      } catch (e) {}
    }

    return fullResponse;
  }

  public async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      if (this.hasValidStudioApiKey()) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.account.apiKey}`);
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, message: `Google API 错误 (${res.status}): ${text}` };
        }
        return { ok: true, message: '连接测试成功！Google AI Studio API Key 有效可用。' };
      }

      const token = await this.getValidAccessToken();
      const projectId = await this.getCloudaicompanionProject(token);
      const userInfo = await GoogleOAuthService.verifyToken(token);

      return {
        ok: true,
        message: `✅ 连接测试成功！Antigravity 账号 [${userInfo.email || 'Google User'}] 状态正常 (Project: ${projectId || 'default'})，已免 Key 直连 Gemini 3.x。`
      };
    } catch (err: any) {
      return { ok: false, message: err.message || '连接失败' };
    }
  }
}
