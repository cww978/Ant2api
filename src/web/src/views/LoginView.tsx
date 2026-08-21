import React, { useState } from 'react';
import { Icons } from '../components/Icons';

interface LoginViewProps {
  onLogin: (password: string) => Promise<boolean>;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, theme = 'light', onToggleTheme }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('请输入管理员密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ok = await onLogin(password);
      if (!ok) {
        setError('管理员密码错误，请重试');
      }
    } catch (err: any) {
      setError(err.message || '登录失败，请检查网络或服务端状态');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'var(--bg-app)',
        padding: 20,
        overflow: 'hidden',
      }}
    >
      {/* Top right theme toggle */}
      {onToggleTheme && (
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 50 }}>
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'light' ? '切换至黑暗模式 (Night)' : '切换至白天模式 (Day)'}
          >
            {theme === 'light' ? <Icons.Moon size={16} /> : <Icons.Sun size={16} />}
          </button>
        </div>
      )}
      {/* Ambient background lighting */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(139, 92, 246, 0.12) 40%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: 350,
          height: 350,
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 65%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '36px 32px',
          borderRadius: 22,
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
          animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 45%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.45)',
            }}
          >
            ⚡
          </div>
        </div>

        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: 6,
            background: 'var(--gradient-title)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Ant2api 管理控制台
        </h1>

        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            marginBottom: 28,
            lineHeight: 1.5,
          }}
        >
          Google Antigravity & Gemini CLI 协议转译网关
        </p>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="form-item" style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.Key size={14} color="var(--primary)" /> 管理员密码
            </label>
            <input
              type="password"
              className="text-input font-mono"
              style={{
                height: 46,
                fontSize: '0.95rem',
                borderRadius: 12,
              }}
              placeholder="默认密码: ant2api_admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 14px',
                borderRadius: 10,
                color: 'var(--accent-rose)',
                fontSize: '0.85rem',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icons.XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              height: 46,
              fontSize: '0.95rem',
              fontWeight: 700,
              borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.RotateCw size={16} className="animate-spin" /> 正在验证...
              </span>
            ) : (
              '进入管理控制台 ➔'
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: 28,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
          }}
        >
          Ant2api Gateway v1.0.0 · 保护管理控制台安全
        </div>
      </div>
    </div>
  );
};
