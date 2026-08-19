export interface QuotaInfo {
  name: string;
  percentage?: string;
  resetIn?: string;
  resetTime?: string;
  remainingFraction?: number;
}

export interface AccountItem {
  id: string;
  name: string;
  email?: string;
  userName?: string;
  tier?: string;
  quotas?: Record<string, QuotaInfo>;
  refreshToken?: string;
  accessToken?: string;
  projectId?: string;
  enabled: boolean;
  lastUsedAt?: string;
  totalRequests: number;
  failedRequests: number;
  coolingUntil?: number;
}

export interface ApiKeyItem {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  rateLimitRPM?: number;
  rateLimitPerMin?: number;
  allowedModels?: string[];
  modelsAllowed?: string[];
  totalUsage?: number;
  totalRequests?: number;
  createdAt?: string | number;
}

export interface ModelMapping {
  id?: string;
  sourceModel?: string;
  targetModel?: string;
  fromModel?: string;
  toModel?: string;
  description?: string;
  enabled?: boolean;
}

export interface RequestLogItem {
  id: string;
  timestamp: number;
  protocol?: 'openai' | 'gemini' | 'codex' | 'admin' | string;
  method?: string;
  endpoint?: string;
  path?: string;
  model?: string;
  mappedModel?: string;
  accountEmail?: string;
  accountName?: string;
  accountId?: string;
  apiKeyName?: string;
  statusCode: number;
  latencyMs: number;
  stream?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  tokensUsed?: number;
  clientIp?: string;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
}

export interface AppConfig {
  port: number;
  authMode: 'auto' | 'strict' | 'disabled';
  proxyTimeout: number;
  masterKey: string;
  uiPassword?: string;
  allowLanAccess?: boolean;
  userAgentOverride?: string;
  outboundProxy?: string;
  loadBalancingStrategy?: 'round-robin' | 'least-errors' | 'random';
  status?: string;
  activePort?: number;
  uptime?: number;
  proxyStatus?: {
    running: boolean;
    uptimeSeconds: number;
    error: string | null;
  };
}

export interface DashboardStats {
  totalRequests: number;
  totalTokens: number;
  totalErrors?: number;
  successRate?: number;
  avgLatencyMs?: number;
  qps?: number;
  activeAccounts?: number;
  healthyAccounts?: number;
  activeKeys?: number;
  modelUsage?: Record<string, number>;
  hourlyRequests?: Array<{ hour: string; count: number; tokens: number; errors: number }>;
}

export type ActiveTab =
  | 'overview'
  | 'service'
  | 'accounts'
  | 'keys'
  | 'mappings'
  | 'logs'
  | 'settings';
