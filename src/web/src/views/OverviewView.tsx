import React, { useState } from 'react';
import { DashboardStats, AppConfig, AccountItem } from '../types';
import { Icons } from '../components/Icons';

interface OverviewViewProps {
  stats: DashboardStats | null;
  config: AppConfig | null;
  accounts: AccountItem[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  config,
  accounts,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const proxyPort = config?.port || 8045;
  const isRunning = config?.proxyStatus?.running ?? false;
  const host = window.location.hostname || 'localhost';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const statCards = [
    {
      title: '总请求量',
      value: stats ? (stats.totalRequests || 0).toLocaleString() : '0',
      sub: stats
        ? `成功率: ${stats.successRate !== undefined ? stats.successRate : 100}%`
        : '成功率: 100%',
      icon: <Icons.Activity size={18} color="var(--accent-cyan)" />,
    },
    {
      title: 'Token 吞吐量',
      value: stats ? (stats.totalTokens || 0).toLocaleString() : '0',
      sub: '累计转译消耗',
      icon: <Icons.Zap size={18} color="var(--accent-amber)" />,
    },
    {
      title: '平均延迟',
      value: stats ? `${Math.round(stats.avgLatencyMs || 0)} ms` : '0 ms',
      sub: `失败请求: ${stats ? (stats.totalErrors || 0) : 0} 次`,
      icon: <Icons.Clock size={18} color="var(--accent-emerald)" />,
    },
    {
      title: '可用账号池',
      value: `${accounts.filter((a) => a.enabled).length} / ${accounts.length}`,
      sub: `运行状态: ${isRunning ? '服务运行中' : '服务已停止'}`,
      icon: <Icons.Users size={18} color="var(--accent-purple)" />,
    },
  ];

  const endpoints = [
    {
      title: 'OpenAI 兼容端点 (NextChat, ChatBox, Cherry Studio, Cursor)',
      url: `http://${host}:${proxyPort}/v1/chat/completions`,
      method: 'POST',
      key: 'openai',
    },
    {
      title: 'Codex / ChatGPT 官方客户端端点',
      url: `http://${host}:${proxyPort}/v1/responses`,
      method: 'POST',
      key: 'codex',
    },
    {
      title: 'Codex FIM 代码补全端点 (Continue.dev, Copilot)',
      url: `http://${host}:${proxyPort}/v1/completions`,
      method: 'POST',
      key: 'fim',
    },
    {
      title: 'Gemini 原生 SDK 端点',
      url: `http://${host}:${proxyPort}/v1beta/models`,
      method: 'POST',
      key: 'gemini',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">系统概览</h2>
          <p className="page-subtitle">
            实时性能监控、Token 吞吐量统计与客户端接入端点
          </p>
        </div>
      </div>

      <div className="metrics-grid">
        {statCards.map((card, idx) => (
          <div key={idx} className="metric-card">
            <div className="metric-label">
              <span>{card.title}</span>
              {card.icon}
            </div>
            <div className="metric-value">{card.value}</div>
            <div className="metric-subtext">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="glass-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <Icons.Globe size={18} color="var(--primary)" />
            <h3 className="card-title">客户端接入端点速查</h3>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {endpoints.map((ep) => (
            <div key={ep.key} className="endpoint-box">
              <div>
                <span className="badge badge-primary" style={{ marginRight: 10 }}>
                  {ep.method}
                </span>
                <strong style={{ color: 'var(--text-main)' }}>{ep.title}</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4 }}>
                  {ep.url}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(ep.url, ep.key)}
              >
                {copiedKey === ep.key ? (
                  <>
                    <Icons.Check size={14} /> 已复制
                  </>
                ) : (
                  <>
                    <Icons.Copy size={14} /> 复制
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
