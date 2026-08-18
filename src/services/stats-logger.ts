import { StorageService, RequestLogItem } from './storage.js';

export interface DashboardStats {
  totalRequests: number;
  totalTokens: number;
  totalErrors: number;
  successRate: number;
  avgLatencyMs: number;
  activeAccounts: number;
  healthyAccounts: number;
  activeKeys: number;
  modelUsage: Record<string, number>;
  hourlyRequests: Array<{ hour: string; count: number; tokens: number; errors: number }>;
}

export class StatsLoggerService {
  private static instance: StatsLoggerService;
  private storage: StorageService;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): StatsLoggerService {
    if (!StatsLoggerService.instance) {
      StatsLoggerService.instance = new StatsLoggerService();
    }
    return StatsLoggerService.instance;
  }

  public logRequest(log: Omit<RequestLogItem, 'id' | 'timestamp'>) {
    const fullLog: RequestLogItem = {
      ...log,
      id: 'req_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
      timestamp: Date.now()
    };
    this.storage.addLog(fullLog);
  }

  public getDashboardStats(): DashboardStats {
    const { logs } = this.storage.getLogs(2000, 0);
    const accounts = this.storage.getAccounts();
    const keys = this.storage.getApiKeys().filter(k => k.enabled);

    const totalRequests = logs.length;
    let totalTokens = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    const modelUsage: Record<string, number> = {};

    const now = Date.now();
    const activeAccounts = accounts.filter(a => a.enabled).length;
    const healthyAccounts = accounts.filter(a => a.enabled && (!a.cooldownUntil || a.cooldownUntil <= now)).length;

    // Bucket logs into last 24 hours
    const hourlyMap = new Map<string, { count: number; tokens: number; errors: number }>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now - i * 3600 * 1000);
      const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
      hourlyMap.set(hourStr, { count: 0, tokens: 0, errors: 0 });
    }

    for (const l of logs) {
      totalTokens += l.totalTokens || 0;
      totalLatency += l.latencyMs || 0;
      if (l.statusCode >= 400) {
        totalErrors++;
      }

      if (l.model) {
        modelUsage[l.model] = (modelUsage[l.model] || 0) + 1;
      }

      // Check if within last 24h
      if (now - l.timestamp <= 24 * 3600 * 1000) {
        const d = new Date(l.timestamp);
        const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
        const bucket = hourlyMap.get(hourStr);
        if (bucket) {
          bucket.count++;
          bucket.tokens += l.totalTokens || 0;
          if (l.statusCode >= 400) bucket.errors++;
        }
      }
    }

    const successRate = totalRequests > 0 ? Math.round(((totalRequests - totalErrors) / totalRequests) * 10000) / 100 : 100;
    const avgLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;

    const hourlyRequests = Array.from(hourlyMap.entries()).map(([hour, val]) => ({
      hour,
      ...val
    }));

    return {
      totalRequests,
      totalTokens,
      totalErrors,
      successRate,
      avgLatencyMs,
      activeAccounts,
      healthyAccounts,
      activeKeys: keys.length,
      modelUsage,
      hourlyRequests
    };
  }
}
