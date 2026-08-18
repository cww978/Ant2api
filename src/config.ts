import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

// Load environment variables from .env if present
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  adminPassword: string;
  jwtSecret: string;
  dataDir: string;
  requestTimeoutMs: number;
  defaultModel: string;
  proxyUrl?: string;
  debug: boolean;
}

const defaultDataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(defaultDataDir)) {
  fs.mkdirSync(defaultDataDir, { recursive: true });
}

const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy || undefined;

export function setupGlobalProxy(customProxy?: string) {
  const target = customProxy || envProxy;
  if (target) {
    try {
      const formatted = target.startsWith('http://') || target.startsWith('https://') ? target : `http://${target}`;
      const proxyAgent = new ProxyAgent(formatted);
      setGlobalDispatcher(proxyAgent);
      console.log(`[Network] Outbound ProxyAgent enabled: ${formatted}`);
    } catch (err: any) {
      console.warn(`[Network] Failed to set proxy: ${err.message}`);
    }
  }
}

// Initialize on startup
setupGlobalProxy();

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  adminPassword: process.env.ADMIN_PASSWORD || 'ant2api_admin',
  jwtSecret: process.env.JWT_SECRET || 'ant2api-secret-key-change-in-prod',
  dataDir: process.env.DATA_DIR || defaultDataDir,
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '120000', 10),
  defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-pro',
  proxyUrl: envProxy,
  debug: process.env.DEBUG === 'true' || false,
};
