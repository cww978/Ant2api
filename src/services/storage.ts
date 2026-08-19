import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

export interface AccountItem {
  id: string;
  name: string;
  type: 'antigravity' | 'gemini_cli' | 'gemini_api' | 'google_oauth';
  enabled: boolean;
  // OAuth credentials
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  clientId?: string;
  clientSecret?: string;
  // Session cookie credentials
  cookie?: string;
  // Google API Key
  apiKey?: string;
  // Project / Endpoint settings
  projectId?: string;
  endpoint?: string;
  // Stats & Health
  lastUsedAt?: number;
  totalRequests: number;
  failedRequests: number;
  consecutiveErrors: number;
  cooldownUntil?: number;
  createdAt: number;
  notes?: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  allowedModels: string[]; // empty array means all models
  rateLimitPerMin: number; // 0 = unlimited
  quotaTokens: number; // 0 = unlimited
  usedTokens: number;
  totalRequests: number;
  createdAt: number;
  expiresAt?: number; // 0 or undefined = never expires
}

export interface ModelMappingItem {
  id: string;
  sourceModel: string; // e.g. "gpt-4o"
  targetModel: string; // e.g. "gemini-2.5-pro"
  description?: string;
  enabled: boolean;
}

export interface RequestLogItem {
  id: string;
  timestamp: number;
  protocol: 'openai' | 'gemini' | 'codex' | 'admin';
  endpoint: string;
  model: string;
  mappedModel?: string;
  statusCode: number;
  latencyMs: number;
  stream: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  apiKeyName?: string;
  accountId?: string;
  accountName?: string;
  clientIp?: string;
  errorMessage?: string;
}

export interface ProxyServiceSettings {
  port: number;
  host: string;
  allowLan: boolean;
  timeoutSeconds: number;
  autoStart: boolean;
  authEnabled: boolean;
  authMode: 'auto' | 'strict' | 'disabled';
  masterApiKey: string;
  adminPassword?: string;
  userAgentOverride: boolean;
  customUserAgent: string;
}

export interface SystemSettings {
  adminPasswordHash?: string;
  loadBalanceStrategy: 'round_robin' | 'least_errors' | 'random';
  maxCooldownSeconds: number;
  enablePublicRegistration: boolean;
  proxyUrl?: string;
  customSystemPrompt?: string;
  enableDebugLogs: boolean;
  proxySettings?: ProxyServiceSettings;
}

export interface StorageData {
  accounts: AccountItem[];
  apiKeys: ApiKeyItem[];
  modelMappings: ModelMappingItem[];
  settings: SystemSettings;
  logs: RequestLogItem[];
  proxySettings?: ProxyServiceSettings;
}

export const DEFAULT_PROXY_SETTINGS: ProxyServiceSettings = {
  port: config.proxyPort || 8045,
  host: config.proxyHost || '127.0.0.1',
  allowLan: false,
  timeoutSeconds: Math.floor(config.requestTimeoutMs / 1000) || 120,
  autoStart: true,
  authEnabled: true,
  authMode: 'auto',
  masterApiKey: 'sk-ant2api-default-master-key',
  adminPassword: config.adminPassword || 'ant2api_admin',
  userAgentOverride: true,
  customUserAgent: config.defaultUserAgent || 'antigravity/1.15.8 darwin/arm64'
};

