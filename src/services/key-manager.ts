import { StorageService, ApiKeyItem } from './storage.js';

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

export class KeyManagerService {
  private static instance: KeyManagerService;
  private storage: StorageService;
  private rateLimits: Map<string, RateLimitTracker> = new Map();

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): KeyManagerService {
    if (!KeyManagerService.instance) {
      KeyManagerService.instance = new KeyManagerService();
    }
    return KeyManagerService.instance;
  }

  /**
   * Validates an API Key string, checks expiry, quotas, and model restrictions
   */
  public validateKey(
    keyString: string,
    requestedModel?: string
  ): { valid: boolean; keyItem?: ApiKeyItem; error?: string } {
    if (!keyString) {
      return { valid: false, error: 'Missing API key in Authorization header' };
    }

    const cleanKey = keyString.replace(/^Bearer\s+/i, '').trim();
    const keyItem = this.storage.getApiKey(cleanKey);

    if (!keyItem) {
      return { valid: false, error: 'Invalid or disabled API key' };
    }

    // Check expiration
    if (keyItem.expiresAt && keyItem.expiresAt > 0 && Date.now() > keyItem.expiresAt) {
      return { valid: false, error: 'API key has expired' };
    }

    // Check quota
    if (keyItem.quotaTokens > 0 && keyItem.usedTokens >= keyItem.quotaTokens) {
      return { valid: false, error: 'API key quota limit exceeded' };
    }

    // Check allowed models
    if (
      requestedModel &&
      keyItem.allowedModels &&
      keyItem.allowedModels.length > 0 &&
      !keyItem.allowedModels.includes(requestedModel)
    ) {
      return {
        valid: false,
        error: `Model '${requestedModel}' is not permitted for this API key`
      };
    }

    // Check rate limit per minute
    if (keyItem.rateLimitPerMin > 0) {
      const now = Date.now();
      let tracker = this.rateLimits.get(keyItem.id);
      if (!tracker || now > tracker.resetAt) {
        tracker = { count: 1, resetAt: now + 60000 };
        this.rateLimits.set(keyItem.id, tracker);
      } else {
        if (tracker.count >= keyItem.rateLimitPerMin) {
          return { valid: false, error: 'Rate limit exceeded. Please slow down your requests.' };
        }
        tracker.count++;
      }
    }

    return { valid: true, keyItem };
  }

  /**
   * Records usage tokens and request count for a given API Key
   */
  public recordUsage(keyId: string, tokens: number) {
    const key = this.storage.getApiKeys().find(k => k.id === keyId);
    if (!key) return;

    key.usedTokens = (key.usedTokens || 0) + tokens;
    key.totalRequests = (key.totalRequests || 0) + 1;
    this.storage.saveApiKey(key);
  }

  public getAllKeys(): ApiKeyItem[] {
    return this.storage.getApiKeys();
  }
}
