import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useFirebaseAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="nav">
      <div className="nav__inner">
        <Link to="/" className="nav__brand">SuperStudy</Link>
        <div className="nav__links">
          <Link to="/" className={`nav__link${isActive('/') ? ' nav__link--active' : ''}`}>Home</Link>
          <Link to="/help" className={`nav__link${isActive('/help') ? ' nav__link--active' : ''}`}>Study Helper</Link>
          {user ? (
            <>
              <span className="nav__link" style={{ cursor: 'default' }}>{user.displayName || user.email}</span>
              <button className="nav__link" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav__link">Log in</Link>
              <Link to="/signup" className="nav__link nav__cta">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}


