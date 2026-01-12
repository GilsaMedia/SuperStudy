import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import { openGoogleCalendar } from '../../utils/googleCalendar';
import StarRating from '../../components/StarRating';

type CalendarAppointment = {
  id: string;
  appointmentId: string;
  studentId?: string;
  studentName?: string;
  dateTime: Timestamp;
  notes?: string;
  status: string;
};

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
  const [appointments, setAppointments] = React.useState<CalendarAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = React.useState(true);
  const [averageRating, setAverageRating] = React.useState<number>(0);
  const [ratingCount, setRatingCount] = React.useState<number>(0);
  const [loadingRatings, setLoadingRatings] = React.useState(true);

  const profile = profileOverride || outletContext?.profile || authProfile;

  // Listen to students subcollection to get real-time count
  React.useEffect(() => {
    if (!user?.uid) {
      setStudentCount(0);
      return;
    }

    const studentsRef = collection(db, 'users', user.uid, 'students');
    const q = query(studentsRef);
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setStudentCount(snapshot.size);
      },
      (err) => {
        console.error('Error fetching student count:', err);
        setStudentCount(0);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Fetch teacher's ratings
  React.useEffect(() => {
    if (!user?.uid) {
      setLoadingRatings(false);
      return;
    }

    const fetchRatings = async () => {
      try {
        const ratingsRef = collection(db, 'users', user.uid, 'ratings');
        const ratingsSnapshot = await getDocs(ratingsRef);
        
        if (ratingsSnapshot.empty) {
          setAverageRating(0);
          setRatingCount(0);
          setLoadingRatings(false);
          return;
        }

        let totalRating = 0;
        let count = 0;

        ratingsSnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const rating = data.rating as number;
          if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
            totalRating += rating;
            count++;
          }
        });

        const average = count > 0 ? totalRating / count : 0;
        setAverageRating(average);
        setRatingCount(count);
      } catch (err) {
        console.error('Error fetching ratings:', err);
        setAverageRating(0);
        setRatingCount(0);
      } finally {
        setLoadingRatings(false);
      }
    };

    void fetchRatings();
  }, [user?.uid]);

  // Listen to teacher's calendar
  React.useEffect(() => {
    if (!user?.uid) {
      setLoadingAppointments(false);
      return;
    }

    const calendarRef = collection(db, 'users', user.uid, 'calendar');
    const q = query(calendarRef, orderBy('dateTime', 'asc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const now = new Date();
        const next: CalendarAppointment[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              appointmentId: data.appointmentId,
              studentId: data.studentId,
              studentName: data.studentName,
              dateTime: data.dateTime,
              notes: data.notes,
              status: data.status || 'scheduled',
            };
          })
          .filter((apt) => {
            // Only show scheduled appointments in the future
            const aptDate = apt.dateTime.toDate();
            return apt.status === 'scheduled' && aptDate >= now;
          })
          .sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis());
        setAppointments(next);
        setLoadingAppointments(false);
      },
      (err) => {
        console.error('Error fetching calendar:', err);
        setLoadingAppointments(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Get next appointment for the "Next Lesson" card
  const nextAppointment = appointments.length > 0 ? appointments[0] : null;
  const nextLessonValue = nextAppointment
    ? `${nextAppointment.studentName || 'Student'} - ${nextAppointment.dateTime.toDate().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : 'You have no lessons scheduled today.';

  const cards = [
    {
      title: 'Total Students',
      value: studentCount === null ? '—' : studentCount,
      description: 'Number of students currently linked to you.',
    },
    {
      title: 'Your Rating',
      value: loadingRatings ? (
        'Loading...'
      ) : ratingCount > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <StarRating
            rating={averageRating}
            ratingCount={ratingCount}
            interactive={false}
            size="medium"
            showCount={true}
          />
        </div>
      ) : (
        <div style={{ color: '#94a3b8' }}>No ratings yet</div>
      ),
      description: ratingCount > 0
        ? `Average rating from ${ratingCount} ${ratingCount === 1 ? 'student' : 'students'}.`
        : 'Students can rate you after lessons.',
    },
    {
      title: 'Next Lesson',
      value: nextLessonValue,
      description: nextAppointment
        ? `Schedule more from your students page.`
        : 'Add lessons from your students page.',
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

      {/* Upcoming Appointments Section */}
      {appointments.length > 0 && (
        <div
          style={{
            marginTop: 32,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 12,
            padding: 24,
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
                      <div style={{ fontSize: 18 }}>👤</div>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>
                        {apt.studentName || 'Student'}
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
                        title: `Appointment with ${apt.studentName || 'Student'}`,
                        description: apt.notes || `Appointment with ${apt.studentName || 'Student'}`,
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
            marginTop: 32,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
          <h3 style={{ fontSize: 18, color: '#ffffff', marginBottom: 8 }}>No Upcoming Appointments</h3>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
            Schedule appointments with your students from the{' '}
            <Link to="/teacher/students" style={{ color: '#93c5fd', textDecoration: 'underline' }}>
              Students page
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

