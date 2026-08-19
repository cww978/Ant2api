import React, { useState, useEffect, useRef } from 'react';
import { RequestLogItem } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { apiFetch } from '../api/client';

interface LogsViewProps {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ showToast }) => {
  const [logs, setLogs] = useState<RequestLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<RequestLogItem | null>(null);

  const searchTimerRef = useRef<any>(null);

  const fetchLogs = async (p = page, ps = pageSize, stat = statusFilter, kw = searchKeyword) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(ps),
        status: stat,
        search: kw,
      });
      const res = await apiFetch(`/api/admin/logs?${params.toString()}`);
      if (res.success) {
        setLogs(res.data || res.items || []);
        setTotal(res.total || 0);
      }
    } catch (e: any) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page, pageSize, statusFilter, searchKeyword);
  }, [page, pageSize, statusFilter]);

  // Handle Search Debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchKeyword(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchLogs(1, pageSize, statusFilter, val);
    }, 400);
  };

  // Auto-refresh every 5s if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchLogs(page, pageSize, statusFilter, searchKeyword);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, page, pageSize, statusFilter, searchKeyword]);

  const handleClearLogs = async () => {
    if (!confirm('确定要清空所有请求审计日志吗？')) return;
    try {
      const res = await apiFetch('/api/admin/logs', { method: 'DELETE' });
      if (res.success) {
        showToast('success', '日志已清空');
        fetchLogs(1, pageSize, statusFilter, searchKeyword);
      }
    } catch (e: any) {
      showToast('error', '清空失败', e.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">请求审计日志</h2>
          <p className="page-subtitle">
            查看实时 API 调用流水、响应耗时、状态码、Token 消耗及转译追踪 (共 {total} 条)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自动刷新 (5s)
          </label>
          <button
            className="btn btn-secondary"
            onClick={() => fetchLogs(page, pageSize, statusFilter, searchKeyword)}
            disabled={loading}
          >
            <Icons.RotateCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
          <button className="btn btn-danger" onClick={handleClearLogs}>
            <Icons.Trash2 size={14} /> 清空日志
          </button>
        </div>
      </div>

      <div
        className="glass-card"
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '12px 16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            className="text-input"
            placeholder="搜索模型、路径、邮箱或关键词..."
            value={searchKeyword}
            onChange={handleSearchChange}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="select-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <option value="all">所有状态码</option>
            <option value="success">2xx 成功</option>
            <option value="client_error">4xx 客户端错误</option>
            <option value="server_error">5xx 服务端错误</option>
          </select>

          <select
            className="select-input"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{ width: 110 }}
          >
            <option value={10}>10 条/页</option>
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>方法 / 路径</th>
                <th>请求模型</th>
                <th>账号邮箱</th>
                <th>状态码</th>
                <th>耗时</th>
                <th>Tokens</th>
                <th style={{ width: 80 }}>详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {loading ? '正在加载日志...' : '暂无审计日志记录'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const d = new Date(log.timestamp);
                  const timeStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('zh-CN', { hour12: false })}`;
                  const is2xx = log.statusCode >= 200 && log.statusCode < 300;
                  const is4xx = log.statusCode >= 400 && log.statusCode < 500;
                  const proto = log.protocol || log.method || 'POST';
                  const endp = log.endpoint || log.path || '/v1/chat/completions';
                  const accountDisplay = log.accountName || log.accountEmail || (log.accountId ? `${log.accountId.substring(0, 10)}...` : '-');
                  const tokenCount = log.totalTokens !== undefined && log.totalTokens !== null
                    ? log.totalTokens.toLocaleString()
                    : log.tokensUsed !== undefined && log.tokensUsed !== null
                    ? log.tokensUsed.toLocaleString()
                    : '-';

                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>{timeStr}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            className="badge badge-primary"
                            style={{ fontSize: '0.68rem', padding: '1px 6px', textTransform: 'uppercase' }}
                          >
                            {proto}
                          </span>
                          <code style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                            {endp}
                          </code>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: 'var(--accent-indigo)' }}>
                          {log.model || '-'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>
                        {accountDisplay}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            is2xx
                              ? 'badge-status-enabled'
                              : is4xx
                              ? 'badge-status-disabled'
                              : 'badge-status-disabled'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                        {log.latencyMs} ms
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-amber)', fontWeight: 600 }}>
                        {tokenCount}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.85rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            第 {page} / {totalPages} 页 (共 {total} 条记录)
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      <Modal
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="请求审计详情"
        maxWidth={700}
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <span className="form-subtext">请求时间</span>
                <div style={{ fontWeight: 600 }}>{new Date(selectedLog.timestamp).toLocaleString()}</div>
              </div>
              <div>
                <span className="form-subtext">响应耗时</span>
                <div style={{ fontWeight: 600 }}>{selectedLog.latencyMs} ms</div>
              </div>
              <div>
                <span className="form-subtext">协议与请求端点</span>
                <div style={{ fontWeight: 600 }}>
                  <span className="badge badge-primary" style={{ marginRight: 6 }}>
                    {selectedLog.protocol || selectedLog.method || 'POST'}
                  </span>
                  <code>{selectedLog.endpoint || selectedLog.path || '/v1/chat/completions'}</code>
                </div>
              </div>
              <div>
                <span className="form-subtext">HTTP 状态码</span>
                <div style={{ fontWeight: 600 }}>
                  <span
                    className={`badge ${
                      selectedLog.statusCode >= 200 && selectedLog.statusCode < 300
                        ? 'badge-status-enabled'
                        : 'badge-status-disabled'
                    }`}
                  >
                    {selectedLog.statusCode}
                  </span>
                </div>
              </div>
              <div>
                <span className="form-subtext">请求模型</span>
                <div style={{ fontWeight: 600, color: 'var(--accent-indigo)' }}>
                  {selectedLog.model}
                  {selectedLog.mappedModel && selectedLog.mappedModel !== selectedLog.model && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {' '}➔ {selectedLog.mappedModel}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="form-subtext">调用 Google 账号</span>
                <div style={{ fontWeight: 600 }}>
                  {selectedLog.accountName || selectedLog.accountEmail || '默认账号'}
                </div>
              </div>
              <div>
                <span className="form-subtext">Tokens 消耗统计</span>
                <div style={{ fontWeight: 600, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                  总计 {selectedLog.totalTokens || selectedLog.tokensUsed || 0}
                  {selectedLog.inputTokens !== undefined && selectedLog.outputTokens !== undefined && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                      (输入: {selectedLog.inputTokens}, 输出: {selectedLog.outputTokens})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="form-subtext">客户端 IP / API 密钥</span>
                <div style={{ fontWeight: 600 }}>
                  {selectedLog.clientIp || '127.0.0.1'} ({selectedLog.apiKeyName || 'Master Key'})
                </div>
              </div>
            </div>

            {selectedLog.errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: 12,
                  borderRadius: 6,
                  color: 'var(--accent-rose)',
                  fontSize: '0.85rem',
                }}
              >
                <strong>错误异常：</strong> {selectedLog.errorMessage}
              </div>
            )}

            {selectedLog.requestBodyPreview && (
              <div>
                <span className="form-help" style={{ marginBottom: 4, display: 'block' }}>
                  入站请求 Payload 预览
                </span>
                <pre
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 200,
                    overflow: 'auto',
                    fontSize: '0.8rem',
                  }}
                >
                  {selectedLog.requestBodyPreview}
                </pre>
              </div>
            )}

            {selectedLog.responseBodyPreview && (
              <div>
                <span className="form-help" style={{ marginBottom: 4, display: 'block' }}>
                  出站响应 Preview
                </span>
                <pre
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 200,
                    overflow: 'auto',
                    fontSize: '0.8rem',
                  }}
                >
                  {selectedLog.responseBodyPreview}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
