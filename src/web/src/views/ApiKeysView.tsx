import React, { useState } from 'react';
import { ApiKeyItem } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { apiFetch } from '../api/client';

interface ApiKeysViewProps {
  apiKeys: ApiKeyItem[];
  onReload: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({
  apiKeys,
  onReload,
  showToast,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [rateLimit, setRateLimit] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      showToast('warning', '请填写密钥备注名称');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: keyName.trim(),
          key: customKey.trim() || undefined,
          rateLimitRPM: rateLimit ? Number(rateLimit) : undefined,
        }),
      });
      if (res.success) {
        showToast('success', '创建成功', '新 API 密钥已生成');
        setShowModal(false);
        setKeyName('');
        setCustomKey('');
        setRateLimit('');
        onReload();
      } else {
        showToast('error', '创建失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '创建失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除密钥「${name}」吗？使用此 Key 的客户端将无法继续调用。`)) return;
    try {
      const res = await apiFetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('success', '密钥已删除');
        onReload();
      } else {
        showToast('error', '删除失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '删除失败', e.message);
    }
  };

  const handleToggle = async (k: ApiKeyItem) => {
    try {
      const res = await apiFetch(`/api/admin/keys/${k.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !k.enabled }),
      });
      if (res.success) {
        showToast('success', k.enabled ? '已禁用密钥' : '已启用密钥');
        onReload();
      }
    } catch (e: any) {
      showToast('error', '操作失败', e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">客户端 API 密钥管理</h2>
          <p className="page-subtitle">
            为不同客户端（NextChat、Cursor、ChatBox）分发独立凭据与速率限制
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Icons.Plus size={16} /> 创建新密钥
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>名称 / 标识</th>
                <th>API 密钥 (Token)</th>
                <th>状态</th>
                <th>RPM 速率限制</th>
                <th>累计调用</th>
                <th style={{ width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    暂无自定义密钥，您可点击右上角创建，或直接使用服务配置中的 Master Key
                  </td>
                </tr>
              ) : (
                apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 600 }}>{k.name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: '0.85rem' }}>{k.key}</code>
                        <button
                          className="btn-icon"
                          onClick={() => handleCopy(k.key, k.id)}
                          title="复制密钥"
                        >
                          {copiedId === k.id ? <Icons.Check size={14} /> : <Icons.Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge-status-${k.enabled ? 'enabled' : 'disabled'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggle(k)}
                      >
                        {k.enabled ? '● 已启用' : '🚫 已禁用'}
                      </span>
                    </td>
                    <td>{k.rateLimitPerMin || k.rateLimitRPM ? `${k.rateLimitPerMin || k.rateLimitRPM} RPM` : '无限制'}</td>
                    <td>{(k.totalRequests !== undefined ? k.totalRequests : k.totalUsage) || 0} 次</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(k.id, k.name)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="创建客户端 API 密钥">
        <form onSubmit={handleCreate}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-item">
              <label className="form-label">密钥名称 / 用途备注</label>
              <input
                type="text"
                className="text-input"
                placeholder="例如: Cursor IDE / NextChat Production"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-item">
              <label className="form-label">自定义 Key (可选，留空系统将自动生成)</label>
              <input
                type="text"
                className="text-input font-mono"
                placeholder="sk-ant2api-..."
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
              />
            </div>

            <div className="form-item">
              <label className="form-label">速率限制 RPM (可选，留空无限制)</label>
              <input
                type="number"
                className="text-input"
                placeholder="每分钟最大请求数"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '正在生成...' : '立即创建'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
