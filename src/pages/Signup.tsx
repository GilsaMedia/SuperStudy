import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './login.css';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

type FirebaseAuthError = { code?: string; message?: string };

function mapAuthError(err: FirebaseAuthError): string {
  switch (err.code) {
    case 'auth/email-already-in-use':
      return 'This email is already in use.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/weak-password':
      return 'Password is too weak.';
    default:
      return 'Unable to sign up. Please try again.';
  }
}

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = React.useState(false);

  const goHome = () => navigate('/', { replace: true });

  function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Request timed out. Check your connection.')), ms);
      p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password || !fullName) {
      setError('Please enter full name, email and password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);

    try {
      // 1) Create account (this signs the user in automatically)
      const cred = await withTimeout(createUserWithEmailAndPassword(auth, email, password));

      // 2) Update display name (best-effort)
      try {
        await withTimeout(updateProfile(cred.user, { displayName: fullName }));
      } catch {}

      // 3) Save comprehensive (non-sensitive) user profile in Firestore
      const providerId = cred.user.providerData?.[0]?.providerId || 'password';
      await withTimeout(setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        fullName,
        role: 'student',
        subjects: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: cred.user.emailVerified,
        providerId,
        profile: {
          photoURL: cred.user.photoURL || null,
        },
        metadata: {
          creationTime: cred.user.metadata?.creationTime || null,
          lastSignInTime: cred.user.metadata?.lastSignInTime || null,
        },
        app: {
          onboardingComplete: false,
          theme: 'dark',
        },
      }, { merge: true }));

      // 4) Go home (user is already signed in)
      goHome();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('signup error:', e);
      setError(mapAuthError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (isGoogleBusy) return;
    setError(null);
    setIsGoogleBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const providerId = cred.user.providerData?.[0]?.providerId || 'google.com';
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        fullName: cred.user.displayName,
        role: 'student',
        subjects: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: cred.user.emailVerified,
        providerId,
        profile: {
          photoURL: cred.user.photoURL || null,
        },
        metadata: {
          creationTime: cred.user.metadata?.creationTime || null,
          lastSignInTime: cred.user.metadata?.lastSignInTime || null,
        },
        app: {
          onboardingComplete: false,
          theme: 'dark',
        },
      }, { merge: true });
      goHome();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('google signup error:', e);
      setError('Google signup failed. Please try again.');
    } finally {
      setIsGoogleBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sign up</h1>

        <form className="space-y-3" onSubmit={handleEmailSignup}>
          <label className="input-label">Full name</label>
          <div className="input-group">
            <span className="input-icon">👤</span>
            <input
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
            />
          </div>

          <label className="input-label">Email</label>
          <div className="input-group">
            <span className="input-icon">✉️</span>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <label className="input-label">Password</label>
          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <label className="input-label">Confirm Password</label>
          <div className="input-group">
            <span className="input-icon">✅</span>
            <input
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-field"
            />
          </div>

          {error && <div className="hint" style={{ color: '#fca5a5' }}>{error}</div>}
          <button type="submit" className="btn" style={{ background: '#374151', color: '#fff' }} disabled={isSubmitting}>
            {isSubmitting ? 'Signing up...' : 'Sign up with Email'}
          </button>
        </form>

        <div className="login-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-google" onClick={handleGoogleSignup} disabled={isGoogleBusy}>
            <span className="icon">G</span>
            <span>{isGoogleBusy ? 'Opening…' : 'Sign up with Google'}</span>
          </button>
        </div>

        <p className="hint" style={{ marginTop: 8 }}>
          Already have an account? <Link to="/login" style={{ color: '#93c5fd' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
