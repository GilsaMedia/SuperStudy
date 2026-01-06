import React from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import { openGoogleCalendar } from '../../utils/googleCalendar';

type CalendarAppointment = {
  id: string;
  appointmentId: string;
  teacherId?: string;
  teacherName?: string;
  dateTime: Timestamp;
  notes?: string;
  status: string;
};

export default function StudentDashboard() {
  const { profile } = useFirebaseAuth();
  const [appointments, setAppointments] = React.useState<CalendarAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = React.useState(true);

  // Listen to student's calendar
  React.useEffect(() => {
    if (!profile?.uid) {
      setLoadingAppointments(false);
      return;
    }

    const calendarRef = collection(db, 'users', profile.uid, 'calendar');
    const q = query(calendarRef, orderBy('dateTime', 'asc'));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const now = new Date();
        const appointmentsToCheck: Array<{ docSnap: any; data: any; aptDate: Date }> = [];
        
        // First, collect all valid appointments
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const aptDate = data.dateTime.toDate();
          
          // Only process scheduled appointments in the future with a teacherId
          if (data.status === 'scheduled' && aptDate >= now && data.teacherId) {
            appointmentsToCheck.push({ docSnap, data, aptDate });
          }
        }
        
        // Check all teachers in parallel
        const teacherChecks = await Promise.all(
          appointmentsToCheck.map(async ({ docSnap, data }): Promise<CalendarAppointment | null> => {
            const studentRef = doc(db, 'users', data.teacherId, 'students', profile.uid);
            const studentDoc = await getDoc(studentRef);
            
            // Only include if student is still learning with this teacher
            if (studentDoc.exists()) {
              return {
                id: docSnap.id,
                appointmentId: data.appointmentId,
                teacherId: data.teacherId,
                teacherName: data.teacherName,
                dateTime: data.dateTime,
                notes: data.notes,
                status: data.status || 'scheduled',
              } as CalendarAppointment;
            }
            return null;
          })
        );
        
        // Filter out nulls and sort by date
        const appointmentsWithTeachers = teacherChecks
          .filter((apt): apt is CalendarAppointment => apt !== null)
          .sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis());
        
        setAppointments(appointmentsWithTeachers);
        setLoadingAppointments(false);
      },
      (err) => {
        console.error('Error fetching calendar:', err);
        setLoadingAppointments(false);
      }
    );

    return () => unsub();
  }, [profile?.uid]);

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: '#0b1024', color: '#e2e8f0', padding: '48px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 30, color: '#ffffff', marginBottom: 16 }}>
          Welcome back, {profile?.fullName || 'Student'} 👋
        </h1>
        <p style={{ color: '#cbd5f5', marginBottom: 32 }}>
          This is your student dashboard. View your upcoming appointments and manage your learning journey.
        </p>

        {/* Upcoming Appointments Section */}
        {appointments.length > 0 && (
          <div
            style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontSize: 20, color: '#ffffff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              📅 Upcoming Appointments
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {appointments.slice(0, 5).map((apt) => {
                const aptDate = apt.dateTime.toDate();
                const isToday = aptDate.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={apt.id}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 18 }}>📅</div>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>
                          {apt.teacherName || 'Teacher'}
                        </div>
                        {isToday && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(34,197,94,0.2)',
                              color: '#86efac',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Today
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#93c5fd', fontSize: 14, marginBottom: 4 }}>
                        {aptDate.toLocaleString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                      {apt.notes && (
                        <div style={{ color: '#cbd5f5', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>
                          {apt.notes}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const endTime = new Date(aptDate.getTime() + 60 * 60 * 1000); // 1 hour duration
                        openGoogleCalendar({
                          title: `Appointment with ${apt.teacherName || 'Teacher'}`,
                          description: apt.notes || `Appointment with ${apt.teacherName || 'Teacher'}`,
                          startTime: aptDate,
                          endTime: endTime,
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(59,130,246,0.5)',
                        background: 'rgba(59,130,246,0.2)',
                        color: '#93c5fd',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                      }}
                      title="Add to Google Calendar"
                    >
                      📅 Add to Calendar
                    </button>
                  </div>
                );
              })}
            </div>
            {appointments.length > 5 && (
              <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>
                + {appointments.length - 5} more appointment{appointments.length - 5 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {!loadingAppointments && appointments.length === 0 && (
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <h3 style={{ fontSize: 18, color: '#ffffff', marginBottom: 8 }}>No Upcoming Appointments</h3>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>
              Your teachers will schedule appointments with you here. Check back soon!
            </p>
          </div>
        )}

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
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
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
            <h2 style={{ fontSize: 22, color: '#ffffff', margin: 0 }}>My Teachers</h2>
            <p style={{ color: '#cbd5f5', margin: 0 }}>
              View the teachers who have added you as their student.
            </p>
            <div>
              <Link
                to="/student/my-teachers"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(34,197,94,0.5)',
                  background: '#22c55e',
                  color: '#ffffff',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                View My Teachers
              </Link>
            </div>
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
    </div>
  );
}

