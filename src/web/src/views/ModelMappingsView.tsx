import React, { useState } from 'react';
import { ModelMapping } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { apiFetch } from '../api/client';

interface ModelMappingsViewProps {
  mappings: ModelMapping[];
  onReload: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const ModelMappingsView: React.FC<ModelMappingsViewProps> = ({
  mappings,
  onReload,
  showToast,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [fromModel, setFromModel] = useState('');
  const [toModel, setToModel] = useState('gemini-3.7-flash');
  const [submitting, setSubmitting] = useState(false);

  const presetTargetModels = [
    { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (极速推荐)' },
    { value: 'gemini-3.7-thinking', label: 'Gemini 3.7 Thinking (深度思考)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (全能旗舰)' },
    { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet (Thinking)' },
  ];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromModel.trim()) {
      showToast('warning', '请填写入站客户端模型名称');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/admin/mappings', {
        method: 'POST',
        body: JSON.stringify({
          sourceModel: fromModel.trim(),
          targetModel: toModel.trim(),
          fromModel: fromModel.trim(),
          toModel: toModel.trim(),
        }),
      });
      if (res.success) {
        showToast('success', '路由规则已添加');
        setShowModal(false);
        setFromModel('');
        onReload();
      } else {
        showToast('error', '添加失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '添加失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要移除针对「${name}」的重定向路由规则吗？`)) return;
    try {
      const res = await apiFetch(`/api/admin/mappings/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.success) {
        showToast('success', '路由规则已移除');
        onReload();
      } else {
        showToast('error', '移除失败', res.message);
      }
    } catch (e: any) {
      showToast('error', '移除失败', e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">模型重定向路由 (Model Mapping)</h2>
          <p className="page-subtitle">
            将外部客户端请求的模型标识（如 gpt-4o、claude-3-5-sonnet）动态映射至 Gemini 目标模型
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Icons.Plus size={16} /> 添加路由规则
        </button>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>入站客户端模型 (From Model)</th>
                <th style={{ width: 60, textAlign: 'center' }}></th>
                <th>转译目标模型 (To Gemini Model)</th>
                <th style={{ width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    暂无自定义映射，默认将请求透传至同名模型或匹配兜底模型
                  </td>
                </tr>
              ) : (
                mappings.map((m, idx) => {
                  const from = m.sourceModel || m.fromModel || '-';
                  const to = m.targetModel || m.toModel || '-';
                  const id = m.id || from;

                  return (
                    <tr key={id || idx}>
                      <td>
                        <code style={{ fontSize: '0.9rem', color: 'var(--accent-indigo)' }}>
                          {from}
                        </code>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>➔</td>
                      <td>
                        <code style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>
                          {to}
                        </code>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(id, from)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="添加模型重定向规则">
        <form onSubmit={handleAdd}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-item">
              <label className="form-label">入站客户端模型 (From)</label>
              <input
                type="text"
                className="text-input"
                placeholder="例如: gpt-4o / gpt-4 / text-davinci-002"
                value={fromModel}
                onChange={(e) => setFromModel(e.target.value)}
                autoFocus
              />
              <span className="form-subtext">客户端（Cursor / ChatBox）发起的模型名称</span>
            </div>

            <div className="form-item">
              <label className="form-label">转译目标 Gemini 模型 (To)</label>
              <select
                className="select-input"
                value={toModel}
                onChange={(e) => setToModel(e.target.value)}
              >
                {presetTargetModels.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '正在添加...' : '确认添加'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
