import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { Icons } from '../components/Icons';
import { apiFetch } from '../api/client';

interface SettingsViewProps {
  config: AppConfig | null;
  onReload: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onReload,
  showToast,
}) => {
  const [outboundProxy, setOutboundProxy] = useState('');
  const [strategy, setStrategy] = useState<'round-robin' | 'least-errors' | 'random'>('round-robin');
  const [userAgent, setUserAgent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setOutboundProxy(config.outboundProxy || '');
      setStrategy(config.loadBalancingStrategy || 'round-robin');
      setUserAgent(config.userAgentOverride || '');
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify({
          outboundProxy: outboundProxy.trim() || undefined,
          loadBalancingStrategy: strategy,
          userAgentOverride: userAgent.trim() || undefined,
        }),
      });
      if (res.success) {
        showToast('success', '高级设置保存成功');
        onReload();
      } else {
        showToast('error', '保存失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '保存失败', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = () => {
    window.open('/api/admin/backup', '_blank');
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('恢复数据库将覆盖当前所有账号、密钥与配置，是否继续？')) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const json = JSON.parse(text);
        const res = await apiFetch('/api/admin/restore', {
          method: 'POST',
          body: JSON.stringify(json),
        });
        if (res.success) {
          showToast('success', '数据库恢复成功', '系统数据已重新加载');
          onReload();
        } else {
          showToast('error', '恢复失败', res.message);
        }
      } catch (err: any) {
        showToast('error', '恢复解析失败', err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 className="page-title">系统高级设置</h2>
        <p className="page-subtitle">
          配置出站科学代理、负载均衡调度策略与系统全量数据备份 / 恢复
        </p>
      </div>

      <div className="glass-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <Icons.Shield size={18} color="var(--primary)" />
            <h3 className="card-title">出站代理与调度设置</h3>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="config-form-grid">
            <div className="form-item">
              <label className="form-label">出站上游科学代理 (Outbound Proxy)</label>
              <input
                type="text"
                className="text-input font-mono"
                placeholder="例如: http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
                value={outboundProxy}
                onChange={(e) => setOutboundProxy(e.target.value)}
              />
              <span className="form-subtext">
                用于在国内服务器或特定网络环境下访问 Google Cloud Code API
              </span>
            </div>

            <div className="form-item">
              <label className="form-label">账号池负载均衡策略</label>
              <select
                className="select-input"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
              >
                <option value="round-robin">平滑轮询 (Round-Robin - 均衡分配)</option>
                <option value="least-errors">最少失败优先 (Least-Errors - 稳定性优先)</option>
                <option value="random">完全随机 (Random - 随机分流)</option>
              </select>
              <span className="form-subtext">控制多个 Google 账号并发调用的调度分发算法</span>
            </div>

            <div className="form-item full-width">
              <label className="form-label">自定义 User-Agent 伪装覆盖 (可选)</label>
              <input
                type="text"
                className="text-input"
                placeholder="留空则使用内置 Antigravity/2.0 官方标识"
                value={userAgent}
                onChange={(e) => setUserAgent(e.target.value)}
              />
              <span className="form-subtext">自定义请求 Google 时的客户端标识标头</span>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '正在保存...' : '保存设置'}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-card">
        <h3 className="section-title" style={{ marginBottom: 16 }}>
          <Icons.Server size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          数据备份与恢复
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
          一键导出完整数据库 JSON 备份（包含所有已接入账号、API 密钥、模型路由及配置），或从本地文件快速导入迁移。
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={handleBackup}>
            <Icons.ExternalLink size={16} /> 导出全量 JSON 备份
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Icons.RotateCw size={16} /> 导入恢复备份
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleRestore}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
