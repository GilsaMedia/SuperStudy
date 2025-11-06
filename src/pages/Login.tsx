import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './login.css';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = React.useState(false);

  const goHome = () => navigate('/', { replace: true });

  const mapAuthError = (code?: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.';
      default:
        return 'Unable to sign in. Please try again.';
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      goHome();
    } catch (e: any) {
      setError(mapAuthError(e?.code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleBusy) return; // prevent concurrent popups
    setError(null);
    setIsGoogleBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      goHome();
    } catch (e: any) {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>

        <form className="space-y-3" onSubmit={handleEmailLogin}>
          <label className="input-label">Email</label>
          <div className="input-group">
            <span className="input-icon">✉️</span>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              autoComplete="email"
            />
          </div>

          <label className="input-label">Password</label>
          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="hint" style={{ color: '#fca5a5' }}>{error}</div>}

          <div className="login-actions" style={{ gap: 8 }}>
            <button type="submit" className="btn" style={{ background: '#374151', color: '#fff' }} disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in with Email'}
            </button>
          </div>
        </form>

        <div className="login-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-google" onClick={handleGoogleLogin} disabled={isGoogleBusy}>
            <span className="icon">G</span>
            <span>{isGoogleBusy ? 'Opening…' : 'Sign in with Google'}</span>
          </button>
        </div>

        <p className="hint" style={{ marginTop: 8 }}>
          Don’t have an account? <Link to="/signup" style={{ color: '#93c5fd' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