const DEFAULT_MODEL_MAPPINGS: ModelMappingItem[] = [
  // OpenAI alias mappings
  { id: '1', sourceModel: 'gpt-4o', targetModel: 'gemini-3.7-flash', description: 'OpenAI GPT-4o -> Gemini 3.7 Flash', enabled: true },
  { id: '2', sourceModel: 'gpt-4o-mini', targetModel: 'gemini-3.5-flash', description: 'OpenAI GPT-4o-mini -> Gemini 3.5 Flash', enabled: true },
  { id: '3', sourceModel: 'gpt-4-turbo', targetModel: 'gemini-3.7-flash', description: 'OpenAI GPT-4 Turbo -> Gemini 3.7 Flash', enabled: true },
  { id: '4', sourceModel: 'gpt-4', targetModel: 'gemini-3.1-pro', description: 'OpenAI GPT-4 -> Gemini 3.1 Pro', enabled: true },
  { id: '5', sourceModel: 'gpt-3.5-turbo', targetModel: 'gemini-3.5-flash', description: 'OpenAI GPT-3.5 Turbo -> Gemini 3.5 Flash', enabled: true },
  { id: '6', sourceModel: 'o1', targetModel: 'gemini-3.7-thinking', description: 'Reasoning -> Gemini 3.7 Thinking', enabled: true },
  { id: '7', sourceModel: 'o3-mini', targetModel: 'gemini-3.7-thinking', description: 'Reasoning -> Gemini 3.7 Thinking', enabled: true }
];

