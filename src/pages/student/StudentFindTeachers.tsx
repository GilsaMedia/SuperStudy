import React from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

type Teacher = {
  id: string;
  fullName?: string;
  subject?: string;
  points?: string;
  location?: string;
};

const SUBJECT_OPTIONS = [
  { value: 'all', label: 'All subjects' },
  { value: 'Math', label: 'Math' },
  { value: 'English', label: 'English' },
  { value: 'Physics', label: 'Physics' },
  { value: 'Chemistry', label: 'Chemistry' },
  { value: 'Biology', label: 'Biology' },
  { value: 'History', label: 'History' },
  { value: 'Computer Science', label: 'Computer Science' },
];

export default function StudentFindTeachers() {
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState('all');
  const [locationQuery, setLocationQuery] = React.useState('');

  React.useEffect(() => {
    let active = true;
    const fetchTeachers = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseCollection = collection(db, 'users');
        const baseQuery =
          subject === 'all'
            ? query(baseCollection, where('role', '==', 'teacher'))
            : query(baseCollection, where('role', '==', 'teacher'), where('subject', '==', subject));

        const snapshot = await getDocs(baseQuery);
        if (!active) return;
        const list: Teacher[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            fullName: data.fullName || data.name,
            subject: data.subject,
            points: data.points,
            location: data.location,
          };
        });
        setTeachers(list);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load teachers', e);
        if (active) setError('Failed to load teachers. Please try again later.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchTeachers();
    return () => {
      active = false;
    };
  }, [subject]);

  const normalizedLocation = locationQuery.trim().toLowerCase();
  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSubject = subject === 'all' || (teacher.subject || '').toLowerCase() === subject.toLowerCase();

    // Simple location proximity: case-insensitive substring/prefix match. Replace with real geocoding later.
    const locationText = (teacher.location || '').trim().toLowerCase();
    const matchesLocation =
      !normalizedLocation ||
      locationText.startsWith(normalizedLocation) ||
      locationText.includes(normalizedLocation);

    return matchesSubject && matchesLocation;
  });

  const showEmptyState = !loading && !error && teachers.length === 0;
  const showNoMatches = !loading && !error && teachers.length > 0 && filteredTeachers.length === 0;

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: '#0b1024', color: '#e2e8f0', padding: '48px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 30, color: '#ffffff', marginBottom: 8 }}>Find Private Teachers</h1>
          <p style={{ color: '#cbd5f5' }}>
            Filter by subject and location to discover teachers who match your needs.
          </p>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontWeight: 600, color: '#cbd5f5', textTransform: 'uppercase', fontSize: 12 }}>
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(2,6,23,0.6)',
                color: '#e2e8f0',
              }}
            >
              {SUBJECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontWeight: 600, color: '#cbd5f5', textTransform: 'uppercase', fontSize: 12 }}>
              Location
            </label>
            <input
              type="text"
              placeholder="City or area"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(2,6,23,0.6)',
                color: '#e2e8f0',
              }}
            />
            <small style={{ color: '#94a3b8' }}>
              This uses a simple text match on the location stored in Firestore. Replace with real geolocation later if needed.
            </small>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setSubject('all');
                setLocationQuery('');
              }}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                fontWeight: 700,
              }}
            >
              Clear filters
            </button>
          </div>
        </section>

        {loading && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#cbd5f5' }}>Loading teachers…</div>
        )}

        {error && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#fca5a5' }}>{error}</div>
        )}

        {showEmptyState && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#cbd5f5' }}>
            No teachers available yet.
          </div>
        )}

        {showNoMatches && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#cbd5f5' }}>
            No teachers match your filters.
          </div>
        )}

        {!loading && !error && filteredTeachers.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 18,
            }}
          >
            {filteredTeachers.map((teacher) => (
              <div
                key={teacher.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(148,163,184,0.18)',
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>
                  {teacher.fullName || 'Unnamed Teacher'}
                </div>
                <div style={{ color: '#cbd5f5' }}>Subject: {teacher.subject || '—'}</div>
                <div style={{ color: '#cbd5f5' }}>Units: {teacher.points || '—'}</div>
                <div style={{ color: '#cbd5f5' }}>Location: {teacher.location || '—'}</div>
                <button
                  type="button"
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#e2e8f0',
                    fontWeight: 700,
                    cursor: 'not-allowed',
                  }}
                  disabled
                >
                  Contact (coming soon)
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

