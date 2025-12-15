import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuth } from './AuthContext';
import './AuthPage.css';
import { ChalkCursor } from '../ui/ChalkCursor';

type AuthView = 'login' | 'register' | 'reset' | 'init';

export function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial view from route
  const getInitialView = (): AuthView => {
    if (location.pathname === '/register') return 'register';
    return 'login';
  };

  const [view, setView] = useState<AuthView>(getInitialView());
  const [needsInit, setNeedsInit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 表单状态
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [refInviter, setRefInviter] = useState<string | null>(null); // 邀请人提示

  // 检查是否需要初始化
  useEffect(() => {
    authApi.checkInit()
      .then(data => {
        setNeedsInit(data.needsInit);
        if (data.needsInit) setView('init');
      })
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, []);

  // 解析 URL 中的 ref 参数（分享链接带的邀请码）
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refCode = params.get('ref');
    if (refCode) {
      setInviteCode(refCode.toUpperCase());
      setView('register'); // 自动切换到注册页面
      // 验证邀请码并显示邀请人信息
      import('../../services/api').then(({ inviteApi }) => {
        inviteApi.validate(refCode).then(data => {
          if (data.valid && data.inviter) {
            setRefInviter(data.inviter);
          }
        }).catch(() => {});
      });
    }
  }, [location.search]);

  // 验证码倒计时
  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [codeCountdown]);

  const handleSendCode = async (type: 'register' | 'reset_password') => {
    if (!email) {
      setError('请输入邮箱');
      return;
    }
    setCodeSending(true);
    setError('');
    try {
      await authApi.sendCode(email, type);
      setSuccess('验证码已发送，请查收邮件');
      setCodeCountdown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCodeSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (view === 'init') {
        // 初始化管理员
        if (password !== confirmPassword) {
          throw new Error('两次密码不一致');
        }
        const data = await authApi.initAdmin(email, password);
        login(data.token, data.user);
        setSuccess('初始化成功！您的邀请码已生成');
        navigate('/app');
      } else if (view === 'login') {
        // 登录
        const data = await authApi.login(email, password);
        login(data.token, data.user);
        navigate('/app');
      } else if (view === 'register') {
        // 注册
        if (password !== confirmPassword) {
          throw new Error('两次密码不一致');
        }
        const data = await authApi.register(email, password, verificationCode, inviteCode);
        login(data.token, data.user);
        setSuccess('注册成功！');
        navigate('/app');
      } else if (view === 'reset') {
        // 重置密码
        if (password !== confirmPassword) {
          throw new Error('两次密码不一致');
        }
        await authApi.resetPassword(email, password, verificationCode);
        setSuccess('密码重置成功，请登录');
        setView('login');
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getViewTitle = () => {
    switch (view) {
      case 'init': return '系统初始化';
      case 'login': return '欢迎回来';
      case 'register': return '加入锻造';
      case 'reset': return '重置密码';
    }
  };

  const getViewSubtitle = () => {
    switch (view) {
      case 'init': return '创建第一个管理员账户';
      case 'login': return '登录您的账户';
      case 'register': return '使用邀请码创建账户';
      case 'reset': return '重置您的账户密码';
    }
  };

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner"></div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <ChalkCursor />
      {/* Background Text */}
      <div className="auth-bg-text">
        {view === 'login' && 'LOG'}
        {view === 'register' && 'REG'}
        {view === 'reset' && 'RST'}
        {view === 'init' && 'SYS'}
      </div>

      {/* Left Side - Branding */}
      <div className="auth-brand">
        <Link to="/" className="auth-logo">
          <span className="logo-icon">◆</span>
          <span className="logo-text">VIBE FORGE</span>
        </Link>
        <div className="brand-content">
          <h1 className="brand-title">{getViewTitle()}</h1>
          <p className="brand-subtitle">释放你的创意潜能</p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="auth-form-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2 className="auth-title">{getViewTitle()}</h2>
            <p className="auth-subtitle">{getViewSubtitle()}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* 邮箱 */}
            <div className="form-group">
              <label className="form-label">邮箱</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                required
              />
            </div>

            {/* 验证码 (注册/重置密码) */}
            {(view === 'register' || view === 'reset') && (
              <div className="form-group">
                <label className="form-label">验证码</label>
                <div className="form-row">
                  <input
                    type="text"
                    className="form-input flex-1"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    placeholder="6位验证码"
                    maxLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSendCode(view === 'reset' ? 'reset_password' : 'register')}
                    disabled={codeSending || codeCountdown > 0}
                  >
                    {codeCountdown > 0 ? `${codeCountdown}s` : codeSending ? '发送中...' : '发送验证码'}
                  </button>
                </div>
              </div>
            )}

            {/* 邀请码 (仅注册) */}
            {view === 'register' && (
              <div className="form-group">
                <label className="form-label">邀请码</label>
                {refInviter && (
                  <div className="invite-hint">
                    <span className="invite-icon">🎁</span>
                    来自 <strong>{refInviter}</strong> 的邀请
                  </div>
                )}
                <input
                  type="text"
                  className="form-input"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="请输入邀请码"
                  maxLength={8}
                  required
                />
              </div>
            )}

            {/* 密码 */}
            <div className="form-group">
              <label className="form-label">密码</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少6位"
                minLength={6}
                required
              />
            </div>

            {/* 确认密码 (注册/初始化/重置) */}
            {(view === 'register' || view === 'init' || view === 'reset') && (
              <div className="form-group">
                <label className="form-label">确认密码</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  minLength={6}
                  required
                />
              </div>
            )}

            {/* 错误/成功提示 */}
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* 提交按钮 */}
            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? '处理中...' :
                view === 'init' ? '创建管理员' :
                  view === 'login' ? '登录' :
                    view === 'register' ? '创建账户' :
                      '重置密码'
              }
            </button>
          </form>

          {/* 切换视图 */}
          {!needsInit && (
            <div className="auth-footer">
              {view === 'login' && (
                <>
                  <button className="link-btn" onClick={() => setView('register')}>
                    没有账号？使用邀请码注册
                  </button>
                  <button className="link-btn" onClick={() => setView('reset')}>
                    忘记密码？
                  </button>
                </>
              )}
              {view === 'register' && (
                <button className="link-btn" onClick={() => setView('login')}>
                  已有账号？去登录
                </button>
              )}
              {view === 'reset' && (
                <button className="link-btn" onClick={() => setView('login')}>
                  返回登录
                </button>
              )}
              <Link to="/" className="link-btn link-home">
                ← 返回首页
              </Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
