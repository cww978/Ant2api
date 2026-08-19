// ==========================================================================
// Ant2api Modern React Web Management Console (React 18 + Next.js UI)
// ==========================================================================

const { useState, useEffect, useCallback, useMemo, useRef } = React;

// --------------------------------------------------------------------------
// Custom SVG Icon Components
// --------------------------------------------------------------------------
const ServerIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
);
const SlidersIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>
);
const ActivityIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
);
const UsersIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const KeyIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4a1 1 0 0 0-1.4 0l-2.1 2.1a1 1 0 0 0 0 1.4Z"/><path d="m15.5 7.5-8.8 8.8a2.5 2.5 0 0 0-.7 1.8V21a1 1 0 0 0 1 1h2.9a2.5 2.5 0 0 0 1.8-.7l4.8-4.8"/></svg>
);
const LayersIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
);
const FileTextIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
);
const SettingsIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const PlayIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
);
const SquareIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
);
const RotateCwIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
);
const CopyIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
const CheckIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const EyeIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EyeOffIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);
const EditIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);
const TrashIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);
const PlusIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
);
const LogOutIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
);
const DatabaseIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
);
const ChevronLeftIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);
const ChevronRightIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

// --------------------------------------------------------------------------
// Main Application Component
// --------------------------------------------------------------------------
function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ant2api_admin_token') || '');
  const [activeTab, setActiveTab] = useState('config'); // default to 'config' as requested
  const [proxyStatus, setProxyStatus] = useState({
    status: 'stopped',
    port: 8090,
    host: '127.0.0.1',
    uptime: 0,
    error: null
  });
  const [proxyConfig, setProxyConfig] = useState({
    port: 8090,
    host: '127.0.0.1',
    allowLan: false,
    timeoutSeconds: 120,
    autoStart: true,
    authEnabled: true,
    authMode: 'auto',
    masterApiKey: 'sk-ant2api-default-master-key',
    adminPassword: 'ant2api_admin',
    userAgentOverride: true,
    customUserAgent: 'antigravity/1.15.8 darwin/arm64'
  });
  const [dashboardStats, setDashboardStats] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [modelMappings, setModelMappings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Toast Notification Dispatcher
  const showToast = useCallback((type, title, message) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Generic Authenticated Fetch Wrapper
  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        setToken('');
        localStorage.removeItem('ant2api_admin_token');
        showToast('error', '会话过期', '请重新登录管理后台');
        throw new Error('Unauthorized');
      }
      const data = await res.json();
      return data;
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        console.error(`[API Error] ${url}:`, err);
      }
      throw err;
    }
  }, [token, showToast]);

  // Load Proxy Status & Config
  const loadProxyData = useCallback(async () => {
    if (!token) return;
    try {
      const [statusRes, configRes] = await Promise.all([
        apiFetch('/api/admin/proxy/status'),
        apiFetch('/api/admin/proxy/config')
      ]);
      if (statusRes.success) setProxyStatus(statusRes.data);
      if (configRes.success) setProxyConfig(configRes.data);
    } catch (e) {}
  }, [apiFetch, token]);

  // Load Tab Specific Data
  const loadTabData = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      if (activeTab === 'config') {
        await loadProxyData();
      } else if (activeTab === 'dashboard') {
        const stats = await apiFetch('/api/admin/stats');
        if (stats.success) setDashboardStats(stats.data);
        await loadProxyData();
      } else if (activeTab === 'accounts') {
        const accs = await apiFetch('/api/admin/accounts');
        if (accs.success) setAccounts(accs.data);
      } else if (activeTab === 'keys') {
        const keys = await apiFetch('/api/admin/keys');
        if (keys.success) setApiKeys(keys.data);
      } else if (activeTab === 'mappings') {
        const maps = await apiFetch('/api/admin/mappings');
        if (maps.success) setModelMappings(maps.data);
      } else if (activeTab === 'logs') {
        const logData = await apiFetch('/api/admin/logs?limit=150');
        if (logData.success) setLogs(logData.data || []);
      }
    } catch (e) {
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTab, apiFetch, token, loadProxyData]);

  // Initial and Periodic Refresh
  useEffect(() => {
    if (token) {
      loadTabData();
    }
  }, [token, activeTab, loadTabData]);

  // Periodic Polling for Proxy Status every 3 seconds
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      apiFetch('/api/admin/proxy/status').then(res => {
        if (res.success) setProxyStatus(res.data);
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [apiFetch, token]);

  // Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        setToken(data.token);
        localStorage.setItem('ant2api_admin_token', data.token);
        showToast('success', '登录成功', '欢迎使用 Ant2api 管理控制台');
      } else {
        setLoginError(data.message || '密码错误');
      }
    } catch (err) {
      setLoginError('连接后端服务失败');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('ant2api_admin_token');
    showToast('info', '已登出', '您已安全退出管理后台');
  };

  // Proxy Lifecycle Actions
  const handleStartProxy = async () => {
    try {
      showToast('info', '正在启动...', '正在绑定端口并启动反向代理服务');
      const res = await apiFetch('/api/admin/proxy/start', { method: 'POST' });
      if (res.success) {
        setProxyStatus(res.data);
        showToast('success', '服务已启动', res.message);
      }
    } catch (err) {
      showToast('error', '启动失败', err.message);
    }
  };

  const handleStopProxy = async () => {
    try {
      const res = await apiFetch('/api/admin/proxy/stop', { method: 'POST' });
      if (res.success) {
        setProxyStatus(res.data);
        showToast('warning', '服务已停止', res.message);
      }
    } catch (err) {
      showToast('error', '停止失败', err.message);
    }
  };

  const handleRestartProxy = async (settingsToApply) => {
    try {
      showToast('info', '正在重启...', '正在重新应用配置并重启反向代理');
      const res = await apiFetch('/api/admin/proxy/restart', {
        method: 'POST',
        body: JSON.stringify(settingsToApply || proxyConfig)
      });
      if (res.success) {
        setProxyStatus(res.data);
        showToast('success', '服务已重启', res.message);
      }
    } catch (err) {
      showToast('error', '重启失败', err.message);
    }
  };

  // If not logged in, render Login Gate
  if (!token) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="glass-card" style={{ maxWidth: 420, width: '100%', padding: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.75rem', marginBottom: 16, boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>⚡</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>Ant2api 管理控制台</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24 }}>请输入管理员密码以访问控制台与反向代理设置</p>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              type="password"
              className="text-input"
              placeholder="请输入管理员密码 (默认 ant2api_admin)"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              autoFocus
            />
            {loginError && <p style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', textAlign: 'left' }}>{loginError}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 44 }}>登录管理系统</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item ${t.type}`}>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              <div className="toast-message">{t.message}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Sticky Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo-icon">⚡</div>
          <div>
            <span className="brand-title">Ant2api</span>
            <span className="brand-subtitle">Console</span>
          </div>
        </div>

        <nav className="nav-tabs">
          <button className={`nav-tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            <SlidersIcon size={16} /> 服务配置
          </button>
          <button className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <ActivityIcon size={16} /> 概览
          </button>
          <button className={`nav-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}>
            <UsersIcon size={16} /> 账号池
          </button>
          <button className={`nav-tab-btn ${activeTab === 'keys' ? 'active' : ''}`} onClick={() => setActiveTab('keys')}>
            <KeyIcon size={16} /> API 密钥
          </button>
          <button className={`nav-tab-btn ${activeTab === 'mappings' ? 'active' : ''}`} onClick={() => setActiveTab('mappings')}>
            <LayersIcon size={16} /> 模型路由
          </button>
          <button className={`nav-tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            <FileTextIcon size={16} /> 审计日志
          </button>
          <button className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <SettingsIcon size={16} /> 系统设置
          </button>
        </nav>

        <div className="header-actions">
          <div className="header-status-pill">
            <span className={`status-indicator-dot ${proxyStatus.status}`}></span>
            <span>{proxyStatus.status === 'running' ? `代理端口 :${proxyStatus.port}` : '代理已停止'}</span>
          </div>
          <button className="icon-action-btn" title="刷新数据" onClick={loadTabData}>
            <RotateCwIcon size={16} className={isRefreshing ? 'spin' : ''} />
          </button>
          <button className="icon-action-btn" title="退出登录" onClick={handleLogout}>
            <LogOutIcon size={16} />
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className="app-main">
        {activeTab === 'config' && (
          <ProxyConfigView
            proxyStatus={proxyStatus}
            proxyConfig={proxyConfig}
            setProxyConfig={setProxyConfig}
            onStart={handleStartProxy}
            onStop={handleStopProxy}
            onRestart={handleRestartProxy}
            apiFetch={apiFetch}
            showToast={showToast}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            stats={dashboardStats}
            proxyStatus={proxyStatus}
            showToast={showToast}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            onReload={loadTabData}
            apiFetch={apiFetch}
            showToast={showToast}
          />
        )}

        {activeTab === 'keys' && (
          <ApiKeysView
            apiKeys={apiKeys}
            onReload={loadTabData}
            apiFetch={apiFetch}
            showToast={showToast}
          />
        )}

        {activeTab === 'mappings' && (
          <ModelMappingsView
            mappings={modelMappings}
            onReload={loadTabData}
            apiFetch={apiFetch}
            showToast={showToast}
          />
        )}

        {activeTab === 'logs' && (
          <AuditLogsView
            apiFetch={apiFetch}
            showToast={showToast}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            apiFetch={apiFetch}
            showToast={showToast}
          />
        )}
      </main>
    </>
  );
}

// --------------------------------------------------------------------------
// 1. 服务配置视图 (ProxyConfigView - Exact match to User Screenshot)
// --------------------------------------------------------------------------
function ProxyConfigView({ proxyStatus, proxyConfig, setProxyConfig, onStart, onStop, onRestart, apiFetch, showToast }) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast('success', '已复制', `${fieldName} 已复制到剪贴板`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/admin/proxy/config', {
        method: 'POST',
        body: JSON.stringify({ ...proxyConfig, restart: false })
      });
      if (res.success) {
        showToast('success', '保存成功', '反向代理服务配置已保存');
      }
    } catch (e) {
      showToast('error', '保存失败', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndRestart = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/admin/proxy/config', {
        method: 'POST',
        body: JSON.stringify({ ...proxyConfig, restart: true })
      });
      if (res.success) {
        showToast('success', '保存并重启', '配置已保存，反向代理服务已重启生效');
        onRestart(proxyConfig);
      }
    } catch (e) {
      showToast('error', '操作失败', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="config-container">
      {/* Service Header Row matching screenshot */}
      <div className="config-service-header">
        <div className="service-status-display">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', fontWeight: 700 }}>
            <SettingsIcon size={20} /> 服务配置
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span className={`status-indicator-dot ${proxyStatus.status}`}></span>
            <span>
              {proxyStatus.status === 'running' && `服务运行中 (监听端口: ${proxyStatus.port})`}
              {proxyStatus.status === 'stopped' && '服务已停止'}
              {proxyStatus.status === 'restarting' && '服务正在重启中...'}
              {proxyStatus.status === 'error' && `服务异常: ${proxyStatus.error || '端口可能被占用'}`}
            </span>
          </div>
        </div>

        <div className="service-action-buttons">
          {proxyStatus.status !== 'running' ? (
            <button className="btn btn-primary" onClick={onStart}>
              <PlayIcon size={14} /> 启动服务
            </button>
          ) : (
            <button className="btn btn-danger" onClick={onStop}>
              <SquareIcon size={14} /> 停止服务
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => onRestart(proxyConfig)}>
            <RotateCwIcon size={14} /> 重启服务
          </button>
        </div>
      </div>

      {/* Main Settings Form Grid */}
      <div className="glass-card">
        <div className="config-form-grid">
          {/* 监听端口 */}
          <div className="form-item">
            <div className="form-label-row">
              <label className="form-label">
                监听端口 <span className="help-icon" title="反向代理对外提供 API 的监听端口">ⓘ</span>
              </label>
            </div>
            <input
              type="number"
              className="text-input"
              value={proxyConfig.port}
              onChange={e => setProxyConfig({ ...proxyConfig, port: parseInt(e.target.value, 10) || 8090 })}
            />
            <span className="form-subtext">默认 8045 / 8090，修改端口需重启服务生效。</span>
          </div>

          {/* 请求超时 */}
          <div className="form-item">
            <div className="form-label-row">
              <label className="form-label">
                请求超时 <span className="help-icon" title="客户端请求的最大等待超时时间">ⓘ</span>
              </label>
              <div className="switch-wrapper" onClick={() => setProxyConfig({ ...proxyConfig, autoStart: !proxyConfig.autoStart })}>
                <div className={`switch-control ${proxyConfig.autoStart ? 'checked' : ''}`}>
                  <div className="switch-thumb"></div>
                </div>
                <span className="switch-label">跟随应用自动启动</span>
              </div>
            </div>
            <input
              type="number"
              className="text-input"
              value={proxyConfig.timeoutSeconds}
              onChange={e => setProxyConfig({ ...proxyConfig, timeoutSeconds: parseInt(e.target.value, 10) || 120 })}
            />
            <span className="form-subtext">默认 120 秒，范围 30-7200 秒，修改后需重启服务生效。</span>
          </div>

          {/* 允许局域网访问 */}
          <div className="form-item">
            <div className="form-label-row">
              <label className="form-label">
                允许局域网访问 <span className="help-icon" title="是否允许局域网内其他设备连接本代理">ⓘ</span>
              </label>
              <div className="switch-wrapper" onClick={() => setProxyConfig({ ...proxyConfig, allowLan: !proxyConfig.allowLan })}>
                <div className={`switch-control ${proxyConfig.allowLan ? 'checked' : ''}`}>
                  <div className="switch-thumb"></div>
                </div>
              </div>
            </div>
            <div className="form-subtext highlight" style={{ marginTop: 6 }}>
              {proxyConfig.allowLan ? '🔓 监听 0.0.0.0，局域网所有设备可访问' : '🔒 仅监听 127.0.0.1，仅本机可访问 (隐私优先)'}
            </div>
          </div>

          {/* 访问授权 & 模式 */}
          <div className="form-item">
            <div className="form-label-row">
              <label className="form-label">
                访问授权 <span className="help-icon" title="是否强制要求 API 密钥鉴权">ⓘ</span>
              </label>
              <div className="switch-wrapper" onClick={() => setProxyConfig({ ...proxyConfig, authEnabled: !proxyConfig.authEnabled })}>
                <span className="switch-label" style={{ fontSize: '0.8rem' }}>{proxyConfig.authEnabled ? '已启用' : '已禁用'}</span>
                <div className={`switch-control ${proxyConfig.authEnabled ? 'checked' : ''}`}>
                  <div className="switch-thumb"></div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 2 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>模式 ⓘ</div>
              <select
                className="select-input"
                value={proxyConfig.authMode}
                onChange={e => setProxyConfig({ ...proxyConfig, authMode: e.target.value })}
              >
                <option value="auto">自动 (推荐)</option>
                <option value="strict">严格鉴权 (所有端点需 Key)</option>
                <option value="disabled">免鉴权 (直接公开开放)</option>
              </select>
            </div>
            <span className="form-subtext">开启后客户端需通过 Authorization: Bearer ... 传入 API 密钥（健康检查 /health 免鉴权）。</span>
          </div>

          {/* API 密钥 */}
          <div className="form-item full-width">
            <label className="form-label">
              API 密钥 <span className="help-icon" title="客户端调用反向代理时使用的 Master API Key">ⓘ</span>
            </label>
            <div className="input-with-actions">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="text-input font-mono"
                value={proxyConfig.masterApiKey}
                onChange={e => setProxyConfig({ ...proxyConfig, masterApiKey: e.target.value })}
              />
              <div className="input-trailing-actions">
                <button className="icon-action-btn" title={showApiKey ? '隐藏' : '显示'} onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                </button>
                <button
                  className="icon-action-btn"
                  title="生成新密钥"
                  onClick={() => {
                    const newKey = 'sk-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    setProxyConfig({ ...proxyConfig, masterApiKey: newKey });
                    showToast('info', '已生成新密钥', '记得点击保存配置生效');
                  }}
                >
                  <RotateCwIcon size={15} />
                </button>
                <button className="icon-action-btn" title="复制密钥" onClick={() => copyToClipboard(proxyConfig.masterApiKey, 'API 密钥')}>
                  {copiedField === 'API 密钥' ? <CheckIcon size={15} color="var(--accent-emerald)" /> : <CopyIcon size={15} />}
                </button>
              </div>
            </div>
            <span className="form-subtext highlight">注意：请妥善保管您的 API 密钥，不要泄露给他人。</span>
          </div>

          {/* Web UI 管理后台密码 */}
          <div className="form-item full-width">
            <label className="form-label">
              Web UI 管理后台密码 <span className="help-icon" title="登录 Web 管理控制台所使用的独立密码">ⓘ</span>
            </label>
            <div className="input-with-actions">
              <input
                type={showAdminPassword ? 'text' : 'password'}
                className="text-input font-mono"
                value={proxyConfig.adminPassword}
                onChange={e => setProxyConfig({ ...proxyConfig, adminPassword: e.target.value })}
              />
              <div className="input-trailing-actions">
                <button className="icon-action-btn" title={showAdminPassword ? '隐藏' : '显示'} onClick={() => setShowAdminPassword(!showAdminPassword)}>
                  {showAdminPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                </button>
                <button className="icon-action-btn" title="复制密码" onClick={() => copyToClipboard(proxyConfig.adminPassword, '后台密码')}>
                  {copiedField === '后台密码' ? <CheckIcon size={15} color="var(--accent-emerald)" /> : <CopyIcon size={15} />}
                </button>
              </div>
            </div>
            <span className="form-subtext">提示：在 Docker/Web 部署场景中，您可以设置一个独立的登录密码，提高安全性。</span>
          </div>

          {/* User-Agent 覆盖 */}
          <div className="form-item full-width">
            <div className="form-label-row">
              <label className="form-label">
                User-Agent 覆盖 <span className="help-icon" title="伪装为官方 Antigravity / Gemini CLI 客户端 User-Agent">ⓘ</span>
              </label>
              <div className="switch-wrapper" onClick={() => setProxyConfig({ ...proxyConfig, userAgentOverride: !proxyConfig.userAgentOverride })}>
                <div className={`switch-control ${proxyConfig.userAgentOverride ? 'checked' : ''}`}>
                  <div className="switch-thumb"></div>
                </div>
              </div>
            </div>
            <input
              type="text"
              className="text-input font-mono"
              value={proxyConfig.customUserAgent}
              disabled={!proxyConfig.userAgentOverride}
              onChange={e => setProxyConfig({ ...proxyConfig, customUserAgent: e.target.value })}
            />
            <span className="form-subtext">示例：antigravity/1.15.8 darwin/arm64</span>
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn btn-secondary" onClick={handleSaveOnly} disabled={isSaving}>
            💾 仅保存配置
          </button>
          <button className="btn btn-primary" onClick={handleSaveAndRestart} disabled={isSaving}>
            🔄 保存并重启服务
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 2. 仪表盘概览视图 (DashboardView)
// --------------------------------------------------------------------------
function DashboardView({ stats, proxyStatus, showToast }) {
  const proxyHost = proxyStatus.host === '0.0.0.0' ? 'localhost' : proxyStatus.host;
  const proxyPort = proxyStatus.port || 8090;
  const baseUrl = `http://${proxyHost}:${proxyPort}`;

  const endpoints = [
    { name: 'OpenAI 格式 (Chat)', path: '/v1/chat/completions', method: 'POST', model: 'gpt-4o / gpt-4o-mini' },
    { name: 'Codex / ChatGPT (Responses)', path: '/v1/responses', method: 'POST', model: 'gpt-5.6-luna / gemini-3.7-flash' },
    { name: 'Codex FIM 补全', path: '/v1/completions', method: 'POST', model: 'gemini-3.7-flash' },
    { name: 'Gemini 原生格式', path: '/v1beta/models', method: 'GET/POST', model: 'gemini-3.7-flash' },
    { name: '健康检查', path: '/health', method: 'GET', model: '-' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">总请求数 <span>⚡</span></div>
          <div className="metric-value">{stats?.totalRequests?.toLocaleString() || '0'}</div>
          <div className="metric-subtext">成功率: {stats?.successRate || 100}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Token 消耗总计 <span>📊</span></div>
          <div className="metric-value">{stats?.totalTokens ? (stats.totalTokens > 1000000 ? (stats.totalTokens / 1000000).toFixed(2) + 'M' : (stats.totalTokens / 1000).toFixed(1) + 'k') : '0'}</div>
          <div className="metric-subtext">入/出统计</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">平均延迟 <span>⏱️</span></div>
          <div className="metric-value">{stats?.avgLatencyMs || '0'}<span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}> ms</span></div>
          <div className="metric-subtext">上游生成平均耗时</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">健康账号 / 总池 <span>👥</span></div>
          <div className="metric-value">{stats?.healthyAccounts || '0'}<span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}> / {stats?.activeAccounts || '0'}</span></div>
          <div className="metric-subtext">可用负载均衡账号</div>
        </div>
      </div>

      {/* API Endpoints & Client Integration Guide */}
      <div className="glass-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <ServerIcon size={20} color="var(--primary)" />
            <h3 className="card-title">反向代理客户端接口接入端点</h3>
          </div>
          <span className={`badge ${proxyStatus.status === 'running' ? 'badge-success' : 'badge-danger'}`}>
            {proxyStatus.status === 'running' ? `服务在线 (${baseUrl})` : '服务已停止'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {endpoints.map((ep, idx) => (
            <div key={idx} className="endpoint-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{ep.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>{baseUrl}{ep.path}</span>
              </div>
              <button
                className="icon-action-btn"
                title="复制完整 URL"
                onClick={() => {
                  navigator.clipboard.writeText(`${baseUrl}${ep.path}`);
                  showToast('success', '已复制', `${ep.name} URL 已复制`);
                }}
              >
                <CopyIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 3. 账号管理视图 (AccountsView)
// --------------------------------------------------------------------------
function AccountsView({ accounts, onReload, apiFetch, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [newAcc, setNewAcc] = useState({ name: '', type: 'antigravity', refreshToken: '', clientId: '', clientSecret: '', notes: '' });

  const handleTest = async (id) => {
    try {
      showToast('info', '正在测试连接...', '向上游发送健康检测请求');
      const res = await apiFetch(`/api/admin/accounts/${id}/test`, { method: 'POST' });
      if (res.success) {
        showToast('success', '连接成功', res.message);
      } else {
        showToast('error', '连接失败', res.message);
      }
    } catch (e) {
      showToast('error', '测试失败', e.message);
    }
  };

  const handleRefresh = async (id) => {
    try {
      const res = await apiFetch(`/api/admin/accounts/${id}/refresh`, { method: 'POST' });
      if (res.success) {
        showToast('success', 'Token 刷新成功', '已换取最新的 Access Token');
        onReload();
      }
    } catch (e) {
      showToast('error', '刷新失败', e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除此账号吗？')) return;
    try {
      await apiFetch(`/api/admin/accounts/${id}`, { method: 'DELETE' });
      showToast('success', '已删除', '账号已从账号池移除');
      onReload();
    } catch (e) {
      showToast('error', '删除失败', e.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newAcc.name) return showToast('error', '缺少参数', '请填写账号名称');
    try {
      const res = await apiFetch('/api/admin/accounts', {
        method: 'POST',
        body: JSON.stringify(newAcc)
      });
      if (res.success) {
        showToast('success', '添加成功', '新账号已加入负载均衡池');
        setShowModal(false);
        setNewAcc({ name: '', type: 'antigravity', refreshToken: '', clientId: '', clientSecret: '', notes: '' });
        onReload();
      }
    } catch (e) {
      showToast('error', '添加失败', e.message);
    }
  };

  const handleGoogleOAuth = async () => {
    try {
      const res = await apiFetch('/api/admin/oauth/url');
      if (res.success && res.url) {
        const popup = window.open(res.url, 'GoogleAuth', 'width=580,height=680');
        const listener = (event) => {
          if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS') {
            window.removeEventListener('message', listener);
            setNewAcc(prev => ({
              ...prev,
              name: prev.name || `Google Account ${Math.floor(Math.random()*900+100)}`,
              refreshToken: event.data.refreshToken,
              accessToken: event.data.accessToken
            }));
            showToast('success', '授权成功', '已自动填充 Google 凭据');
          }
        };
        window.addEventListener('message', listener);
      }
    } catch (e) {
      showToast('error', '获取授权 URL 失败', e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">Google / Antigravity 账号池</h2>
          <p className="page-subtitle">管理多账号并发轮询、智能故障转移与 Token 自动续期</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusIcon size={16} /> 添加账号
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>账号名称</th>
                <th>类型</th>
                <th>状态</th>
                <th>总请求 / 失败</th>
                <th>Token 状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    暂无账号，请点击右上角“添加账号”接入 Google 凭据
                  </td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{acc.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {acc.id.substring(0, 16)}...</div>
                    </td>
                    <td><span className="badge badge-primary">{acc.type}</span></td>
                    <td>
                      {acc.cooldownUntil && acc.cooldownUntil > Date.now() ? (
                        <span className="badge badge-warning">冷却中 ({Math.ceil((acc.cooldownUntil - Date.now())/1000)}s)</span>
                      ) : (
                        <span className={`badge ${acc.enabled ? 'badge-success' : 'badge-danger'}`}>{acc.enabled ? '正常可用' : '已禁用'}</span>
                      )}
                    </td>
                    <td>{acc.totalRequests || 0} / <span style={{ color: acc.failedRequests > 0 ? 'var(--accent-rose)' : 'inherit' }}>{acc.failedRequests || 0}</span></td>
                    <td>
                      {acc.refreshToken ? (
                        <span style={{ color: 'var(--accent-emerald)', fontSize: '0.8rem' }}>● OAuth 已授权</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>手动凭据</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" title="测试连接" onClick={() => handleTest(acc.id)}>测试</button>
                        {acc.refreshToken && <button className="btn btn-secondary btn-sm" title="刷新 Token" onClick={() => handleRefresh(acc.id)}>刷新</button>}
                        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--accent-rose)' }} title="删除" onClick={() => handleDelete(acc.id)}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">添加 Google / Antigravity 账号</h3>
              <button className="icon-action-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-item">
                  <label className="form-label">账号备注名称</label>
                  <input type="text" className="text-input" placeholder="例如: Google Account A" value={newAcc.name} onChange={e => setNewAcc({ ...newAcc, name: e.target.value })} required />
                </div>
                
                <div style={{ padding: '14px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 10, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#818cf8', marginBottom: 8 }}>⚡ 推荐：Google OAuth 浏览器一键授权</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleGoogleOAuth}>
                    打开 Google 登录窗口进行授权
                  </button>
                </div>

                <div className="form-item">
                  <label className="form-label">Refresh Token (可手动粘贴)</label>
                  <input type="text" className="text-input font-mono" placeholder="1//0..." value={newAcc.refreshToken} onChange={e => setNewAcc({ ...newAcc, refreshToken: e.target.value })} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">确认添加</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 4. API 密钥管理视图 (ApiKeysView)
// --------------------------------------------------------------------------
function ApiKeysView({ apiKeys, onReload, apiFetch, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName || 'Default Key' })
      });
      if (res.success) {
        showToast('success', '创建成功', '新 API 密钥已生成');
        setShowModal(false);
        setNewKeyName('');
        onReload();
      }
    } catch (e) {
      showToast('error', '创建失败', e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除此密钥？')) return;
    try {
      await apiFetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
      showToast('success', '已删除', 'API 密钥已删除');
      onReload();
    } catch (e) {
      showToast('error', '删除失败', e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">API 密钥管理</h2>
          <p className="page-subtitle">创建分发给客户端使用的调用密钥，支持速率限制与模型白名单隔离</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusIcon size={16} /> 创建新密钥
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>密钥名称</th>
              <th>API Key</th>
              <th>已用 Token</th>
              <th>总请求数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map(k => (
              <tr key={k.id}>
                <td><strong style={{ color: 'var(--text-main)' }}>{k.name}</strong></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ color: 'var(--accent-cyan)' }}>{k.key}</code>
                    <button className="icon-action-btn" title="复制" onClick={() => {
                      navigator.clipboard.writeText(k.key);
                      showToast('success', '已复制', 'API 密钥已复制');
                    }}>
                      <CopyIcon size={13} />
                    </button>
                  </div>
                </td>
                <td>{k.usedTokens?.toLocaleString() || '0'}</td>
                <td>{k.totalRequests?.toLocaleString() || '0'}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--accent-rose)' }} onClick={() => handleDelete(k.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">创建 API 密钥</h3>
              <button className="icon-action-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-item">
                <label className="form-label">密钥名称 / 用途备注</label>
                <input type="text" className="text-input" placeholder="例如: Cursor 客户端专用" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} autoFocus required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">生成密钥</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 5. 模型路由映射视图 (ModelMappingsView)
// --------------------------------------------------------------------------
function ModelMappingsView({ mappings, onReload, apiFetch, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [newMap, setNewMap] = useState({ sourceModel: '', targetModel: 'gemini-3.7-flash', description: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/mappings', {
        method: 'POST',
        body: JSON.stringify(newMap)
      });
      if (res.success) {
        showToast('success', '映射已创建', `${newMap.sourceModel} -> ${newMap.targetModel}`);
        setShowModal(false);
        setNewMap({ sourceModel: '', targetModel: 'gemini-3.7-flash', description: '' });
        onReload();
      }
    } catch (e) {
      showToast('error', '创建失败', e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch(`/api/admin/mappings/${id}`, { method: 'DELETE' });
      showToast('success', '已删除', '模型映射规则已移除');
      onReload();
    } catch (e) {
      showToast('error', '删除失败', e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">模型路由与别名映射</h2>
          <p className="page-subtitle">将客户端发出的 OpenAI / Codex / GPT 模型请求无缝路由至指定的 Gemini 模型</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusIcon size={16} /> 添加路由映射
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>来源请求模型 (Source)</th>
              <th>路由目标模型 (Target)</th>
              <th>说明</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map(m => (
              <tr key={m.id}>
                <td><code style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{m.sourceModel}</code></td>
                <td><code style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{m.targetModel}</code></td>
                <td>{m.description || '-'}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--accent-rose)' }} onClick={() => handleDelete(m.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-title">添加模型路由映射</h3>
              <button className="icon-action-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-item">
                  <label className="form-label">来源请求模型 (客户端传入)</label>
                  <input type="text" className="text-input font-mono" placeholder="例如: gpt-4o, o3-mini" value={newMap.sourceModel} onChange={e => setNewMap({ ...newMap, sourceModel: e.target.value })} required />
                </div>
                <div className="form-item">
                  <label className="form-label">目标 Gemini 模型</label>
                  <select className="select-input" value={newMap.targetModel} onChange={e => setNewMap({ ...newMap, targetModel: e.target.value })}>
                    <option value="gemini-3.7-flash">gemini-3.7-flash (极速首选)</option>
                    <option value="gemini-3.7-thinking">gemini-3.7-thinking (深度思考)</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash (轻量高并发)</option>
                    <option value="gemini-3.1-pro">gemini-3.1-pro (超长上下文)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">说明备注</label>
                  <input type="text" className="text-input" placeholder="自定义备注" value={newMap.description} onChange={e => setNewMap({ ...newMap, description: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存映射</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 6. 审计日志视图 (AuditLogsView - Server-Side Pagination & Filters)
// --------------------------------------------------------------------------
function AuditLogsView({ apiFetch, showToast }) {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async (targetPage = page, targetPageSize = pageSize, targetSearch = search, targetStatus = statusFilter) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(targetPageSize)
      });
      if (targetSearch.trim()) params.append('search', targetSearch.trim());
      if (targetStatus !== 'all') params.append('status', targetStatus);

      const res = await apiFetch(`/api/admin/logs?${params.toString()}`);
      if (res.success) {
        setLogs(res.data || []);
        setTotal(res.total || 0);
        setPage(res.page || targetPage);
        setPageSize(res.pageSize || targetPageSize);
        setTotalPages(res.totalPages || 1);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, page, pageSize, search, statusFilter]);

  // Initial and search/filter trigger
  useEffect(() => {
    fetchLogs(page, pageSize, search, statusFilter);
  }, [page, pageSize, statusFilter]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs(1, pageSize, search, statusFilter);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Auto refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchLogs(page, pageSize, search, statusFilter);
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRefresh, page, pageSize, search, statusFilter, fetchLogs]);

  const handleClear = async () => {
    if (!confirm('确定清空所有请求审计日志？')) return;
    try {
      await apiFetch('/api/admin/logs', { method: 'DELETE' });
      showToast('success', '已清空', '所有审计日志已清空');
      setPage(1);
      fetchLogs(1, pageSize, '', 'all');
    } catch (e) {
      showToast('error', '操作失败', e.message);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
  };

  // Generate page numbers array with ellipsis
  const pageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">请求审计日志</h2>
          <p className="page-subtitle">查看所有反向代理客户端请求的详细耗时、Token 消耗、上游账号与错误排查</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="switch-wrapper" onClick={() => setAutoRefresh(!autoRefresh)} title="每 4 秒自动刷新日志">
            <span className="switch-label" style={{ fontSize: '0.8rem' }}>自动刷新</span>
            <div className={`switch-control ${autoRefresh ? 'checked' : ''}`}>
              <div className="switch-thumb"></div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleClear}>清空所有日志</button>
          <button className="btn btn-primary" onClick={() => fetchLogs(page, pageSize, search, statusFilter)}>
            <RotateCwIcon size={14} className={isLoading ? 'spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20 }}>
        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <input
              type="text"
              className="text-input"
              placeholder="🔍 筛选模型、端点、状态码、账号或客户端 IP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ width: 160 }}>
            <select
              className="select-input"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">全部状态码</option>
              <option value="200">仅成功 (200 OK)</option>
              <option value="error">仅异常 / 错误 (4xx/5xx)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>每页:</span>
            <select
              className="page-size-select"
              value={pageSize}
              onChange={e => {
                const newSize = parseInt(e.target.value, 10);
                setPageSize(newSize);
                setPage(1);
              }}
            >
              <option value={10}>10 条</option>
              <option value={20}>20 条</option>
              <option value={50}>50 条</option>
              <option value={100}>100 条</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>协议 / 端点</th>
                <th>请求模型 ➔ 目标模型</th>
                <th>状态</th>
                <th>耗时</th>
                <th>Tokens (入/出/总)</th>
                <th>上游账号</th>
                <th>客户端 IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    {isLoading ? '正在加载日志...' : '暂无符合条件的审计日志'}
                  </td>
                </tr>
              ) : (
                logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.8rem' }}>{l.protocol}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.endpoint}</div>
                    </td>
                    <td>
                      <code style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>{l.model}</code>
                      {l.mappedModel && l.mappedModel !== l.model && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> ➔ {l.mappedModel}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${l.statusCode === 200 ? 'badge-success' : 'badge-danger'}`}>
                        {l.statusCode}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{l.latencyMs}ms</td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      {l.inputTokens || 0} / {l.outputTokens || 0} / <strong style={{ color: 'var(--text-main)' }}>{l.totalTokens || 0}</strong>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{l.accountName || l.accountId?.substring(0, 12) || '-'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{l.clientIp || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pagination-container">
          <div className="pagination-info">
            <span>共 <strong style={{ color: 'var(--text-main)' }}>{total}</strong> 条记录</span>
            <span>第 <strong style={{ color: 'var(--primary)' }}>{page}</strong> / {totalPages} 页</span>
          </div>

          <div className="pagination-nav">
            <button
              className="page-btn"
              onClick={() => handlePageChange(1)}
              disabled={page === 1 || isLoading}
              title="第一页"
            >
              «
            </button>
            <button
              className="page-btn"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || isLoading}
              title="上一页"
            >
              <ChevronLeftIcon size={14} />
            </button>

            {pageNumbers.map((p, idx) =>
              p === '...' ? (
                <span key={idx} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>
              ) : (
                <button
                  key={idx}
                  className={`page-btn ${page === p ? 'active' : ''}`}
                  onClick={() => handlePageChange(p)}
                  disabled={isLoading}
                >
                  {p}
                </button>
              )
            )}

            <button
              className="page-btn"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              title="下一页"
            >
              <ChevronRightIcon size={14} />
            </button>
            <button
              className="page-btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages || isLoading}
              title="最后一页"
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 7. 系统设置视图 (SettingsView)
// --------------------------------------------------------------------------
function SettingsView({ apiFetch, showToast }) {
  const [settings, setSettings] = useState({
    loadBalanceStrategy: 'round_robin',
    maxCooldownSeconds: 60,
    proxyUrl: '',
    customSystemPrompt: '',
    enableDebugLogs: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    apiFetch('/api/admin/settings').then(res => {
      if (res.success && res.data) setSettings(res.data);
    }).catch(() => {});
  }, [apiFetch]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (res.success) {
        showToast('success', '保存成功', '系统设置已更新并生效');
      }
    } catch (e) {
      showToast('error', '保存失败', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/admin/backup', '_blank');
    showToast('info', '正在导出', '备份文件正在下载');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = await apiFetch('/api/admin/restore', {
          method: 'POST',
          body: JSON.stringify(json)
        });
        if (res.success) {
          showToast('success', '导入成功', '所有账号、密钥与配置已恢复');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast('error', '导入失败', res.message);
        }
      } catch (err) {
        showToast('error', '解析失败', '请确保上传的是有效的 JSON 备份文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">系统高级设置</h2>
          <p className="page-subtitle">配置出站网络代理、负载均衡调度策略、全局系统提示词与全量数据备份</p>
        </div>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-item">
            <label className="form-label">
              负载均衡策略 <span className="help-icon" title="决定在账号池中如何选择账号发起请求">ⓘ</span>
            </label>
            <select
              className="select-input"
              value={settings.loadBalanceStrategy}
              onChange={e => setSettings({ ...settings, loadBalanceStrategy: e.target.value })}
            >
              <option value="round_robin">轮询调度 (Round Robin - 依次轮流使用每个可用账号)</option>
              <option value="least_errors">最小故障优先 (Least Errors - 优先选择错误率最低的最健康账号)</option>
              <option value="random">随机分发 (Random - 纯随机负载分配)</option>
            </select>
          </div>

          <div className="form-item">
            <label className="form-label">
              出站网络代理 (HTTP / HTTPS / SOCKS5) <span className="help-icon" title="用于服务器连接 Google API 的出站科学上网代理">ⓘ</span>
            </label>
            <input
              type="text"
              className="text-input font-mono"
              placeholder="例如: http://127.0.0.1:7890 或 socks5://127.0.0.1:7890"
              value={settings.proxyUrl || ''}
              onChange={e => setSettings({ ...settings, proxyUrl: e.target.value })}
            />
            <span className="form-subtext">若服务器连接 Google API 遇到网络受限，可配置 Clash / V2Ray 等出站代理地址。</span>
          </div>

          <div className="form-item">
            <label className="form-label">
              故障账号最大冷却时间 (秒) <span className="help-icon" title="账号遇到 429 配额耗尽或网络异常时的暂时休眠时间">ⓘ</span>
            </label>
            <input
              type="number"
              className="text-input"
              value={settings.maxCooldownSeconds || 60}
              onChange={e => setSettings({ ...settings, maxCooldownSeconds: parseInt(e.target.value, 10) || 60 })}
            />
            <span className="form-subtext">当某个 Google 账号报错时，会自动冷却该时长，期间自动转移至其它健康账号。</span>
          </div>

          <div className="form-item">
            <label className="form-label">
              全局注入 System Prompt (可选) <span className="help-icon" title="会在所有请求最前额外追加该系统提示词">ⓘ</span>
            </label>
            <textarea
              className="text-input"
              rows={3}
              style={{ height: 'auto', padding: '10px 14px', resize: 'vertical' }}
              placeholder="例如: Always respond in Simplified Chinese. / 遵循精简代码输出原则..."
              value={settings.customSystemPrompt || ''}
              onChange={e => setSettings({ ...settings, customSystemPrompt: e.target.value })}
            />
            <span className="form-subtext">可用于统一规范回答风格或注入通用指令。留空则不追加。</span>
          </div>

          <div className="form-item">
            <div className="form-label-row">
              <label className="form-label">调试日志输出 (Verbose Logs)</label>
              <div className="switch-wrapper" onClick={() => setSettings({ ...settings, enableDebugLogs: !settings.enableDebugLogs })}>
                <div className={`switch-control ${settings.enableDebugLogs ? 'checked' : ''}`}>
                  <div className="switch-thumb"></div>
                </div>
              </div>
            </div>
            <span className="form-subtext">开启后将在后端终端输出更多上游交互的详细调试日志。</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>保存系统设置</button>
          </div>
        </form>
      </div>

      {/* Backup & Restore Card */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: 8 }}>全量数据备份与恢复</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          导出当前所有账号凭据、API 密钥、模型路由映射及反向代理参数为 JSON 文件，或从 JSON 文件全量恢复。
        </p>
        
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleDownloadBackup}>
            <DatabaseIcon size={16} /> 导出全量备份 JSON
          </button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            📥 导入恢复 JSON 备份
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Mount React 18 Application
// --------------------------------------------------------------------------
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
