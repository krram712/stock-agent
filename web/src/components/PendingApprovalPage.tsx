import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';

export default function PendingApprovalPage() {
  const { user, logout } = useStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#06101a', fontFamily: 'JetBrains Mono, Fira Code, monospace', color: '#c8d6e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(0,255,136,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.022) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '40px 24px', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 9, letterSpacing: 4, color: '#00ff88', marginBottom: 12 }}>AXIOM TRADING INTELLIGENCE</div>
        <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, background: 'linear-gradient(120deg,#00ff88,#00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Access Pending
        </h1>
        <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 12, padding: '24px 28px', marginBottom: 20 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#8ba0b0', lineHeight: 1.7 }}>
            Your account <strong style={{ color: '#00ff88' }}>{user?.email}</strong> has been registered and is awaiting admin approval.
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#3d5a6e', lineHeight: 1.7 }}>
            You will be able to access the dashboard once an admin approves your request. Please check back later or contact the administrator.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 16px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 8, fontSize: 10, color: '#00ff88' }}>
            STATUS: PENDING APPROVAL
          </div>
        </div>
        <button onClick={handleLogout}
          style={{ marginTop: 24, padding: '10px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#3d5a6e', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: 2 }}>
          LOG OUT
        </button>
      </div>
    </div>
  );
}