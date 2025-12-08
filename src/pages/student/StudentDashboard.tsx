import React from 'react';
import { Link } from 'react-router-dom';
import { useFirebaseAuth } from '../../context/FirebaseAuth';

export default function StudentDashboard() {
  const { profile } = useFirebaseAuth();

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: '#0b1024', color: '#e2e8f0', padding: '48px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 30, color: '#ffffff', marginBottom: 16 }}>
          Welcome back, {profile?.fullName || 'Student'} 👋
        </h1>
        <p style={{ color: '#cbd5f5', marginBottom: 32 }}>
          This is your student dashboard. We’ll add progress tracking, assignments, and lessons here soon.
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#a5b4fc',
              marginBottom: 8,
            }}
          >
            About SuperStudy
          </div>
          <div style={{ fontSize: 20, color: '#ffffff', fontWeight: 600, marginBottom: 8 }}>
            Your home base for guided learning
          </div>
          <p style={{ marginTop: 4, color: '#cbd5f5', fontSize: 14, maxWidth: 720, lineHeight: 1.6 }}>
            SuperStudy brings everything you need for school into one place. It&apos;s designed to
            support you through real homework, test prep, and long‑term learning goals—not just
            quick answers. From this dashboard you can move between tools that help you understand
            concepts deeply and get support from real teachers when you need it.
          </p>
          <p style={{ marginTop: 8, color: '#cbd5f5', fontSize: 14, maxWidth: 720, lineHeight: 1.6 }}>
            The <strong>Study Helper</strong> gives you step‑by‑step guidance on tough questions,
            using hints and explanations instead of simply giving away the answer. The
            <strong> Private Teachers</strong> area lets you browse verified tutors by subject and
            location so you can find the right person to work with one‑on‑one. Soon you&apos;ll
            also see your upcoming lessons, assignments, and progress here, so this page becomes the
            central place where you start every study session.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 22, color: '#ffffff', margin: 0 }}>Need a private teacher?</h2>
          <p style={{ color: '#cbd5f5', margin: 0 }}>
            Browse verified teachers by subject and location to find the perfect match.
          </p>
          <div>
            <Link
              to="/student/teachers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.5)',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Find a Private Teacher
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

