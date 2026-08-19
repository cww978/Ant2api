import React from 'react';
import { ActiveTab, AppConfig } from '../types';
import { Icons } from './Icons';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  config: AppConfig | null;
  accountsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  config,
  accountsCount,
}) => {
  const isRunning = config?.proxyStatus?.running ?? false;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'overview', label: '系统概览', icon: <Icons.Activity size={18} /> },
    {
      id: 'service',
      label: '服务配置',
      icon: <Icons.Server size={18} />,
      badge: isRunning ? '运行中' : '已停止',
    },
    {
      id: 'accounts',
      label: '账号管理',
      icon: <Icons.Users size={18} />,
      badge: accountsCount > 0 ? accountsCount : undefined,
    },
    { id: 'keys', label: 'API 密钥', icon: <Icons.Key size={18} /> },
    { id: 'mappings', label: '模型路由', icon: <Icons.Shuffle size={18} /> },
    { id: 'logs', label: '审计日志', icon: <Icons.FileText size={18} /> },
    { id: 'settings', label: '高级设置', icon: <Icons.Settings size={18} /> },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">⚡</div>
        <div className="brand-info">
          <h1 className="brand-name">Ant2api</h1>
          <span className="brand-version">v1.0.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`nav-badge ${
                  item.id === 'service'
                    ? isRunning
                      ? 'badge-success'
                      : 'badge-muted'
                    : ''
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="service-pill">
          <span className={`status-dot ${isRunning ? 'dot-active' : 'dot-inactive'}`} />
          <span className="service-status-text">
            {isRunning ? `端口 :${config?.port || 8045}` : '反代服务未运行'}
          </span>
        </div>
      </div>
    </aside>
  );
};
