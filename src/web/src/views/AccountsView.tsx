import React, { useState, useEffect } from 'react';
import { AccountItem, QuotaInfo } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { apiFetch } from '../api/client';

interface AccountsViewProps {
  accounts: AccountItem[];
  onReload: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  onReload,
  showToast,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [authMode, setAuthMode] = useState<'oauth' | 'manual'>('oauth');
  const [oauthUrl, setOauthUrl] = useState('');
  const [oauthCode, setOauthCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [, setTick] = useState(0);

  // Live timer tick every 10s for countdown updates
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenAddModal = async () => {
    setShowModal(true);
    setAuthMode('oauth');
    setOauthCode('');
    setManualToken('');
    setAccountName('');
    try {
      const res = await apiFetch('/api/admin/oauth/url');
      if (res.success && res.url) {
        setOauthUrl(res.url);
      }
    } catch {}
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await apiFetch('/api/admin/accounts/sync-all', { method: 'POST' });
      if (res.success) {
        showToast('success', '同步成功', '所有账号真实邮箱与模型配额已同步更新');
        onReload();
      } else {
        showToast('error', '同步失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '同步失败', e.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRefreshOne = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/accounts/${id}/refresh`, { method: 'POST' });
      if (res.success) {
        showToast('success', '刷新成功', '账号元数据与配额已更新');
        onReload();
      } else {
        showToast('error', '刷新失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '刷新失败', e.message);
    }
  };

  const handleTestOne = async (id: string) => {
    try {
      showToast('info', '正在测试连接', '向 Google Cloud Code 发起测试探测...');
      const res = await apiFetch(`/api/admin/accounts/${id}/test`, { method: 'POST' });
      if (res.success) {
        showToast('success', '测试通过', `响应延迟: ${res.latencyMs || 0}ms`);
      } else {
        showToast('error', '测试失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '测试失败', e.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要从账号池中删除账号「${name}」吗？`)) return;
    try {
      const res = await apiFetch(`/api/admin/accounts/${id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('success', '账号已删除');
        onReload();
      } else {
        showToast('error', '删除失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '删除失败', e.message);
    }
  };

  const handleToggle = async (acc: AccountItem) => {
    try {
      const res = await apiFetch(`/api/admin/accounts/${acc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !acc.enabled }),
      });
      if (res.success) {
        showToast('success', acc.enabled ? '已禁用账号' : '已启用账号');
        onReload();
      }
    } catch (e: any) {
      showToast('error', '切换失败', e.message);
    }
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (authMode === 'oauth') {
        if (!oauthCode.trim()) {
          showToast('warning', '请填入回调授权码或 URL');
          setSubmitting(false);
          return;
        }

        let cleanCode = oauthCode.trim();
        if (cleanCode.includes('code=')) {
          const match = cleanCode.match(/[?&]code=([^&]+)/);
          if (match) cleanCode = decodeURIComponent(match[1]);
        }

        const exchangeRes = await apiFetch('/api/admin/oauth/exchange', {
          method: 'POST',
          body: JSON.stringify({ code: cleanCode }),
        });

        if (exchangeRes.success && (exchangeRes.data?.refresh_token || exchangeRes.data?.access_token)) {
          const addRes = await apiFetch('/api/admin/accounts', {
            method: 'POST',
            body: JSON.stringify({
              name: accountName.trim() || 'Google Account',
              refreshToken: exchangeRes.data.refresh_token,
              accessToken: exchangeRes.data.access_token,
            }),
          });
          if (addRes.success) {
            showToast('success', '授权成功', '账号已成功接入账号池并完成配额同步');
            setShowModal(false);
            onReload();
          } else {
            showToast('error', '添加失败', addRes.message);
          }
        } else {
          showToast('error', '换取 Token 失败', exchangeRes.message || '无效的授权码或已过期');
        }
      } else {
        if (!manualToken.trim()) {
          showToast('warning', '请填入 Refresh Token');
          setSubmitting(false);
          return;
        }
        const res = await apiFetch('/api/admin/accounts', {
          method: 'POST',
          body: JSON.stringify({
            name: accountName.trim() || 'Manual Account',
            refreshToken: manualToken.trim(),
          }),
        });
        if (res.success) {
          showToast('success', '添加成功');
          setShowModal(false);
          onReload();
        } else {
          showToast('error', '添加失败', res.message);
        }
      }
    } catch (e: any) {
      showToast('error', '提交失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getLiveCountdown = (resetTimeStr?: string, fallback?: string) => {
    if (!resetTimeStr) return fallback || '';
    const resetDate = new Date(resetTimeStr);
    const diffMs = resetDate.getTime() - Date.now();
    if (diffMs <= 0) return '已重置';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const formatQuotasList = (quotas?: Record<string, QuotaInfo>) => {
    if (!quotas || Object.keys(quotas).length === 0) return null;
    const priorityModels = [
      'Gemini 3.1 Pro (High)',
      'Gemini 3.5 Flash (High)',
      'Gemini 3.6 Flash (High)',
      'Gemini 3 Flash',
      'Gemini 2.5 Pro',
    ];

    for (const key of priorityModels) {
      if (quotas[key]) {
        return [{ name: key, ...quotas[key] }];
      }
    }

    for (const [k, v] of Object.entries(quotas)) {
      if (k.toLowerCase().includes('gemini')) {
        return [{ name: k, ...v }];
      }
    }

    const firstKey = Object.keys(quotas)[0];
    return firstKey ? [{ name: firstKey, ...quotas[firstKey] }] : null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">Google / Antigravity 账号池</h2>
          <p className="page-subtitle">
            管理多账号并发轮询、智能故障转移与真实 Google 邮箱配额监控
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={handleSyncAll}
            disabled={syncingAll}
          >
            <Icons.RotateCw
              size={16}
              className={syncingAll ? 'animate-spin' : ''}
            />{' '}
            {syncingAll ? '同步中...' : '同步配额与信息'}
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Icons.Plus size={16} /> 添加账号
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 230 }}>邮箱</th>
                <th style={{ minWidth: 420 }}>模型配额</th>
                <th>总请求 / 失败</th>
                <th>最后使用</th>
                <th style={{ width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    暂无账号，请点击右上角“添加账号”接入 Google 凭据
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => {
                  const displayEmail = acc.email || acc.name;
                  const quotaItems = formatQuotasList(acc.quotas);

                  let lastDate = '从未';
                  let lastTime = '';
                  if (acc.lastUsedAt) {
                    const d = new Date(acc.lastUsedAt);
                    lastDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                    lastTime = d.toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    });
                  }

                  return (
                    <tr key={acc.id}>
                      <td>
                        <div className="account-email-cell">
                          <span className="account-email-title">{displayEmail}</span>
                          {acc.enabled ? (
                            <span
                              className="badge-status-enabled"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleToggle(acc)}
                              title="点击禁用此账号"
                            >
                              ● 正常可用
                            </span>
                          ) : (
                            <span
                              className="badge-status-disabled"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleToggle(acc)}
                              title="点击启用此账号"
                            >
                              🚫 反代已禁用
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {quotaItems && quotaItems.length > 0 ? (
                          <div className="quotas-grid">
                            {quotaItems.map((q, qIdx) => {
                              const liveTimer = getLiveCountdown(
                                q.resetTime,
                                q.resetIn
                              );
                              return (
                                <div className="quota-item-pill" key={qIdx}>
                                  <span className="quota-model-icon">✦</span>
                                  <span className="quota-model-name" title={q.name}>
                                    {q.name}
                                  </span>
                                  {liveTimer && (
                                    <span className="quota-timer">🕒 {liveTimer}</span>
                                  )}
                                  <span
                                    className={`quota-percentage ${
                                      q.percentage === '0%' ? 'depleted' : ''
                                    }`}
                                  >
                                    {q.percentage}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {acc.refreshToken ? '正在等待配额同步...' : '暂无配额数据'}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {acc.totalRequests || 0}{' '}
                          <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                            /
                          </span>{' '}
                          <span
                            style={{
                              color:
                                acc.failedRequests > 0
                                  ? 'var(--accent-rose)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {acc.failedRequests || 0}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-main)',
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {lastDate}
                          {lastTime ? ` ${lastTime}` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="测试连接"
                            onClick={() => handleTestOne(acc.id)}
                          >
                            测试
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="刷新元数据与配额"
                            onClick={() => handleRefreshOne(acc.id)}
                          >
                            刷新
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            title="删除账号"
                            onClick={() => handleDelete(acc.id, displayEmail)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="接入 Google / Antigravity 账号"
        maxWidth={580}
      >
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            className={`btn ${authMode === 'oauth' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setAuthMode('oauth')}
          >
            Google OAuth 浏览器一键授权 (推荐)
          </button>
          <button
            className={`btn ${authMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setAuthMode('manual')}
          >
            手动填入 Refresh Token
          </button>
        </div>

        <form onSubmit={handleSubmitAccount}>
          {authMode === 'oauth' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  padding: '12px 16px',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                }}
              >
                <strong>操作流程：</strong>
                <ol style={{ paddingLeft: 18, marginTop: 4, marginBottom: 0 }}>
                  <li>点击下方按钮在浏览器中打开 Google 授权页面</li>
                  <li>登录并同意 Antigravity / Cloud Code 权限</li>
                  <li>将授权完成后的回调 URL 或授权码粘贴至下方输入框</li>
                </ol>
              </div>

              {oauthUrl && (
                <a
                  href={oauthUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}
                >
                  <Icons.ExternalLink size={16} /> 1. 点击前往 Google 登录并授权
                </a>
              )}

              <div className="form-item">
                <label className="form-label">2. 授权回调 URL 或 Code</label>
                <textarea
                  className="text-input font-mono"
                  style={{ height: 80, padding: '10px 14px' }}
                  placeholder="粘贴浏览器地址栏重定向后的链接 (http://localhost:8085/?code=4/0A...) 或纯 code"
                  value={oauthCode}
                  onChange={(e) => setOauthCode(e.target.value)}
                />
              </div>

              <div className="form-item">
                <label className="form-label">账号备注名称 (可选)</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="系统会自动获取 Google 邮箱，可留空"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-item">
                <label className="form-label">账号备注名称</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="例如: Google Main"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              <div className="form-item">
                <label className="form-label">Refresh Token</label>
                <textarea
                  className="text-input font-mono"
                  style={{ height: 100, padding: '10px 14px' }}
                  placeholder="填入 1//0e... 开头的 Google OAuth Refresh Token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '正在接入...' : '确认接入'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
