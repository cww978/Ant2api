import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveTab,
  AppConfig,
  DashboardStats,
  AccountItem,
  ApiKeyItem,
  ModelMapping,
} from './types';
import { apiFetch } from './api/client';
import { Icons } from './components/Icons';
import { ToastContainer, ToastMessage } from './components/Toast';
import { LoginView } from './views/LoginView';

import { OverviewView } from './views/OverviewView';
import { ServiceConfigView } from './views/ServiceConfigView';
import { AccountsView } from './views/AccountsView';
import { ApiKeysView } from './views/ApiKeysView';
import { ModelMappingsView } from './views/ModelMappingsView';
import { LogsView } from './views/LogsView';
import { SettingsView } from './views/SettingsView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('ant2api_auth_token'));
  });

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [mappings, setMappings] = useState<ModelMapping[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
      const id = String(Date.now() + Math.random());
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadAllData = useCallback(async () => {
    const token = localStorage.getItem('ant2api_auth_token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    setIsRefreshing(true);
    try {
      const [proxyConfigRes, statsRes, accountsRes, keysRes, mappingsRes] = await Promise.all([
        apiFetch('/api/admin/proxy/config'),
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/accounts'),
        apiFetch('/api/admin/keys'),
        apiFetch('/api/admin/mappings'),
      ]);

      if (proxyConfigRes?.data) setConfig(proxyConfigRes.data);
      if (statsRes?.data) setStats(statsRes.data);
      if (accountsRes?.data) setAccounts(accountsRes.data || []);
      if (keysRes?.data) setApiKeys(keysRes.data || []);
      if (mappingsRes?.data) setMappings(mappingsRes.data || []);
      setIsAuthenticated(true);
    } catch (e: any) {
      console.error('Failed to load admin data:', e);
      localStorage.removeItem('ant2api_auth_token');
      setIsAuthenticated(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('ant2api_auth_token')) {
      loadAllData();
    } else {
      setIsAuthenticated(false);
    }

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('ant2api:unauthorized', handleUnauthorized);

    const interval = setInterval(() => {
      if (!localStorage.getItem('ant2api_auth_token')) return;
      apiFetch('/api/admin/stats')
        .then((res) => {
          if (res?.data) setStats(res.data);
        })
        .catch(() => {});
      apiFetch('/api/admin/proxy/config')
        .then((res) => {
          if (res?.data) setConfig(res.data);
        })
        .catch(() => {});
    }, 8000);

    return () => {
      window.removeEventListener('ant2api:unauthorized', handleUnauthorized);
      clearInterval(interval);
    };
  }, [loadAllData]);

  const handleLogin = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('ant2api_auth_token', data.token);
        setIsAuthenticated(true);
        showToast('success', '登录成功', '欢迎使用 Ant2api 管理系统');
        loadAllData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ant2api_auth_token');
    setIsAuthenticated(false);
    showToast('info', '已退出登录');
  };

  const isRunning = config?.status === 'running' || config?.proxyStatus?.running || false;

  if (!isAuthenticated) {
    return (
      <>
        <div className="app-background-glow" />
        <LoginView onLogin={handleLogin} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <>
      <div className="app-background-glow" />

      {/* Top Sticky Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo-icon">⚡</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="brand-title">Ant2api</span>
            <span className="brand-subtitle">v1.0.0</span>
          </div>
          <a
            href="https://github.com/cww978/Ant2api"
            target="_blank"
            rel="noopener noreferrer"
            className="brand-github-link"
            title="访问 GitHub 开源仓库"
          >
            <Icons.Github size={14} />
            <span>GitHub</span>
          </a>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Icons.Activity size={16} /> 概览
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'service' ? 'active' : ''}`}
            onClick={() => setActiveTab('service')}
          >
            <Icons.Server size={16} /> 服务配置
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <Icons.Users size={16} /> 账号池
            {accounts.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.18)',
                  marginLeft: 3,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {accounts.length}
              </span>
            )}
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            <Icons.Key size={16} /> API 密钥
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'mappings' ? 'active' : ''}`}
            onClick={() => setActiveTab('mappings')}
          >
            <Icons.Shuffle size={16} /> 模型路由
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <Icons.FileText size={16} /> 审计日志
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Icons.Settings size={16} /> 高级设置
          </button>
        </nav>

        <div className="header-actions">
          <div className="header-status-pill">
            <span className={`status-indicator-dot ${isRunning ? 'running' : 'stopped'}`} />
            <span>{isRunning ? '代理运行中' : '代理已停止'}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              ({config?.allowLanAccess ? '0.0.0.0' : '127.0.0.1'}:{config?.port || 8045})
            </span>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadAllData}
            disabled={isRefreshing}
            title="刷新数据"
          >
            <Icons.RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} title="退出登录">
            <Icons.LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {activeTab === 'overview' && (
          <OverviewView stats={stats} config={config} accounts={accounts} />
        )}
        {activeTab === 'service' && (
          <ServiceConfigView
            config={config}
            onReload={loadAllData}
            showToast={showToast}
          />
        )}
        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            onReload={loadAllData}
            showToast={showToast}
          />
        )}
        {activeTab === 'keys' && (
          <ApiKeysView
            apiKeys={apiKeys}
            onReload={loadAllData}
            showToast={showToast}
          />
        )}
        {activeTab === 'mappings' && (
          <ModelMappingsView
            mappings={mappings}
            onReload={loadAllData}
            showToast={showToast}
          />
        )}
        {activeTab === 'logs' && <LogsView showToast={showToast} />}
        {activeTab === 'settings' && (
          <SettingsView
            config={config}
            onReload={loadAllData}
            showToast={showToast}
          />
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};
