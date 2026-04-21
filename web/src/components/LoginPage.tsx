import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const { login, register, isLoading, user } = useStore();

  // Already logged in → go to dashboard
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) { setError('Name is required'); return; }
        await register({ name, email, password });
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || (tab === 'login' ? 'Invalid credentials' : 'Registration failed'));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: 8, padding: '12px 14px', color: '#c8d6e0', fontSize: 13,
    fontFamily: 'JetBrains Mono, Fira Code, monospace', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: 2, color: '#2a4050', display: 'block', marginBottom: 6,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#06101a', fontFamily: 'JetBrains Mono, Fira Code, monospace', color: '#c8d6e0', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .axiom-input:focus { border-color: rgba(0,255,136,0.5) !important; box-shadow: 0 0 0 2px rgba(0,255,136,0.07) !important; }
        .axiom-input::placeholder { color: #1a2e38; }
      `}</style>

      {/* Grid bg */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(0,255,136,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.022) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      {/* NAV */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid rgba(0,255,136,0.07)' }}>
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, background: 'linear-gradient(90deg,#00ff88,#00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AXIOM</span>
        </div>
        <button onClick={() => navigate('/')}
          style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: '#3d5a6e', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: 1 }}>
          ← BACK
        </button>
      </nav>

      {/* FORM */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo / Title */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, background: 'linear-gradient(120deg,#00ff88,#00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {tab === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: '#2a4050' }}>
              {tab === 'login' ? 'Log in to access AXIOM dashboard' : 'Start your free AI trading analysis'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                style={{ flex: 1, padding: '9px', borderRadius: 7, fontSize: 11, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', border: 'none', letterSpacing: 1,
                  background: tab === t ? 'rgba(0,255,136,0.1)' : 'transparent',
                  color: tab === t ? '#00ff88' : '#2a4050',
                  borderRight: tab === t ? '1px solid rgba(0,255,136,0.25)' : 'none',
                }}>
                {t === 'login' ? 'LOG IN' : 'REGISTER'}
              </button>
            ))}
          </div>

          {/* Form card */}
          <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 14, padding: 28 }}>
            <form onSubmit={handleSubmit}>
              {tab === 'register' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>FULL NAME</label>
                  <input className="axiom-input" style={inputStyle} type="text" placeholder="John Doe"
                    value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>EMAIL</label>
                <input className="axiom-input" style={inputStyle} type="email" placeholder="trader@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>PASSWORD</label>
                <input className="axiom-input" style={inputStyle} type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: '#ef4444' }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={isLoading}
                style={{ width: '100%', padding: 13, background: isLoading ? 'rgba(0,255,136,0.04)' : 'linear-gradient(135deg,rgba(0,255,136,0.18),rgba(0,212,255,0.14))', border: `1px solid ${isLoading ? 'rgba(0,255,136,0.1)' : 'rgba(0,255,136,0.4)'}`, borderRadius: 9, color: isLoading ? '#1e3040' : '#00ff88', fontSize: 11, letterSpacing: 3, fontWeight: 800, fontFamily: 'inherit', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                {isLoading ? '⟳ PLEASE WAIT...' : tab === 'login' ? '⚡ LOG IN' : '⚡ CREATE ACCOUNT'}
              </button>
            </form>

            {/* Demo shortcut */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#1a2a35', textAlign: 'center', marginBottom: 10 }}>DEMO ACCESS</div>
              <button onClick={() => { setEmail('demo@axiom.ai'); setPassword('Demo1234!'); }}
                style={{ width: '100%', padding: '9px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, color: '#2a4050', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: 1 }}>
                USE DEMO CREDENTIALS
              </button>
            </div>
          </div>

          {/* Switch tab link */}
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#2a4050' }}>
            {tab === 'login' ? (
              <>Don't have an account? <span onClick={() => { setTab('register'); setError(''); }} style={{ color: '#00d4ff', cursor: 'pointer' }}>Register free</span></>
            ) : (
              <>Already have an account? <span onClick={() => { setTab('login'); setError(''); }} style={{ color: '#00d4ff', cursor: 'pointer' }}>Log in</span></>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 9, color: '#0e1e26', letterSpacing: 1 }}>
            AXIOM v1.0 · NOT FINANCIAL ADVICE
          </div>
        </div>
      </div>
    </div>
  );
}

