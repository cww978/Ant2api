import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { adminAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { StorageService, AccountItem, ApiKeyItem, ModelMappingItem, ProxyServiceSettings } from '../services/storage.js';
import { StatsLoggerService } from '../services/stats-logger.js';
import { GoogleOAuthService, DEFAULT_OAUTH_CLIENT_ID, DEFAULT_OAUTH_CLIENT_SECRET } from '../providers/google-oauth.js';
import { AccountPoolService } from '../services/account-pool.js';
import { ProxyLifecycleService } from '../services/proxy-lifecycle.js';
import { CliSyncService } from '../services/cli-sync.js';
import { config, setupGlobalProxy } from '../config.js';

const router = Router();
const storage = StorageService.getInstance();
const statsLogger = StatsLoggerService.getInstance();
const accountPool = AccountPoolService.getInstance();

// POST /api/admin/login
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  if (password === config.adminPassword || password === config.jwtSecret) {
    return res.json({
      success: true,
      token: config.adminPassword,
      message: 'Login successful'
    });
  }

  return res.status(401).json({ success: false, message: 'Incorrect admin password' });
});

// GET /api/admin/stats
router.get('/stats', adminAuth, (req: Request, res: Response) => {
  const stats = statsLogger.getDashboardStats();
  return res.json({ success: true, data: stats });
});

// Accounts Management
router.get('/accounts', adminAuth, async (req: Request, res: Response) => {
  let accounts = storage.getAccounts();
  const needsEnrich = accounts.some(a => !a.email || !a.quotas);
  if (needsEnrich) {
    accounts = await accountPool.enrichAllAccounts();
  }
  return res.json({ success: true, data: accounts });
});

