import React, { useState } from 'react';
import { Icons } from './Icons';

interface LoginModalProps {
  isOpen: boolean;
  onLogin: (password: string) => Promise<boolean>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('请输入管理密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ok = await onLogin(password);
      if (!ok) {
        setError('密码错误，请重试');
      }
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }}>
      <div className="modal-container glass-card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚡</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>Ant2api 控制台</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>
          请输入管理员密码以进入控制面板
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left', marginBottom: 16 }}>
            <label className="form-label">管理员密码</label>
            <input
              type="password"
              className="form-input"
              placeholder="默认: ant2api_admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div
              style={{
                color: 'var(--accent-rose)',
                fontSize: '0.82rem',
                marginBottom: 16,
                textAlign: 'left',
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? '正在验证...' : '进入系统'}
          </button>
        </form>
      </div>
    </div>
  );
};
