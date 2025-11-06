import React from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';

const isLoggedIn = () => localStorage.getItem('auth_logged_in') === 'true';

export default function AuthGate() {
  const navigate = useNavigate();
  const [loggedIn] = React.useState(isLoggedIn());

  React.useEffect(() => {
    if (loggedIn) {
      navigate('/app', { replace: true });
    }
  }, [loggedIn, navigate]);

  if (!loggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">Welcome</h1>
          <div className="login-actions">
            <button className="btn btn-microsoft" onClick={() => navigate('/login')}>
              <span className="icon">🔐</span>
              <span>Log in</span>
            </button>
            <button className="btn btn-apple" onClick={() => navigate('/signup')}>
              <span className="icon">✍️</span>
              <span>Sign up</span>
            </button>
          </div>
          <p className="hint">Choose an option to continue.</p>
        </div>
      </div>
    );
  }

  return null;
}
