import React from 'react';
import { collection, getDocs, query, where, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import StarRating from '../../components/StarRating';

type Teacher = {
  id: string;
  fullName?: string;
  subject?: string;
  points?: string;
  location?: string;
  email?: string;
  phone?: string;
  rules?: string;
  averageRating?: number;
  ratingCount?: number;
  hasLessonsWithStudent?: boolean; // Whether the current student has had lessons with this teacher
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
  const { user, profile } = useFirebaseAuth();
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState('all');
  const [locationQuery, setLocationQuery] = React.useState('');
  const [copiedEmail, setCopiedEmail] = React.useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = React.useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = React.useState<string | null>(null);
  const [userRatings, setUserRatings] = React.useState<Record<string, number>>({});

  // Check if student has had at least one lesson with a teacher
  const checkStudentHasLessons = React.useCallback(async (teacherId: string, studentId: string): Promise<boolean> => {
    try {
      // Check if student is in teacher's students subcollection (proxy for having lessons)
      const studentDocRef = doc(db, 'users', teacherId, 'students', studentId);
      const studentDoc = await getDoc(studentDocRef);
      if (!studentDoc.exists()) {
        return false;
      }

      // Also check if there's at least one appointment (preferably completed)
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('teacherId', '==', teacherId),
        where('studentId', '==', studentId)
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      
      // Return true if there's at least one appointment (scheduled, completed, or past)
      return !appointmentsSnapshot.empty;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Failed to check lessons for teacher ${teacherId}:`, e);
      return false;
    }
  }, []);

  // Fetch ratings for a specific teacher
  const fetchTeacherRatings = React.useCallback(async (teacherId: string): Promise<{ average: number; count: number }> => {
    try {
      const ratingsRef = collection(db, 'users', teacherId, 'ratings');
      const ratingsSnapshot = await getDocs(ratingsRef);
      
      if (ratingsSnapshot.empty) {
        return { average: 0, count: 0 };
      }

      let totalRating = 0;
      let count = 0;
      const ratings: Record<string, number> = {};

      ratingsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const rating = data.rating as number;
        if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
          totalRating += rating;
          count++;
          if (data.studentId) {
            ratings[data.studentId] = rating;
          }
        }
      });

      // Store user's rating if they've rated this teacher
      if (user?.uid && ratings[user.uid]) {
        setUserRatings((prev) => ({ ...prev, [teacherId]: ratings[user.uid] }));
      }

      const average = count > 0 ? totalRating / count : 0;
      return { average, count };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Failed to load ratings for teacher ${teacherId}:`, e);
      return { average: 0, count: 0 };
    }
  }, [user]);

  const fetchTeachers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseCollection = collection(db, 'users');
      // Always fetch all teachers, then filter client-side for more flexibility
      const baseQuery = query(baseCollection, where('role', '==', 'teacher'));

      const snapshot = await getDocs(baseQuery);
      const list: Teacher[] = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const teacherId = docSnap.id;
          
          // Fetch ratings for this teacher
          const { average, count } = await fetchTeacherRatings(teacherId);
          
          // Check if current student has had lessons with this teacher
          let hasLessonsWithStudent = false;
          if (user?.uid) {
            hasLessonsWithStudent = await checkStudentHasLessons(teacherId, user.uid);
          }
          
          return {
            id: teacherId,
            fullName: data.fullName || data.name,
            subject: data.subject,
            points: data.points,
            location: data.location,
            email: data.email,
            phone: data.phone,
            rules: data.rules,
            averageRating: average,
            ratingCount: count,
            hasLessonsWithStudent,
          };
        })
      );
      // eslint-disable-next-line no-console
      console.log(`[FindTeachers] Loaded ${list.length} teachers from Firestore`);
      setTeachers(list);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load teachers', e);
      setError('Failed to load teachers. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [fetchTeacherRatings, checkStudentHasLessons, user]);

  React.useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers]);

  const handleSearch = () => {
    void fetchTeachers();
  };

  const handleRatingSubmit = async (teacherId: string, rating: number) => {
    if (!user || !profile || profile.role !== 'student') {
      setError('You must be logged in as a student to rate teachers.');
      return;
    }

    // Check if student has had lessons with this teacher
    const hasLessons = await checkStudentHasLessons(teacherId, user.uid);
    if (!hasLessons) {
      setError('You can only rate teachers you have had at least one lesson with.');
      return;
    }

    setSubmittingRating(teacherId);
    setError(null);
    try {
      // Store rating in Firestore: /users/{teacherId}/ratings/{studentId}
      const ratingRef = doc(db, 'users', teacherId, 'ratings', user.uid);
      await setDoc(ratingRef, {
        rating: Number(rating), // Ensure it's a number, not a string
        studentId: user.uid,
        studentName: profile.fullName || 'Anonymous',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update local state
      setUserRatings((prev) => ({ ...prev, [teacherId]: rating }));

      // Recalculate average rating for this teacher
      const { average, count } = await fetchTeacherRatings(teacherId);
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacherId ? { ...t, averageRating: average, ratingCount: count } : t))
      );
      
      // Show success message briefly
      setSuccess('Rating submitted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit rating:', e);
      
      // Provide more specific error messages
      if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Make sure you have had at least one lesson with this teacher.');
      } else if (e?.message) {
        setError(`Failed to submit rating: ${e.message}`);
      } else {
        setError('Failed to submit rating. Please try again.');
      }
    } finally {
      setSubmittingRating(null);
    }
  };

  const copyToClipboard = async (text: string, type: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(text);
        setTimeout(() => {
          setCopiedEmail(null);
        }, 2000);
      } else {
        setCopiedPhone(text);
        setTimeout(() => {
          setCopiedPhone(null);
        }, 2000);
      }
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        if (type === 'email') {
          setCopiedEmail(text);
          setTimeout(() => {
            setCopiedEmail(null);
          }, 2000);
        } else {
          setCopiedPhone(text);
          setTimeout(() => {
            setCopiedPhone(null);
          }, 2000);
        }
      } catch (fallbackErr) {
        // eslint-disable-next-line no-console
        console.error('Failed to copy:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const normalizedLocation = locationQuery.trim().toLowerCase();
  const filteredTeachers = React.useMemo(() => {
    const filtered = teachers.filter((teacher) => {
      // Filter by subject: if 'all' is selected, show all teachers
      const matchesSubject = subject === 'all' || (teacher.subject || '').toLowerCase() === subject.toLowerCase();

      // Filter by location: if location query is empty, show all teachers
      // Otherwise, do case-insensitive substring/prefix match
      const locationText = (teacher.location || '').trim().toLowerCase();
      const matchesLocation =
        !normalizedLocation ||
        locationText.startsWith(normalizedLocation) ||
        locationText.includes(normalizedLocation);

      return matchesSubject && matchesLocation;
    });
    // eslint-disable-next-line no-console
    console.log(`[FindTeachers] Filtered ${filtered.length} teachers (subject: ${subject}, location: "${locationQuery}")`);
    return filtered;
  }, [teachers, subject, normalizedLocation, locationQuery]);

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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  handleSearch();
                }
              }}
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

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: loading ? 'rgba(59,130,246,0.5)' : '#3b82f6',
                color: '#ffffff',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
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
                cursor: 'pointer',
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
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.5)',
              color: '#fca5a5',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(34,197,94,0.2)',
              border: '1px solid rgba(34,197,94,0.5)',
              color: '#86efac',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            {success}
          </div>
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
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                  {teacher.fullName || 'Unnamed Teacher'}
                </div>
                
                {/* Star Rating Display */}
                <div style={{ marginBottom: 8 }}>
                  <StarRating
                    rating={teacher.averageRating || 0}
                    ratingCount={teacher.ratingCount || 0}
                    interactive={
                      !!user && 
                      profile?.role === 'student' && 
                      submittingRating !== teacher.id &&
                      teacher.hasLessonsWithStudent === true
                    }
                    onRatingChange={(rating) => handleRatingSubmit(teacher.id, rating)}
                    size="small"
                    showCount={true}
                  />
                  {!!user && profile?.role === 'student' && !teacher.hasLessonsWithStudent && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                      Rate after your first lesson
                    </div>
                  )}
                </div>
                
                {submittingRating === teacher.id && (
                  <div style={{ fontSize: 12, color: '#93c5fd', marginBottom: 4, fontStyle: 'italic' }}>
                    Submitting rating...
                  </div>
                )}
                
                <div style={{ color: '#cbd5f5' }}>Subject: {teacher.subject || '—'}</div>
                <div style={{ color: '#cbd5f5' }}>Units: {teacher.points || '—'}</div>
                <div style={{ color: '#cbd5f5' }}>Location: {teacher.location || '—'}</div>
                
                {teacher.rules && (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📋 Rules
                    </div>
                    <div style={{ color: '#cbd5f5', fontSize: 13, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {teacher.rules}
                    </div>
                  </div>
                )}
                
                {(teacher.email || teacher.phone) && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(148,163,184,0.18)' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Contact Information
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {teacher.email && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(teacher.email!, 'email')}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(59,130,246,0.3)',
                            background: copiedEmail === teacher.email 
                              ? 'rgba(34,197,94,0.15)' 
                              : 'rgba(59,130,246,0.1)',
                            color: copiedEmail === teacher.email ? '#86efac' : '#93c5fd',
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: copiedEmail === teacher.email ? 600 : 500,
                          }}
                          onMouseEnter={(e) => {
                            if (copiedEmail !== teacher.email) {
                              e.currentTarget.style.background = 'rgba(59,130,246,0.2)';
                              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (copiedEmail !== teacher.email) {
                              e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
                              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📧</span>
                            <span>
                              {copiedEmail === teacher.email ? '✓ Email Copied!' : teacher.email}
                            </span>
                          </div>
                          {copiedEmail !== teacher.email && (
                            <span style={{ fontSize: 11, opacity: 0.7 }}>Click to copy</span>
                          )}
                        </button>
                      )}
                      
                      {teacher.phone && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(teacher.phone!, 'phone')}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(34,197,94,0.3)',
                            background: copiedPhone === teacher.phone 
                              ? 'rgba(34,197,94,0.25)' 
                              : 'rgba(34,197,94,0.1)',
                            color: copiedPhone === teacher.phone ? '#ffffff' : '#86efac',
                            textDecoration: 'none',
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: copiedPhone === teacher.phone ? 600 : 500,
                          }}
                          onMouseEnter={(e) => {
                            if (copiedPhone !== teacher.phone) {
                              e.currentTarget.style.background = 'rgba(34,197,94,0.2)';
                              e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (copiedPhone !== teacher.phone) {
                              e.currentTarget.style.background = 'rgba(34,197,94,0.1)';
                              e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📞</span>
                            <span>
                              {copiedPhone === teacher.phone ? '✓ Phone Copied!' : teacher.phone}
                            </span>
                          </div>
                          {copiedPhone !== teacher.phone && (
                            <span style={{ fontSize: 11, opacity: 0.7 }}>Click to copy</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