export class StorageService {
  private static instance: StorageService;
  private filePath: string;
  private data: StorageData;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.filePath = path.join(config.dataDir, 'ant2api_db.json');
    this.data = this.loadData();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private loadData(): StorageData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          accounts: parsed.accounts || [],
          apiKeys: parsed.apiKeys || [],
          modelMappings: parsed.modelMappings || DEFAULT_MODEL_MAPPINGS,
          settings: parsed.settings || {
            loadBalanceStrategy: 'round_robin',
            maxCooldownSeconds: 60,
            enablePublicRegistration: false,
            enableDebugLogs: config.debug
          },
          logs: parsed.logs || [],
          proxySettings: parsed.proxySettings || parsed.settings?.proxySettings || DEFAULT_PROXY_SETTINGS
        };
      }
    } catch (err) {
      console.error('[Storage] Failed to read database file, initializing defaults:', err);
    }

    // Default initialization
    const initialData: StorageData = {
      accounts: [],
      apiKeys: [
        {
          id: crypto.randomUUID(),
          name: 'Default Root Key',
          key: 'sk-ant2api-' + crypto.randomBytes(16).toString('hex'),
          enabled: true,
          allowedModels: [],
          rateLimitPerMin: 0,
          quotaTokens: 0,
          usedTokens: 0,
          totalRequests: 0,
          createdAt: Date.now()
        }
      ],
      modelMappings: DEFAULT_MODEL_MAPPINGS,
      settings: {
        loadBalanceStrategy: 'round_robin',
        maxCooldownSeconds: 60,
        enablePublicRegistration: false,
        enableDebugLogs: config.debug
      },
      logs: [],
      proxySettings: DEFAULT_PROXY_SETTINGS
    };
    this.saveDataImmediate(initialData);
    return initialData;
  }

  private saveDataImmediate(dataToSave: StorageData) {
    try {
      const tempPath = this.filePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[Storage] Error persisting data to disk:', err);
    }
  }

  public scheduleSave() {
    if (this.saveTimeout) {
      return;
    }
    this.saveTimeout = setTimeout(() => {
      this.saveDataImmediate(this.data);
      this.saveTimeout = null;
    }, 500);
  }

  public getAccounts(): AccountItem[] {
    return this.data.accounts;
  }

  public getAccountById(id: string): AccountItem | undefined {
    return this.data.accounts.find(a => a.id === id);
  }

  public saveAccount(account: AccountItem): AccountItem {
    const idx = this.data.accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      this.data.accounts[idx] = account;
    } else {
      this.data.accounts.push(account);
    }
    this.scheduleSave();
    return account;
  }

  public deleteAccount(id: string): boolean {
    const before = this.data.accounts.length;
    this.data.accounts = this.data.accounts.filter(a => a.id !== id);
    if (this.data.accounts.length !== before) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  public getApiKeys(): ApiKeyItem[] {
    return this.data.apiKeys;
  }

  public getApiKey(keyString: string): ApiKeyItem | undefined {
    return this.data.apiKeys.find(k => k.key === keyString && k.enabled);
  }

  public saveApiKey(key: ApiKeyItem): ApiKeyItem {
    const idx = this.data.apiKeys.findIndex(k => k.id === key.id);
    if (idx >= 0) {
      this.data.apiKeys[idx] = key;
    } else {
      this.data.apiKeys.push(key);
    }
    this.scheduleSave();
    return key;
  }

  public deleteApiKey(id: string): boolean {
    const before = this.data.apiKeys.length;
    this.data.apiKeys = this.data.apiKeys.filter(k => k.id !== id);
    if (this.data.apiKeys.length !== before) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  public getModelMappings(): ModelMappingItem[] {
    return this.data.modelMappings;
  }

  public saveModelMapping(mapping: ModelMappingItem): ModelMappingItem {
    const idx = this.data.modelMappings.findIndex(m => m.id === mapping.id);
    if (idx >= 0) {
      this.data.modelMappings[idx] = mapping;
    } else {
      this.data.modelMappings.push(mapping);
    }
    this.scheduleSave();
    return mapping;
  }

  public deleteModelMapping(id: string): boolean {
    const before = this.data.modelMappings.length;
    this.data.modelMappings = this.data.modelMappings.filter(m => m.id !== id);
    if (this.data.modelMappings.length !== before) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  public getSettings(): SystemSettings {
    return this.data.settings;
  }

  public updateSettings(newSettings: Partial<SystemSettings>): SystemSettings {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.scheduleSave();
    return this.data.settings;
  }

  public getProxySettings(): ProxyServiceSettings {
    if (!this.data.proxySettings) {
      this.data.proxySettings = { ...DEFAULT_PROXY_SETTINGS };
    }
    return this.data.proxySettings;
  }

  public updateProxySettings(newSettings: Partial<ProxyServiceSettings>): ProxyServiceSettings {
    const current = this.getProxySettings();
    this.data.proxySettings = { ...current, ...newSettings };
    this.scheduleSave();
    return this.data.proxySettings;
  }

  public addLog(log: RequestLogItem) {
    this.data.logs.unshift(log);
    // Keep at most 2000 recent logs in memory/disk
    if (this.data.logs.length > 2000) {
      this.data.logs = this.data.logs.slice(0, 2000);
    }
    this.scheduleSave();
  }

  public getLogs(
    limit = 20,
    offset = 0,
    search?: string,
    statusFilter?: string
  ): { logs: RequestLogItem[]; total: number } {
    let filtered = this.data.logs;

    if (statusFilter === '200' || statusFilter === 'success') {
      filtered = filtered.filter(l => l.statusCode === 200);
    } else if (statusFilter === 'error') {
      filtered = filtered.filter(l => l.statusCode !== 200);
    }

    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(l =>
        (l.model && l.model.toLowerCase().includes(q)) ||
        (l.mappedModel && l.mappedModel.toLowerCase().includes(q)) ||
        (l.endpoint && l.endpoint.toLowerCase().includes(q)) ||
        (l.protocol && l.protocol.toLowerCase().includes(q)) ||
        (l.clientIp && l.clientIp.toLowerCase().includes(q)) ||
        (l.accountName && l.accountName.toLowerCase().includes(q)) ||
        (l.apiKeyName && l.apiKeyName.toLowerCase().includes(q)) ||
        String(l.statusCode).includes(q)
      );
    }

    const total = filtered.length;
    const logs = filtered.slice(offset, offset + limit);
    return { logs, total };
  }

  public clearLogs() {
    this.data.logs = [];
    this.scheduleSave();
  }

  public getAllData(): StorageData {
    return this.data;
  }

  public importData(imported: StorageData) {
    if (imported.accounts) this.data.accounts = imported.accounts;
    if (imported.apiKeys) this.data.apiKeys = imported.apiKeys;
    if (imported.modelMappings) this.data.modelMappings = imported.modelMappings;
    if (imported.settings) this.data.settings = { ...this.data.settings, ...imported.settings };
    this.scheduleSave();
  }
}
