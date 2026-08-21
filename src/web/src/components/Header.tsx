import React from 'react';
import { AppConfig, DashboardStats } from '../types';
import { Icons } from './Icons';

interface HeaderProps {
  config: AppConfig | null;
  stats: DashboardStats | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  stats,
  onRefresh,
  isRefreshing,
  onLogout,
}) => {
  const isRunning = config?.status === 'running' || config?.proxyStatus?.running || false;

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="status-indicator-badge">
          <span className={`status-dot ${isRunning ? 'dot-active' : 'dot-inactive'}`} />
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {isRunning ? '代理运行中' : '代理已停止'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            ({config?.allowLanAccess ? '0.0.0.0' : '127.0.0.1'}:{config?.port || 8045})
          </span>
        </div>
      </div>

      <div className="header-right">
        {stats && (
          <div className="header-stats">
            <span className="stat-badge">
              成功率: {stats.successRate !== undefined ? stats.successRate : 100}%
            </span>
            <span className="stat-badge">
              延迟: {Math.round(stats.avgLatencyMs || 0)}ms
            </span>
          </div>
        )}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="刷新数据"
        >
          <Icons.RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onLogout} title="退出登录">
          <Icons.LogOut size={14} />
        </button>
      </div>
    </header>
  );
};
