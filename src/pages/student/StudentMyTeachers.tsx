import React from 'react';
import { collection, getDocs, query, where, getDoc, doc, deleteDoc, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore';
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
  userRating?: number; // The current student's rating for this teacher
};

export default function StudentMyTeachers() {
  const { profile, user } = useFirebaseAuth();
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = React.useState<string | null>(null);

  // Fetch ratings for a specific teacher
  const fetchTeacherRatings = React.useCallback(async (teacherId: string, studentId: string): Promise<{ average: number; count: number; userRating?: number }> => {
    try {
      const ratingsRef = collection(db, 'users', teacherId, 'ratings');
      const ratingsSnapshot = await getDocs(ratingsRef);
      
      if (ratingsSnapshot.empty) {
        return { average: 0, count: 0 };
      }

      let totalRating = 0;
      let count = 0;
      let userRating: number | undefined;

      ratingsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const rating = data.rating as number;
        if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
          totalRating += rating;
          count++;
          // Check if this is the current student's rating (document ID should be studentId)
          if (docSnap.id === studentId || data.studentId === studentId) {
            userRating = rating;
          }
        }
      });

      const average = count > 0 ? totalRating / count : 0;
      return { average, count, userRating };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Failed to load ratings for teacher ${teacherId}:`, e);
      return { average: 0, count: 0 };
    }
  }, []);

  React.useEffect(() => {
    if (!profile?.uid || !user) {
      setLoading(false);
      return;
    }

    const fetchMyTeachers = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get all teachers
        const usersCollection = collection(db, 'users');
        const teachersQuery = query(usersCollection, where('role', '==', 'teacher'));
        const teachersSnapshot = await getDocs(teachersQuery);

        // Check which teachers have this student in their students subcollection
        const myTeachers: Teacher[] = [];
        
        for (const teacherDoc of teachersSnapshot.docs) {
          const teacherId = teacherDoc.id;
          // Check if this student exists in the teacher's students subcollection
          const studentRef = doc(db, 'users', teacherId, 'students', profile.uid);
          const studentDoc = await getDoc(studentRef);
          
          if (studentDoc.exists()) {
            const teacherData = teacherDoc.data();
            
            // Fetch ratings for this teacher
            const { average, count, userRating } = await fetchTeacherRatings(teacherId, profile.uid);
            
            myTeachers.push({
              id: teacherId,
              fullName: teacherData.fullName || teacherData.name,
              subject: teacherData.subject,
              points: teacherData.points,
              location: teacherData.location,
              email: teacherData.email,
              phone: teacherData.phone,
              rules: teacherData.rules,
              averageRating: average,
              ratingCount: count,
              userRating: userRating,
            });
          }
        }

        setTeachers(myTeachers);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load teachers', e);
        setError('Failed to load your teachers. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    void fetchMyTeachers();
  }, [profile?.uid, user, fetchTeacherRatings]);

  const leaveTeacher = async (teacherId: string, teacherName: string) => {
    if (!profile?.uid) {
      setError('You must be logged in to leave a teacher.');
      return;
    }

    if (!window.confirm(`Are you sure you want to leave ${teacherName}? You will no longer be able to see their information or schedule appointments. All lessons with this teacher will also be deleted.`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Find all appointments between this student and teacher
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('teacherId', '==', teacherId),
        where('studentId', '==', profile.uid)
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);

      // Use a batch to delete all related documents
      const batch = writeBatch(db);

      // Delete each appointment and related calendar entries
      for (const appointmentDoc of appointmentsSnapshot.docs) {
        const appointmentId = appointmentDoc.id;
        
        // Delete the appointment
        const appointmentRef = doc(db, 'appointments', appointmentId);
        batch.delete(appointmentRef);

        // Delete from student's calendar
        const studentCalendarRef = doc(db, 'users', profile.uid, 'calendar', appointmentId);
        batch.delete(studentCalendarRef);

        // Delete from teacher's calendar
        const teacherCalendarRef = doc(db, 'users', teacherId, 'calendar', appointmentId);
        batch.delete(teacherCalendarRef);
      }

      // Delete the student document from the teacher's students subcollection
      const studentRef = doc(db, 'users', teacherId, 'students', profile.uid);
      batch.delete(studentRef);

      // Commit all deletions
      await batch.commit();

      // Remove the teacher from the local state
      setTeachers((prev) => prev.filter((t) => t.id !== teacherId));

      const lessonsCount = appointmentsSnapshot.size;
      const lessonsText = lessonsCount === 1 ? 'lesson' : 'lessons';
      setSuccess(`Successfully left ${teacherName}. ${lessonsCount > 0 ? `${lessonsCount} ${lessonsText} deleted.` : ''}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[LeaveTeacher] Error:', e);
      if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firestore security rules.');
      } else {
        setError(`Failed to leave teacher: ${e?.message || 'Unknown error'}`);
      }
    }
  };

  const handleRatingSubmit = async (teacherId: string, rating: number) => {
    if (!user || !profile || profile.role !== 'student') {
      setError('You must be logged in as a student to rate teachers.');
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

      // Recalculate average rating for this teacher
      const { average, count } = await fetchTeacherRatings(teacherId, user.uid);
      setTeachers((prev) =>
        prev.map((t) => 
          t.id === teacherId 
            ? { ...t, averageRating: average, ratingCount: count, userRating: rating } 
            : t
        )
      );
      
      // Show success message briefly
      setSuccess('Rating submitted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit rating:', e);
      
      // Provide more specific error messages
      if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firestore security rules.');
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
      // Show a temporary success message
      const button = document.querySelector(`[data-copied="${text}"]`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = type === 'email' ? '✓ Email Copied!' : '✓ Phone Copied!';
        setTimeout(() => {
          if (button) button.textContent = originalText;
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
        const button = document.querySelector(`[data-copied="${text}"]`);
        if (button) {
          const originalText = button.textContent;
          button.textContent = type === 'email' ? '✓ Email Copied!' : '✓ Phone Copied!';
          setTimeout(() => {
            if (button) button.textContent = originalText;
          }, 2000);
        }
      } catch (fallbackErr) {
        // eslint-disable-next-line no-console
        console.error('Failed to copy:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: '#0b1024', color: '#e2e8f0', padding: '48px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 30, color: '#ffffff', marginBottom: 8 }}>My Teachers</h1>
          <p style={{ color: '#cbd5f5' }}>
            View the teachers who have added you as their student.
          </p>
        </header>

        {loading && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#cbd5f5' }}>Loading your teachers…</div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.2)',
            border: '1px solid rgba(239,68,68,0.5)',
            color: '#fca5a5',
            marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(34,197,94,0.2)',
            border: '1px solid rgba(34,197,94,0.5)',
            color: '#86efac',
            marginBottom: 20,
          }}>
            {success}
          </div>
        )}

        {!loading && !error && teachers.length === 0 && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍🏫</div>
            <div style={{ fontSize: 20, color: '#ffffff', marginBottom: 8, fontWeight: 600 }}>
              No teachers yet
            </div>
            <p style={{ color: '#cbd5f5', marginBottom: 16 }}>
              You don't have any teachers yet. Teachers will appear here once they add you as their student.
            </p>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>
              You can browse available teachers in the <strong>Find Teachers</strong> section.
            </p>
          </div>
        )}

        {!loading && !error && teachers.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 18,
            }}
          >
            {teachers.map((teacher) => (
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
                
                {/* Star Rating Display */}
                <div style={{ marginBottom: 8 }}>
                  <StarRating
                    rating={teacher.averageRating || 0}
                    ratingCount={teacher.ratingCount || 0}
                    userRating={teacher.userRating}
                    interactive={
                      !!user && 
                      profile?.role === 'student' && 
                      submittingRating !== teacher.id
                    }
                    onRatingChange={(rating) => handleRatingSubmit(teacher.id, rating)}
                    size="small"
                    showCount={true}
                  />
                  {teacher.userRating && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                      Your rating: {teacher.userRating} star{teacher.userRating !== 1 ? 's' : ''}
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
                          data-copied={teacher.email}
                          onClick={() => copyToClipboard(teacher.email!, 'email')}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(59,130,246,0.3)',
                            background: 'rgba(59,130,246,0.1)',
                            color: '#93c5fd',
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(59,130,246,0.2)';
                            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
                            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📧</span>
                            <span>{teacher.email}</span>
                          </div>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>Click to copy</span>
                        </button>
                      )}
                      
                      {teacher.phone && (
                        <button
                          type="button"
                          data-copied={teacher.phone}
                          onClick={() => copyToClipboard(teacher.phone!, 'phone')}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(34,197,94,0.3)',
                            background: 'rgba(34,197,94,0.1)',
                            color: '#86efac',
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(34,197,94,0.2)';
                            e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(34,197,94,0.1)';
                            e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📞</span>
                            <span>{teacher.phone}</span>
                          </div>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>Click to copy</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(148,163,184,0.18)' }}>
                  <button
                    type="button"
                    onClick={() => leaveTeacher(teacher.id, teacher.fullName || 'this teacher')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(239,68,68,0.5)',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#fca5a5',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                      e.currentTarget.style.borderColor = 'rgba(239,68,68,0.7)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)';
                    }}
                  >
                    🚪 Leave Teacher
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