router.post('/accounts/sync-all', adminAuth, async (req: Request, res: Response) => {
  try {
    const accounts = await accountPool.enrichAllAccounts();
    return res.json({ success: true, message: '所有账号配额与信息同步成功', data: accounts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/accounts', adminAuth, async (req: Request, res: Response) => {
  const body = req.body;
  if (!body.name) {
    return res.status(400).json({ success: false, message: 'Account name is required' });
  }

  const account: AccountItem = {
    id: body.id || `acc_${crypto.randomUUID()}`,
    name: body.name,
    type: body.type || 'antigravity',
    enabled: body.enabled !== false,
    refreshToken: body.refreshToken?.trim() || undefined,
    accessToken: body.accessToken?.trim() || undefined,
    clientId: body.clientId?.trim() || DEFAULT_OAUTH_CLIENT_ID,
    clientSecret: body.clientSecret?.trim() || DEFAULT_OAUTH_CLIENT_SECRET,
    cookie: body.cookie?.trim() || undefined,
    apiKey: body.apiKey?.trim() || undefined,
    projectId: body.projectId?.trim() || undefined,
    endpoint: body.endpoint?.trim() || undefined,
    notes: body.notes || '',
    totalRequests: body.totalRequests || 0,
    failedRequests: body.failedRequests || 0,
    consecutiveErrors: 0,
    createdAt: body.createdAt || Date.now()
  };

  storage.saveAccount(account);
  // Enrich in background / immediately
  await accountPool.enrichAccountMetadata(account);
  const updated = storage.getAccountById(account.id) || account;
  return res.json({ success: true, data: updated });
});

router.delete('/accounts/:id', adminAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const deleted = storage.deleteAccount(id);
  return res.json({ success: deleted });
});

router.post('/accounts/:id/test', adminAuth, async (req: Request, res: Response) => {
  const id = req.params.id;
  const account = storage.getAccountById(id);
  if (!account) {
    return res.status(404).json({ success: false, message: 'Account not found' });
  }

  try {
    const provider = accountPool.createProvider(account);
    const result = await provider.healthCheck();
    await accountPool.enrichAccountMetadata(account);
    return res.json({
      success: result.ok,
      message: result.message || (result.ok ? '连接测试通过！' : '连接失败，上游返回异常。')
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/accounts/:id/refresh', adminAuth, async (req: Request, res: Response) => {
  const id = req.params.id;
  const account = storage.getAccountById(id);
  if (!account) {
    return res.status(404).json({ success: false, message: 'Account not found' });
  }

  if (!account.refreshToken) {
    return res.status(400).json({ success: false, message: 'Account has no refresh token configured' });
  }

  try {
    const enriched = await accountPool.enrichAccountMetadata(account, true);
    return res.json({ success: true, message: '账号配额与 Token 已成功刷新同步', data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Keys Management
router.get('/keys', adminAuth, (req: Request, res: Response) => {
  const keys = storage.getApiKeys();
  return res.json({ success: true, data: keys });
});

router.post('/keys', adminAuth, (req: Request, res: Response) => {
  const body = req.body;
  const key: ApiKeyItem = {
    id: body.id || `key_${crypto.randomUUID()}`,
    name: body.name || 'New API Key',
    key: body.key || `sk-ant2api-${crypto.randomBytes(16).toString('hex')}`,
    enabled: body.enabled !== false,
    allowedModels: Array.isArray(body.allowedModels) ? body.allowedModels : [],
    rateLimitPerMin: parseInt(body.rateLimitPerMin || '0', 10),
    quotaTokens: parseInt(body.quotaTokens || '0', 10),
    usedTokens: body.usedTokens || 0,
    totalRequests: body.totalRequests || 0,
    createdAt: body.createdAt || Date.now(),
    expiresAt: body.expiresAt ? parseInt(body.expiresAt, 10) : undefined
  };

  storage.saveApiKey(key);
  return res.json({ success: true, data: key });
});

router.delete('/keys/:id', adminAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const deleted = storage.deleteApiKey(id);
  return res.json({ success: deleted });
});

// Model Mappings
router.get('/mappings', adminAuth, (req: Request, res: Response) => {
  const mappings = storage.getModelMappings();
  return res.json({ success: true, data: mappings });
});

router.post('/mappings', adminAuth, (req: Request, res: Response) => {
  const body = req.body;
  if (!body.sourceModel || !body.targetModel) {
    return res.status(400).json({ success: false, message: 'Source and Target models are required' });
  }

  const mapping: ModelMappingItem = {
    id: body.id || `map_${crypto.randomUUID()}`,
    sourceModel: body.sourceModel.trim(),
    targetModel: body.targetModel.trim(),
    description: body.description || '',
    enabled: body.enabled !== false
  };

  storage.saveModelMapping(mapping);
  return res.json({ success: true, data: mapping });
});

router.delete('/mappings/:id', adminAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const deleted = storage.deleteModelMapping(id);
  return res.json({ success: deleted });
});

// Logs & Audits
router.get('/logs', adminAuth, (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.max(1, Math.min(200, parseInt((req.query.limit as string) || (req.query.pageSize as string) || '20', 10)));
  const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : (page - 1) * limit;
  const search = req.query.search as string;
  const status = req.query.status as string;

  const result = storage.getLogs(limit, offset, search, status);
  const totalPages = Math.ceil(result.total / limit) || 1;

  return res.json({
    success: true,
    data: result.logs,
    total: result.total,
    page,
    pageSize: limit,
    totalPages
  });
});

router.delete('/logs', adminAuth, (req: Request, res: Response) => {
  storage.clearLogs();
  return res.json({ success: true, message: 'Logs cleared successfully' });
});

// System Settings
router.get('/settings', adminAuth, (req: Request, res: Response) => {
  const settings = storage.getSettings();
  return res.json({
    success: true,
    data: {
      ...settings,
      port: config.port,
      defaultModel: config.defaultModel,
      proxyUrl: config.proxyUrl
    }
  });
});

// Proxy Lifecycle Control Endpoints
router.get('/proxy/status', adminAuth, (req: Request, res: Response) => {
  const proxyService = ProxyLifecycleService.getInstance();
  return res.json({ success: true, data: proxyService.getStatus() });
});

router.post('/proxy/start', adminAuth, async (req: Request, res: Response) => {
  try {
    const proxyService = ProxyLifecycleService.getInstance();
    const status = await proxyService.start();
    return res.json({ success: true, message: `反向代理服务已在端口 ${status.port} 启动`, data: status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `启动失败: ${err.message}` });
  }
});

router.post('/proxy/stop', adminAuth, async (req: Request, res: Response) => {
  try {
    const proxyService = ProxyLifecycleService.getInstance();
    const status = await proxyService.stop();
    return res.json({ success: true, message: '反向代理服务已停止', data: status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `停止失败: ${err.message}` });
  }
});

router.post('/proxy/restart', adminAuth, async (req: Request, res: Response) => {
  try {
    const proxyService = ProxyLifecycleService.getInstance();
    const body = req.body || {};
    const status = await proxyService.restart(body);
    return res.json({ success: true, message: `反向代理服务已重启 (端口: ${status.port})`, data: status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `重启失败: ${err.message}` });
  }
});

router.get('/proxy/config', adminAuth, (req: Request, res: Response) => {
  const proxyService = ProxyLifecycleService.getInstance();
  const settings = storage.getProxySettings();
  const statusInfo = proxyService.getStatus();
  return res.json({
    success: true,
    data: {
      ...settings,
      port: statusInfo.port || settings.port,
      proxyTimeout: settings.timeoutSeconds,
      masterKey: settings.masterApiKey,
      uiPassword: settings.adminPassword,
      allowLanAccess: settings.allowLan,
      status: statusInfo.status,
      activePort: statusInfo.port,
      uptime: statusInfo.uptime,
      proxyStatus: {
        running: statusInfo.status === 'running',
        uptimeSeconds: statusInfo.uptime,
        error: statusInfo.error
      }
    }
  });
});

router.post('/proxy/config', adminAuth, async (req: Request, res: Response) => {
  const body = req.body;
  const toUpdate: Partial<ProxyServiceSettings> = {
    ...body,
    timeoutSeconds: body.proxyTimeout !== undefined ? body.proxyTimeout : body.timeoutSeconds,
    masterApiKey: body.masterKey !== undefined ? body.masterKey : body.masterApiKey,
    adminPassword: body.uiPassword !== undefined ? body.uiPassword : body.adminPassword,
    allowLan: body.allowLanAccess !== undefined ? body.allowLanAccess : body.allowLan,
  };
  const updated = storage.updateProxySettings(toUpdate);
  const restart = Boolean(body.restart);
  if (restart) {
    try {
      const proxyService = ProxyLifecycleService.getInstance();
      await proxyService.restart(updated);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `配置已保存但重启服务失败: ${err.message}`, data: updated });
    }
  }
  return res.json({ success: true, message: restart ? '配置已保存并成功重启服务' : '配置已保存', data: updated });
});

// OAuth Helper Endpoints
router.get('/oauth/url', adminAuth, (req: Request, res: Response) => {
  const host = req.get('host') || `localhost:${config.port}`;
  const protocol = req.protocol || 'http';
  const defaultRedirect = `${protocol}://${host}/api/admin/oauth/callback`;
  const clientId = (req.query.clientId as string) || DEFAULT_OAUTH_CLIENT_ID;
  const redirectUri = (req.query.redirectUri as string) || defaultRedirect;
  const url = GoogleOAuthService.getAuthUrl(clientId, redirectUri);
  return res.json({ success: true, url, clientId, redirectUri });
});

// OAuth Callback from Google redirect
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Google OAuth 授权失败</title>
      <style>body{font-family:sans-serif;background:#0a0d14;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
      .box{background:#111726;padding:32px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);max-width:480px;text-align:center;}
      h2{color:#f43f5e;}</style></head>
      <body><div class="box"><h2>❌ 授权失败</h2><p>${error}</p><p>请关闭此窗口并重试。</p></div></body></html>
    `);
  }

  if (!code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>缺少授权码</title>
      <style>body{font-family:sans-serif;background:#0a0d14;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
      .box{background:#111726;padding:32px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);max-width:480px;text-align:center;}</style></head>
      <body><div class="box"><h2>未收到 Google 授权码</h2></div></body></html>
    `);
  }

  try {
    const host = req.get('host') || `localhost:${config.port}`;
    const protocol = req.protocol || 'http';
    const redirectUri = `${protocol}://${host}/api/admin/oauth/callback`;

    const tokens = await GoogleOAuthService.exchangeCodeForTokens(
      String(code).trim(),
      redirectUri
    );

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Google OAuth 授权成功</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0d14; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .box { background: rgba(19, 26, 42, 0.9); padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); max-width: 500px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          h2 { color: #10b981; margin-bottom: 12px; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
          code { display: block; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 8px; font-family: monospace; color: #38bdf8; word-break: break-all; margin: 16px 0; font-size: 0.85rem; }
          .btn { background: #6366f1; color: #fff; padding: 10px 24px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>🎉 Google OAuth 授权成功！</h2>
          <p>已成功获取 Refresh Token。如果此窗口未自动关闭，您可以复制下方凭证：</p>
          <code>${tokens.refresh_token || tokens.access_token}</code>
          <button class="btn" onclick="window.close()">完成并关闭窗口</button>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_OAUTH_SUCCESS',
              refreshToken: '${tokens.refresh_token || ""}',
              accessToken: '${tokens.access_token || ""}'
            }, '*');
            setTimeout(() => window.close(), 1500);
          }
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>换取 Token 失败</title>
      <style>body{font-family:sans-serif;background:#0a0d14;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
      .box{background:#111726;padding:32px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);max-width:480px;text-align:center;}
      h2{color:#f43f5e;}</style></head>
      <body><div class="box"><h2>❌ 换取 Token 失败</h2><p>${err.message}</p></div></body></html>
    `);
  }
});

router.post('/oauth/exchange', adminAuth, async (req: Request, res: Response) => {
  const { code, redirectUri, clientId, clientSecret } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Authorization code is required' });
  }

  try {
    const host = req.get('host') || `localhost:${config.port}`;
    const protocol = req.protocol || 'http';
    const finalRedirectUri = redirectUri || `${protocol}://${host}/api/admin/oauth/callback`;

    const tokens = await GoogleOAuthService.exchangeCodeForTokens(
      code.trim(),
      finalRedirectUri,
      clientId || DEFAULT_OAUTH_CLIENT_ID,
      clientSecret || DEFAULT_OAUTH_CLIENT_SECRET
    );
    return res.json({ success: true, data: tokens });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Data Backup & Restore
router.get('/backup', adminAuth, (req: Request, res: Response) => {
  const allData = storage.getAllData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="ant2api_backup_${Date.now()}.json"`);
  return res.json(allData);
});

router.post('/restore', adminAuth, (req: Request, res: Response) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid backup JSON data' });
  }
  storage.importData(data);
  return res.json({ success: true, message: 'Data imported successfully' });
});

// CLI & Codex Configuration Sync
router.get('/cli/codex', adminAuth, (req: Request, res: Response) => {
  const result = CliSyncService.getInstance().inspectCodex();
  return res.json(result);
});

router.post('/cli/codex/sync', adminAuth, (req: Request, res: Response) => {
  const { apiKey, model } = req.body;
  const result = CliSyncService.getInstance().syncCodex(apiKey, model);
  return res.json(result);
});

export default router;
