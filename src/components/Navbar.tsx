import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const { user, profile, logout } = useFirebaseAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
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
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleMobileLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="nav">
        <div className="nav__inner">
          <Link to="/" className="nav__brand">SuperStudy</Link>
          
          {/* Hamburger button for mobile */}
          <button
            type="button"
            className="nav__hamburger"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            <span className={`nav__hamburger-line ${mobileMenuOpen ? 'nav__hamburger-line--open' : ''}`}></span>
            <span className={`nav__hamburger-line ${mobileMenuOpen ? 'nav__hamburger-line--open' : ''}`}></span>
            <span className={`nav__hamburger-line ${mobileMenuOpen ? 'nav__hamburger-line--open' : ''}`}></span>
          </button>

          {/* Desktop links */}
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
              <>
                <Link
                  to="/student/teachers"
                  className={`nav__link${location.pathname.startsWith('/student/teachers') && !location.pathname.startsWith('/student/my-teachers') ? ' nav__link--active' : ''}`}
                >
                  Find Teachers
                </Link>
                <Link
                  to="/student/my-teachers"
                  className={`nav__link${location.pathname.startsWith('/student/my-teachers') ? ' nav__link--active' : ''}`}
                >
                  My Teachers
                </Link>
              </>
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
                          <Link to="/student/my-teachers" className="nav__dropdownItem">My Teachers</Link>
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

      {/* Mobile sliding menu */}
      <div className={`nav__mobile-overlay ${mobileMenuOpen ? 'nav__mobile-overlay--open' : ''}`} onClick={handleMobileLinkClick}>
        <div className={`nav__mobile-drawer ${mobileMenuOpen ? 'nav__mobile-drawer--open' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="nav__mobile-header">
            <Link to="/" className="nav__brand nav__brand--mobile" onClick={handleMobileLinkClick}>SuperStudy</Link>
            <button
              type="button"
              className="nav__mobile-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>
          
          <div className="nav__mobile-links">
            {isTeacher ? (
              <Link 
                to="/" 
                className={`nav__mobile-link${isActive('/') ? ' nav__mobile-link--active' : ''}`}
                onClick={handleMobileLinkClick}
              >
                Teacher Dashboard
              </Link>
            ) : isStudent ? (
              <Link
                to="/student-dashboard"
                className={`nav__mobile-link${location.pathname.startsWith('/student-dashboard') ? ' nav__mobile-link--active' : ''}`}
                onClick={handleMobileLinkClick}
              >
                Private Teachers
              </Link>
            ) : (
              <Link 
                to="/" 
                className={`nav__mobile-link${isActive('/') ? ' nav__mobile-link--active' : ''}`}
                onClick={handleMobileLinkClick}
              >
                Home
              </Link>
            )}
            <Link 
              to="/help" 
              className={`nav__mobile-link${isActive('/help') ? ' nav__mobile-link--active' : ''}`}
              onClick={handleMobileLinkClick}
            >
              Study Helper
            </Link>
            {isStudent && (
              <>
                <Link
                  to="/student/teachers"
                  className={`nav__mobile-link${location.pathname.startsWith('/student/teachers') && !location.pathname.startsWith('/student/my-teachers') ? ' nav__mobile-link--active' : ''}`}
                  onClick={handleMobileLinkClick}
                >
                  Find Teachers
                </Link>
                <Link
                  to="/student/my-teachers"
                  className={`nav__mobile-link${location.pathname.startsWith('/student/my-teachers') ? ' nav__mobile-link--active' : ''}`}
                  onClick={handleMobileLinkClick}
                >
                  My Teachers
                </Link>
              </>
            )}
            
            {user ? (
              <div className="nav__mobile-user">
                <div className="nav__mobile-user-info">
                  {profile?.fullName || user.displayName || user.email}
                </div>
                {(isTeacher || location.pathname.startsWith('/teacher')) && (
                  <>
                    <Link to="/" className="nav__mobile-link" onClick={handleMobileLinkClick}>Teacher Home</Link>
                    <Link to="/teacher/profile" className="nav__mobile-link" onClick={handleMobileLinkClick}>Teacher Profile</Link>
                    <Link to="/teacher/students" className="nav__mobile-link" onClick={handleMobileLinkClick}>Teacher Students</Link>
                  </>
                )}
                {(isStudent || location.pathname.startsWith('/student')) && (
                  <>
                    <Link to="/student-dashboard" className="nav__mobile-link" onClick={handleMobileLinkClick}>Student Dashboard</Link>
                    <Link to="/student/teachers" className="nav__mobile-link" onClick={handleMobileLinkClick}>Find Teachers</Link>
                    <Link to="/student/my-teachers" className="nav__mobile-link" onClick={handleMobileLinkClick}>My Teachers</Link>
                  </>
                )}
                <div className="nav__mobile-divider"></div>
                <button
                  type="button"
                  className="nav__mobile-link nav__mobile-link--danger"
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await logout();
                  }}
                >
                  Log out
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="nav__mobile-link" onClick={handleMobileLinkClick}>Log in</Link>
                <Link to="/signup" className="nav__mobile-link nav__mobile-link--cta" onClick={handleMobileLinkClick}>Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


