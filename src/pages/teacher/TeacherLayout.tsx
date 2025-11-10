import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import './teacher.css';

type TeacherLayoutProps = {
  children?: React.ReactNode;
};

export default function TeacherLayout({ children }: TeacherLayoutProps = {}) {
  const { user, profile, loading } = useFirebaseAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login', { replace: true });
      } else if (profile && profile.role !== 'teacher') {
        navigate('/', { replace: true });
      }
    }
  }, [user, profile, loading, navigate]);

  if (loading || !user || !profile || profile.role !== 'teacher') {
    return (
      <div className="TeacherLayout">
        <div className="TeacherLayout__shell">
          <div className="TeacherLayout__content TeacherLayout__content--center">
            Loading teacher area…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="TeacherLayout">
      <aside className="TeacherLayout__sidebar">
        <div className="TeacherLayout__brand">Teacher Area</div>
        <nav className="TeacherLayout__nav">
          <NavLink
            to="/"
            className={({ isActive }) => `TeacherLayout__link${isActive || location.pathname === '/' ? ' TeacherLayout__link--active' : ''}`}
            end
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/teacher/students"
            className={({ isActive }) => `TeacherLayout__link${isActive ? ' TeacherLayout__link--active' : ''}`}
          >
            Students
          </NavLink>
          <NavLink
            to="/teacher/profile"
            className={({ isActive }) => `TeacherLayout__link${isActive ? ' TeacherLayout__link--active' : ''}`}
          >
            Profile
          </NavLink>
        </nav>
      </aside>
      <main className="TeacherLayout__content">
        {children ?? <Outlet context={{ profile }} />}
      </main>
    </div>
  );
}

