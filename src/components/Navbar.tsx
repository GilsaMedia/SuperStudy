import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const { user, profile, logout } = useFirebaseAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const isTeacher = profile?.role === 'teacher';
  const isStudent = profile?.role === 'student';

  const isActive = (path: string) => location.pathname === path;

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="nav">
      <div className="nav__inner">
        <Link to="/" className="nav__brand">SuperStudy</Link>
        <div className="nav__links">
          {isTeacher ? (
            <Link to="/" className={`nav__link${isActive('/') ? ' nav__link--active' : ''}`}>Teacher Dashboard</Link>
          ) : isStudent ? (
            <Link
              to="/student-dashboard"
              className={`nav__link${location.pathname.startsWith('/student-dashboard') ? ' nav__link--active' : ''}`}
            >
              Private Teachers
            </Link>
          ) : (
            <Link to="/" className={`nav__link${isActive('/') ? ' nav__link--active' : ''}`}>Home</Link>
          )}
          <Link to="/help" className={`nav__link${isActive('/help') ? ' nav__link--active' : ''}`}>Study Helper</Link>
          {isStudent && (
            <Link
              to="/student/teachers"
              className={`nav__link${location.pathname.startsWith('/student/teachers') ? ' nav__link--active' : ''}`}
            >
              Find Teachers
            </Link>
          )}
          {user ? (
            <>
              <div className="nav__menu" ref={menuRef}>
                <button
                  type="button"
                  className="nav__link nav__toggle"
                  onClick={() => setMenuOpen((prev) => !prev)}
                >
                  {profile?.fullName || user.displayName || user.email}
                  <span style={{ marginLeft: 6, fontSize: 12 }}>▾</span>
                </button>
                {menuOpen && (
                  <div className="nav__dropdown">
                    {(isTeacher || location.pathname.startsWith('/teacher')) && (
                      <>
                        <Link to="/" className="nav__dropdownItem">Teacher Home</Link>
                        <Link to="/teacher/profile" className="nav__dropdownItem">Teacher Profile</Link>
                        <Link to="/teacher/students" className="nav__dropdownItem">Teacher Students</Link>
                        <div className="nav__dropdownDivider" />
                      </>
                    )}
                    {(isStudent || location.pathname.startsWith('/student')) && (
                      <>
                        <Link to="/student-dashboard" className="nav__dropdownItem">Student Dashboard</Link>
                        <Link to="/student/teachers" className="nav__dropdownItem">Find Teachers</Link>
                        <div className="nav__dropdownDivider" />
                      </>
                    )}
                    <button
                      type="button"
                      className="nav__dropdownItem nav__dropdownItem--danger"
                      onClick={async () => {
                        setMenuOpen(false);
                        await logout();
                      }}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
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


