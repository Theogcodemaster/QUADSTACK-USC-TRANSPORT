import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { ShieldCheck, User, LogIn, ArrowRight } from 'lucide-react';
import { C, FONT_DISPLAY, FONT_BODY } from '../shared/theme';

export default function LoginPage({ onSignedIn, onGuest }) {
  const [mode, setMode] = useState('admin');
  const [email, setEmail] = useState('admin@transport.org');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickMode = (m) => {
    setMode(m);
    setEmail(m === 'admin' ? 'admin@transport.org' : 'drivers@transport.org');
    setError('');
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!password) {
      setError('Enter a password.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
      onSignedIn?.(cred.user.email);
    } catch (err) {
      setError(err.message?.replace('Firebase: ', '') || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 13px', border: `1px solid ${C.lineStrong}`,
    borderRadius: 8, background: C.card, fontSize: 15, fontFamily: FONT_BODY,
    color: C.ink,
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{
        width: '100%', maxWidth: 380, background: C.card,
        border: `1px solid ${C.line}`, borderRadius: 16,
        boxShadow: '0 12px 40px rgba(43,35,25,0.08)', overflow: 'hidden',
        animation: 'fdsaFade .25s ease',
      }}>
        <div style={{ padding: '32px 28px 0', textAlign: 'center' }}>
          <img src="usc.png" alt="USC Transport" style={{ width: 130, height: 72, objectFit: 'contain' }} />
          <div style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em',
            color: C.mute, fontWeight: 500, marginTop: 8,
          }}>
            Transport Department
          </div>
          <h2 style={{
            margin: '4px 0 0', fontFamily: FONT_DISPLAY, fontSize: 22,
            fontWeight: 500, letterSpacing: '-0.015em', color: C.ink,
          }}>
            Staff Login
          </h2>
        </div>

        <form onSubmit={submit} style={{ padding: '22px 28px 28px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
            background: C.softBg, borderRadius: 10, padding: 4, marginBottom: 18,
          }}>
            <button type="button" onClick={() => pickMode('admin')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
                background: mode === 'admin' ? C.card : 'transparent',
                color: mode === 'admin' ? C.cardinal : C.mute,
                boxShadow: mode === 'admin' ? '0 1px 4px rgba(43,35,25,0.12)' : 'none',
                transition: 'all .15s',
              }}>
              <ShieldCheck size={15} />
              Admin
            </button>
            <button type="button" onClick={() => pickMode('driver')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
                background: mode === 'driver' ? C.card : 'transparent',
                color: mode === 'driver' ? C.gold : C.mute,
                boxShadow: mode === 'driver' ? '0 1px 4px rgba(43,35,25,0.12)' : 'none',
                transition: 'all .15s',
              }}>
              <User size={15} />
              Driver
            </button>
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.mute, marginBottom: 6 }}>
            Email
          </label>
          <input type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
            style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.mute, marginBottom: 6 }}>
            Password
          </label>
          <input type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="Enter password"
            autoComplete="current-password"
            autoFocus
            style={{ ...inputStyle, marginBottom: error ? 10 : 16 }} />

          {error && (
            <div style={{ fontSize: 12.5, color: C.danger, marginBottom: 14 }}>{error}</div>
          )}

          <button type="submit" disabled={submitting}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', background: C.cardinal, color: '#fff', border: 'none',
              borderRadius: 8, cursor: submitting ? 'default' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: FONT_BODY,
              opacity: submitting ? 0.7 : 1, transition: 'opacity .15s',
            }}>
            <LogIn size={16} />
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <button type="button" onClick={onGuest}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginTop: 14, padding: '8px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, fontFamily: FONT_BODY, color: C.mute,
            }}>
            Continue to request form
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
