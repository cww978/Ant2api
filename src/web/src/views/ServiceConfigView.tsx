import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { Icons } from '../components/Icons';
import { apiFetch } from '../api/client';

interface ServiceConfigViewProps {
  config: AppConfig | null;
  onReload: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const ServiceConfigView: React.FC<ServiceConfigViewProps> = ({
  config,
  onReload,
  showToast,
}) => {
  const [formData, setFormData] = useState<Partial<AppConfig>>({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        port: config.port,
        authMode: config.authMode,
        proxyTimeout: config.proxyTimeout,
        masterKey: config.masterKey,
        uiPassword: config.uiPassword || '',
        allowLanAccess: config.allowLanAccess ?? true,
        userAgentOverride: config.userAgentOverride || '',
      });
    }
  }, [config]);

  const isRunning = config?.status === 'running' || config?.proxyStatus?.running || false;

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action);
    try {
      const res = await apiFetch(`/api/admin/proxy/${action}`, { method: 'POST' });
      if (res.success) {
        showToast('success', `服务已${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}`);
        onReload();
      } else {
        showToast('error', '操作失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '操作失败', e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/proxy/config', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (res.success) {
        showToast('success', '配置保存成功', '若修改了端口或监听地址，请重启反代服务生效');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">服务配置 & 生命周期管理</h2>
          <p className="page-subtitle">
            控制 API 反代服务的启停、监听端口、鉴权策略与安全凭据
          </p>
        </div>
      </div>

      {/* Service Status Bar */}
      <div className="config-service-header">
        <div className="service-status-display">
          <span className={`status-indicator-dot ${isRunning ? 'running' : 'stopped'}`} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
              API 反代服务状态：{isRunning ? '正在运行 (Running)' : '已停止 (Stopped)'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
              当前监听：{config?.allowLanAccess ? '0.0.0.0' : '127.0.0.1'}:{config?.port || 8045}
            </div>
          </div>
        </div>

        <div className="service-action-buttons">
          {!isRunning ? (
            <button
              className="btn btn-emerald"
              onClick={() => handleAction('start')}
              disabled={actionLoading !== null}
            >
              <Icons.Play size={16} /> 启动服务
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => handleAction('restart')}
                disabled={actionLoading !== null}
              >
                <Icons.RotateCw
                  size={16}
                  className={actionLoading === 'restart' ? 'animate-spin' : ''}
                />{' '}
                重启服务
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleAction('stop')}
                disabled={actionLoading !== null}
              >
                <Icons.Square size={16} /> 停止服务
              </button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <Icons.Sliders size={18} color="var(--primary)" />
            <h3 className="card-title">反代核心参数配置</h3>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="config-form-grid">
            <div className="form-item">
              <label className="form-label">反向代理监听端口</label>
              <input
                type="number"
                className="text-input"
                value={formData.port || 8045}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) || 8045 })
                }
              />
              <span className="form-subtext">供客户端连接的 HTTP 接口端口（默认: 8045）</span>
            </div>

            <div className="form-item">
              <label className="form-label">客户端鉴权模式</label>
              <select
                className="select-input"
                value={formData.authMode || 'auto'}
                onChange={(e) =>
                  setFormData({ ...formData, authMode: e.target.value as any })
                }
              >
                <option value="auto">自动探测 (Auto - 兼容 Master Key & 自建 Key)</option>
                <option value="strict">严格模式 (Strict - 仅允许有效的 Key)</option>
                <option value="disabled">免鉴权 (Disabled - 局域网/内网开发使用)</option>
              </select>
              <span className="form-subtext">控制外部客户端请求反代接口时的 Token 校验机制</span>
            </div>

            <div className="form-item">
              <label className="form-label">主 API 密钥 (Master Key)</label>
              <input
                type="text"
                className="text-input font-mono"
                value={formData.masterKey || ''}
                onChange={(e) => setFormData({ ...formData, masterKey: e.target.value })}
              />
              <span className="form-subtext">拥有最高权限的主凭据，支持访问所有已映射模型</span>
            </div>

            <div className="form-item">
              <label className="form-label">控制台管理密码 (UI Password)</label>
              <input
                type="password"
                className="text-input"
                placeholder="留空则使用默认密码 ant2api_admin"
                value={formData.uiPassword || ''}
                onChange={(e) => setFormData({ ...formData, uiPassword: e.target.value })}
              />
              <span className="form-subtext">保护此 Web 管理控制台访问安全的密码</span>
            </div>

            <div className="form-item">
              <label className="form-label">请求超时时间 (秒)</label>
              <input
                type="number"
                className="text-input"
                value={formData.proxyTimeout || 120}
                onChange={(e) =>
                  setFormData({ ...formData, proxyTimeout: parseInt(e.target.value) || 120 })
                }
              />
              <span className="form-subtext">单个 LLM 流式与推理请求最大允许等待时长</span>
            </div>

            <div className="form-item">
              <label className="form-label">局域网广播绑定</label>
              <select
                className="select-input"
                value={formData.allowLanAccess ? 'true' : 'false'}
                onChange={(e) =>
                  setFormData({ ...formData, allowLanAccess: e.target.value === 'true' })
                }
              >
                <option value="true">0.0.0.0 (允许局域网与公网设备连接)</option>
                <option value="false">127.0.0.1 (仅允许本机回环连接)</option>
              </select>
              <span className="form-subtext">设置反代服务的网络监听范围</span>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '正在保存...' : '保存服务配置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
