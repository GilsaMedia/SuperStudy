import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../logo.svg';
import '../App.css';
import { useFirebaseAuth } from '../context/FirebaseAuth';

export default function Home() {
  const { user } = useFirebaseAuth();

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

