import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';

type TeacherProfile = {
  uid: string;
  role: 'teacher' | 'student';
  fullName?: string;
  email?: string;
  subject?: string;
  points?: string;
  location?: string;
};

type TeacherDashboardProps = {
  profileOverride?: TeacherProfile | null;
};

type OutletContext = {
  profile: TeacherProfile;
} | undefined;

export default function TeacherDashboard({ profileOverride }: TeacherDashboardProps = {}) {
  const outletContext = useOutletContext<OutletContext>();
  const { user, profile: authProfile } = useFirebaseAuth();
  const [studentCount, setStudentCount] = React.useState<number | null>(null);

  const profile = profileOverride || outletContext?.profile || authProfile;

  React.useEffect(() => {
    let active = true;
    const fetchStudentCount = async () => {
      if (!user) return;
      try {
        const snapshot = await getDoc(doc(db, 'teacherStats', user.uid));
        if (snapshot.exists() && active) {
          const data = snapshot.data();
          setStudentCount(typeof data.totalStudents === 'number' ? data.totalStudents : 0);
        } else if (active) {
          setStudentCount(0);
        }
      } catch (err) {
        if (active) {
          setStudentCount(0);
        }
      }
    };

    void fetchStudentCount();
    return () => {
      active = false;
    };
  }, [user]);

  const cards = [
    {
      title: 'Total Students',
      value: studentCount === null ? '—' : studentCount,
      description: 'Number of students currently linked to you.',
    },
    {
      title: 'Next Lesson',
      value: 'You have no lessons scheduled today.',
      description: 'Add lessons from your planner (coming soon).',
    },
    {
      title: 'Quick Links',
      value: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link to="/teacher/students" style={{ color: '#93c5fd' }}>View Students</Link>
          <Link to="/teacher/profile" style={{ color: '#93c5fd' }}>Edit Profile</Link>
        </div>
      ),
      description: null,
    },
  ];

  if (!profile) {
    return null;
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, color: '#ffffff', marginBottom: 8 }}>
        Welcome, {profile.fullName || 'Teacher'} 👋
      </h1>
      <p style={{ color: '#cbd5f5', marginBottom: 24 }}>
        Subject: {profile.subject || 'Not set'} · Units: {profile.points || '—'} · Location: {profile.location || '—'}
      </p>

      <div className="TeacherDashboard__grid">
        {cards.map((card) => (
          <div key={card.title} className="TeacherDashboard__card">
            <div className="TeacherDashboard__cardTitle">{card.title}</div>
            <div className="TeacherDashboard__cardValue">{card.value}</div>
            {card.description && (
              <p style={{ marginTop: 8, color: '#cbd5f5', fontSize: 14 }}>{card.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

