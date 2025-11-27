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
    case 'permission-denied':
    case 'PERMISSION_DENIED':
      return 'Permission denied. Please check your Firestore security rules.';
    default:
      // Show more detailed error if available
      if (err.message) {
        return `Signup failed: ${err.message}`;
      }
      return 'Unable to sign up. Please try again.';
  }
}

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<'teacher' | 'student' | null>(null);
  const [teacherSubject, setTeacherSubject] = React.useState('Math');
  const [teacherPoints, setTeacherPoints] = React.useState('5');
  const [teacherLocation, setTeacherLocation] = React.useState('');
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
    if (!selectedRole) {
      setError('Please select whether you are a teacher or a student.');
      return;
    }
    if (!email || !password || !fullName) {
      setError('Please enter full name, email and password.');
      return;
    }
    if (selectedRole === 'teacher') {
      if (!teacherLocation || !teacherLocation.trim()) {
        setError('Please provide your teaching location (city).');
        return;
      }
      if (!teacherSubject || !teacherSubject.trim()) {
        setError('Please select a subject.');
        return;
      }
      if (!teacherPoints || !teacherPoints.trim()) {
        setError('Please select points/units.');
        return;
      }
      if (!phone || !phone.trim()) {
        setError('Please provide your phone number.');
        return;
      }
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
      const userData = {
        uid: cred.user.uid,
        email: cred.user.email,
        fullName,
        role: selectedRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: cred.user.emailVerified,
        providerId,
        phone: phone || null,
        subject: selectedRole === 'teacher' ? teacherSubject : null,
        points: selectedRole === 'teacher' ? teacherPoints : null,
        location: selectedRole === 'teacher' ? teacherLocation : null,
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
      };
      // eslint-disable-next-line no-console
      console.log('[Signup] Saving user profile to Firestore:', { uid: cred.user.uid, role: selectedRole, userData });
      await withTimeout(setDoc(doc(db, 'users', cred.user.uid), userData, { merge: true }));
      // eslint-disable-next-line no-console
      console.log('[Signup] User profile saved successfully');

      // 4) Send user to home
      goHome();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('signup error:', e);
      // Check if it's a Firestore permission error
      if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firestore security rules allow users to create their profile.');
      } else {
        setError(mapAuthError(e));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (isGoogleBusy) return;
    setError(null);
    setIsGoogleBusy(true);
    try {
      if (!selectedRole) {
        throw new Error('role-missing');
      }
      if (selectedRole === 'teacher') {
        if (!teacherLocation || !teacherLocation.trim()) {
          setError('Please provide your teaching location (city).');
          setIsGoogleBusy(false);
          return;
        }
        if (!teacherSubject || !teacherSubject.trim()) {
          setError('Please select a subject.');
          setIsGoogleBusy(false);
          return;
        }
        if (!teacherPoints || !teacherPoints.trim()) {
          setError('Please select points/units.');
          setIsGoogleBusy(false);
          return;
        }
        if (!phone || !phone.trim()) {
          setError('Please provide your phone number.');
          setIsGoogleBusy(false);
          return;
        }
      }
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const providerId = cred.user.providerData?.[0]?.providerId || 'google.com';
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        fullName: cred.user.displayName,
        role: selectedRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: cred.user.emailVerified,
        providerId,
        phone: phone || null,
        subject: selectedRole === 'teacher' ? teacherSubject : null,
        points: selectedRole === 'teacher' ? teacherPoints : null,
        location: selectedRole === 'teacher' ? teacherLocation : null,
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
      if (e?.message === 'role-missing') {
        setError('Please choose Teacher or Student before signing up with Google.');
      } else if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firestore security rules allow users to create their profile.');
      } else {
        setError('Google signup failed. Please try again.');
      }
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const roleButton = (role: 'teacher' | 'student', label: string, emoji: string) => (
    <button
      type="button"
      className={`btn ${selectedRole === role ? 'btn-selected' : ''}`}
      onClick={() => setSelectedRole(role)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: selectedRole === role ? '#4f46e5' : '#1f2937',
        color: '#fff',
        border: selectedRole === role ? '2px solid #93c5fd' : '1px solid #374151',
        transform: selectedRole === role ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span>{label}</span>
    </button>
  );

  const teacherExtraFields = selectedRole === 'teacher' && (
    <>
      <label className="input-label">Subject</label>
      <div className="input-group">
        <span className="input-icon">📘</span>
        <select
          value={teacherSubject}
          onChange={(e) => setTeacherSubject(e.target.value)}
          className="input-field"
        >
          <option value="Math">Math</option>
          <option value="English">English</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
          <option value="History">History</option>
          <option value="Computer Science">Computer Science</option>
        </select>
      </div>

      <label className="input-label">Units (Points)</label>
      <div className="input-group">
        <span className="input-icon">🎯</span>
        <select
          value={teacherPoints}
          onChange={(e) => setTeacherPoints(e.target.value)}
          className="input-field"
        >
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>

      <label className="input-label">Location <span style={{ color: '#fca5a5' }}>*</span></label>
      <div className="input-group">
        <span className="input-icon">📍</span>
        <input
          type="text"
          placeholder="City or area"
          value={teacherLocation}
          onChange={(e) => setTeacherLocation(e.target.value)}
          className="input-field"
          required={selectedRole === 'teacher'}
        />
      </div>
    </>
  );

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sign up</h1>

        <div className="role-selector">
          <p className="hint" style={{ marginBottom: 8 }}>Who are you signing up as?</p>
          <div className="login-actions" style={{ gap: 12 }}>
            {roleButton('student', 'I am a Student', '🎓')}
            {roleButton('teacher', 'I am a Teacher', '👩‍🏫')}
          </div>
        </div>

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

          <label className="input-label">
            Phone Number {selectedRole === 'teacher' && <span style={{ color: '#fca5a5' }}>*</span>}
            {selectedRole !== 'teacher' && <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'normal' }}> (optional)</span>}
          </label>
          <div className="input-group">
            <span className="input-icon">📞</span>
            <input
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              required={selectedRole === 'teacher'}
            />
          </div>
          <small style={{ color: '#94a3b8', fontSize: 12, marginTop: 4, marginBottom: 8, display: 'block' }}>
            Include country code (e.g., +1 for US, +44 for UK)
          </small>

          {teacherExtraFields}

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
