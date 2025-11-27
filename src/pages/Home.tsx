import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../logo.svg';
import '../App.css';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import TeacherDashboard from './teacher/TeacherDashboard';
import TeacherLayout from './teacher/TeacherLayout';

export default function Home() {
  const { user, profile, loading } = useFirebaseAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (loading) return;
    if (profile?.role === 'student') {
      navigate('/student-dashboard', { replace: true });
    }
  }, [profile, loading, navigate]);

  if (loading) {
    return (
      <div className="Welcome">
        <div className="Welcome-main">
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (profile?.role === 'teacher') {
    return (
      <TeacherLayout>
        <TeacherDashboard profileOverride={profile} />
      </TeacherLayout>
    );
  }

  if (user && !profile?.role) {
    // eslint-disable-next-line no-console
    console.log('[Home] User authenticated but no role found:', { 
      userId: user.uid, 
      profile, 
      hasProfile: !!profile 
    });
    return (
      <div className="Welcome">
        <header className="Welcome-header">
          <div className="Welcome-brand">
            <img src={logo} alt="App logo" className="Welcome-logo" />
            <span className="Welcome-title">SuperStudy</span>
          </div>
        </header>

        <main className="Welcome-main">
          <h1 className="Welcome-headline">Role Required</h1>
          <p className="Welcome-subtitle" style={{ maxWidth: 520 }}>
            Your account needs to be set up as a student or a teacher before you can use SuperStudy.
            Please contact support or sign up again with the correct role.
          </p>
          <div className="Welcome-actions">
            <button 
              className="Button Button--primary" 
              onClick={() => {
                // Force refresh the profile
                window.location.reload();
              }}
            >
              Refresh Profile
            </button>
            <Link className="Button Button--secondary" to="/signup">Create a role-specific account</Link>
            <Link className="Button Button--secondary" to="/login">Switch account</Link>
          </div>
        </main>

        <footer className="Welcome-footer">
          <span>Need help? Reach out to our support team.</span>
        </footer>
      </div>
    );
  }

  const displayName = user?.displayName || user?.email || undefined;

  return (
    <div className="Welcome">
      <header className="Welcome-header">
        <div className="Welcome-brand">
          <img src={logo} alt="App logo" className="Welcome-logo" />
          <span className="Welcome-title">SuperStudy</span>
        </div>
      </header>

      <main className="Welcome-main">
        {user ? (
          <>
            <h1 className="Welcome-headline">{`Hello${displayName ? ` ${displayName}` : ''}`}</h1>
            <p className="Welcome-subtitle">More personalized content is coming soon.</p>
          </>
        ) : (
          <>
            <h1 className="Welcome-headline">Welcome to SuperStudy</h1>
            <p className="Welcome-subtitle">Your hub to study smarter and track your progress.</p>
            <div className="Welcome-actions">
              <Link className="Button Button--primary" to="/login" aria-label="Log in to your account">Log in</Link>
              <button className="Button Button--secondary" onClick={() => import('../auth').then(m => m.logInWithGoogle())}>
                Continue with Google
              </button>
              <Link className="Button Button--secondary" to="/signup" aria-label="Create a new account">Create account</Link>
            </div>
          </>
        )}
      </main>

      <footer className="Welcome-footer">
        <span>By continuing you agree to our <a className="Welcome-link" href="#/terms">Terms</a> and <a className="Welcome-link" href="#/privacy">Privacy Policy</a>.</span>
      </footer>
    </div>
  );
}

export {};

