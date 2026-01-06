import React from 'react';
import { collection, onSnapshot, query, where, getDocs, getDoc, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import { openGoogleCalendar } from '../../utils/googleCalendar';

type Student = {
  id: string;
  name: string;
  grade?: string;
  notes?: string;
  email?: string;
  phone?: string;
};

type Appointment = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  dateTime: Timestamp;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Timestamp;
};

export default function TeacherStudents() {
  const { profile } = useFirebaseAuth();
  const [students, setStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchType, setSearchType] = React.useState<'email' | 'phone'>('email');
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  
  // Appointment scheduling state
  const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = React.useState(false);
  const [appointmentDate, setAppointmentDate] = React.useState('');
  const [appointmentTime, setAppointmentTime] = React.useState('');
  const [appointmentNotes, setAppointmentNotes] = React.useState('');
  const [isSavingAppointment, setIsSavingAppointment] = React.useState(false);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);

  React.useEffect(() => {
    if (!profile?.uid) return;

    // Listen to this teacher's students in their own subcollection:
    // /users/{teacherId}/students/{studentId}
    const studentsRef = collection(db, 'users', profile.uid, 'students');
    const q = query(studentsRef);
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next: Student[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || data.fullName || 'Unnamed',
            grade: data.grade,
            notes: data.notes,
            email: data.email,
            phone: data.phone,
          };
        });
        setStudents(next);
        setLoading(false);
      },
      () => {
        setStudents([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [profile?.uid]);

  // Listen to appointments for this teacher
  React.useEffect(() => {
    if (!profile?.uid) return;

    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef, where('teacherId', '==', profile.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next: Appointment[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            studentId: data.studentId,
            studentName: data.studentName,
            teacherId: data.teacherId,
            dateTime: data.dateTime,
            notes: data.notes,
            status: data.status || 'scheduled',
            createdAt: data.createdAt,
          };
        });
        setAppointments(next);
      },
      (err) => {
        console.error('Error fetching appointments:', err);
      }
    );

    return () => unsub();
  }, [profile?.uid]);

  const searchForStudent = async () => {
    if (!searchQuery.trim() || !profile?.uid) {
      setError('Please enter an email or phone number');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const usersCollection = collection(db, 'users');
      let searchQueryLower = searchQuery.trim().toLowerCase();
      
      if (searchType === 'email') {
        // Search by email
        const emailQuery = query(usersCollection, where('role', '==', 'student'));
        const snapshot = await getDocs(emailQuery);
        const results = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              email: data.email as string | undefined,
              phone: data.phone as string | undefined,
              fullName: data.fullName as string | undefined,
              name: data.name as string | undefined,
              role: data.role as string | undefined,
            };
          })
          .filter((user) => {
            const email = (user.email || '').toLowerCase();
            return email.includes(searchQueryLower);
          });
        setSearchResults(results);
      } else {
        // Search by phone
        const phoneQuery = query(usersCollection, where('role', '==', 'student'));
        const snapshot = await getDocs(phoneQuery);
        const results = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              email: data.email as string | undefined,
              phone: data.phone as string | undefined,
              fullName: data.fullName as string | undefined,
              name: data.name as string | undefined,
              role: data.role as string | undefined,
            };
          })
          .filter((user) => {
            const phone = (user.phone || '').replace(/[^0-9]/g, '');
            const searchPhone = searchQueryLower.replace(/[^0-9]/g, '');
            return phone.includes(searchPhone) || searchPhone.includes(phone);
          });
        setSearchResults(results);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Search error:', e);
      setError('Failed to search for students. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const addStudent = async (studentUser: any) => {
    if (!profile?.uid) {
      setError('You must be logged in to add students.');
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Validate required fields
      if (!studentUser.id) {
        setError('Invalid student data. Please try searching again.');
        return;
      }

      // Check if student is already added
      const existingRef = doc(db, 'users', profile.uid, 'students', studentUser.id);
      const existingSnapshot = await getDoc(existingRef);
      if (existingSnapshot.exists()) {
        setError('This student is already in your list.');
        return;
      }

      // Prepare student data
      const studentData = {
        teacherId: profile.uid,
        userId: studentUser.id,
        name: studentUser.fullName || studentUser.name || 'Unnamed Student',
        email: studentUser.email || null,
        phone: studentUser.phone || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // eslint-disable-next-line no-console
      console.log('[AddStudent] Creating student document:', { teacherId: profile.uid, userId: studentUser.id, studentData });

      // Add/merge student into this teacher's students subcollection
      // Path: /users/{teacherId}/students/{studentUser.id}
      const studentRef = doc(db, 'users', profile.uid, 'students', studentUser.id);
      await setDoc(studentRef, studentData, { merge: true });

      // eslint-disable-next-line no-console
      console.log('[AddStudent] Student document created successfully');

      setSuccess(`Successfully added ${studentUser.fullName || studentUser.email} to your students!`);
      setSearchQuery('');
      setSearchResults([]);
      setShowAddForm(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[AddStudent] Error details:', {
        code: e?.code,
        message: e?.message,
        stack: e?.stack,
        teacherId: profile?.uid,
        studentId: studentUser?.id,
      });
      
      if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please make sure your Firestore security rules are deployed and allow teachers to add students. The rules should allow create if request.data.teacherId == request.auth.uid');
      } else if (e?.message) {
        setError(`Failed to add student: ${e.message}`);
      } else {
        setError('Failed to add student. Please try again.');
      }
    }
  };

  const openAppointmentModal = (student: Student) => {
    setSelectedStudent(student);
    setShowAppointmentModal(true);
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentNotes('');
    setError(null);
  };

  const closeAppointmentModal = () => {
    setShowAppointmentModal(false);
    setSelectedStudent(null);
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentNotes('');
    setError(null);
  };

  const saveAppointment = async () => {
    if (!profile?.uid || !selectedStudent) {
      setError('Missing required information.');
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      setError('Please select both date and time for the appointment.');
      return;
    }

    setIsSavingAppointment(true);
    setError(null);

    try {
      // Combine date and time into a single datetime
      const dateTimeString = `${appointmentDate}T${appointmentTime}`;
      const appointmentDateTime = new Date(dateTimeString);

      // Validate that the appointment is in the future
      if (appointmentDateTime <= new Date()) {
        setError('Please select a future date and time for the appointment.');
        setIsSavingAppointment(false);
        return;
      }

      // Get teacher name
      const teacherName = profile.fullName || 'Teacher';

      // Create appointment document
      const appointmentData = {
        teacherId: profile.uid,
        teacherName: teacherName,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        dateTime: Timestamp.fromDate(appointmentDateTime),
        notes: appointmentNotes.trim() || null,
        status: 'scheduled',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const appointmentsRef = collection(db, 'appointments');
      const newAppointmentRef = doc(appointmentsRef);
      const appointmentId = newAppointmentRef.id;
      
      // Create the appointment document
      await setDoc(newAppointmentRef, {
        ...appointmentData,
        appointmentId: appointmentId,
      });

      // Add to teacher's calendar
      const teacherCalendarRef = doc(db, 'users', profile.uid, 'calendar', appointmentId);
      await setDoc(teacherCalendarRef, {
        appointmentId: appointmentId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        dateTime: Timestamp.fromDate(appointmentDateTime),
        notes: appointmentNotes.trim() || null,
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      // Add to student's calendar
      const studentCalendarRef = doc(db, 'users', selectedStudent.id, 'calendar', appointmentId);
      await setDoc(studentCalendarRef, {
        appointmentId: appointmentId,
        teacherId: profile.uid,
        teacherName: teacherName,
        dateTime: Timestamp.fromDate(appointmentDateTime),
        notes: appointmentNotes.trim() || null,
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      // Calculate end time (default 1 hour duration)
      const endTime = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000);

      // Offer to add to Google Calendar
      const addToGoogleCalendar = window.confirm(
        `Appointment scheduled with ${selectedStudent.name}!\n\n` +
        `Would you like to add this to your Google Calendar?`
      );

      if (addToGoogleCalendar) {
        openGoogleCalendar({
          title: `Appointment with ${selectedStudent.name}`,
          description: appointmentNotes.trim() || `Appointment with ${selectedStudent.name}`,
          startTime: appointmentDateTime,
          endTime: endTime,
        });
      }

      setSuccess(`Appointment scheduled with ${selectedStudent.name} for ${appointmentDateTime.toLocaleString()}`);
      closeAppointmentModal();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      console.error('[SaveAppointment] Error:', e);
      if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firestore security rules.');
      } else {
        setError(`Failed to save appointment: ${e?.message || 'Unknown error'}`);
      }
    } finally {
      setIsSavingAppointment(false);
    }
  };

  const getStudentAppointments = (studentId: string) => {
    return appointments
      .filter(apt => apt.studentId === studentId && apt.status === 'scheduled')
      .sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis());
  };

  const removeStudent = async (studentId: string, studentName: string) => {
    if (!profile?.uid) {
      setError('You must be logged in to remove students.');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${studentName} from your students list? All lessons with this student will also be deleted.`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Find all appointments between this teacher and student
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('teacherId', '==', profile.uid),
        where('studentId', '==', studentId)
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

        // Delete from teacher's calendar
        const teacherCalendarRef = doc(db, 'users', profile.uid, 'calendar', appointmentId);
        batch.delete(teacherCalendarRef);

        // Delete from student's calendar
        const studentCalendarRef = doc(db, 'users', studentId, 'calendar', appointmentId);
        batch.delete(studentCalendarRef);
      }

      // Delete the student document from the teacher's students subcollection
      const studentRef = doc(db, 'users', profile.uid, 'students', studentId);
      batch.delete(studentRef);

      // Commit all deletions
      await batch.commit();

      const lessonsCount = appointmentsSnapshot.size;
      const lessonsText = lessonsCount === 1 ? 'lesson' : 'lessons';
      setSuccess(`Successfully removed ${studentName} from your students list. ${lessonsCount > 0 ? `${lessonsCount} ${lessonsText} deleted.` : ''}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[RemoveStudent] Error:', e);
      if (e?.code === 'permission-denied' || e?.code === 'PERMISSION_DENIED') {
        setError('Permission denied. Please check your Firestore security rules.');
      } else {
        setError(`Failed to remove student: ${e?.message || 'Unknown error'}`);
      }
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
    <div>
      <h1 style={{ fontSize: 26, color: '#ffffff', marginBottom: 12 }}>Your Students</h1>
          <p style={{ color: '#cbd5f5', marginBottom: 0 }}>
            Linked students appear here. Add students by searching for their email or phone number.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setSearchQuery('');
            setSearchResults([]);
            setError(null);
            setSuccess(null);
          }}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: '1px solid rgba(148,163,184,0.35)',
            background: showAddForm ? '#4f46e5' : 'rgba(59,130,246,0.2)',
            color: '#ffffff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add Student'}
        </button>
      </div>

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

      {showAddForm && (
        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(148,163,184,0.18)',
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 18, color: '#ffffff', marginBottom: 16 }}>Add Student</h2>
          
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => {
                setSearchType('email');
                setSearchQuery('');
                setSearchResults([]);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.35)',
                background: searchType === 'email' ? '#4f46e5' : 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Search by Email
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchType('phone');
                setSearchQuery('');
                setSearchResults([]);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.35)',
                background: searchType === 'phone' ? '#4f46e5' : 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Search by Phone
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input
              type={searchType === 'email' ? 'email' : 'tel'}
              placeholder={searchType === 'email' ? 'student@example.com' : '+1234567890'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSearching) {
                  searchForStudent();
                }
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(2,6,23,0.6)',
                color: '#e2e8f0',
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={searchForStudent}
              disabled={isSearching || !searchQuery.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: isSearching || !searchQuery.trim() ? 'rgba(59,130,246,0.5)' : '#3b82f6',
                color: '#ffffff',
                fontWeight: 700,
                cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.5)',
              color: '#fca5a5',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {searchResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, color: '#cbd5f5', marginBottom: 12 }}>Search Results:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(148,163,184,0.18)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
                        {result.fullName || result.name || 'Unnamed Student'}
                      </div>
                      {result.email && (
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>📧 {result.email}</div>
                      )}
                      {result.phone && (
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>📞 {result.phone}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => addStudent(result)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#22c55e',
                        color: '#ffffff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResults.length === 0 && !isSearching && searchQuery && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              color: '#94a3b8',
              textAlign: 'center',
            }}>
              No students found. Make sure the student has signed up with this {searchType}.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="TeacherLayout__content--center" style={{ minHeight: 200 }}>
          Loading students…
        </div>
      ) : students.length === 0 ? (
        <div className="TeacherStudents__row" style={{ borderRadius: 12 }}>
          You don’t have any students yet. Add them from your admin panel or contact support.
        </div>
      ) : (
        <div className="TeacherStudents__list">
          {students.map((student) => {
            const studentAppointments = getStudentAppointments(student.id);
            return (
              <div key={student.id} className="TeacherStudents__row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{student.name}</div>
                  {student.grade && <div style={{ color: '#94a3b8', fontSize: 14 }}>Grade: {student.grade}</div>}
                  {student.email && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>📧 {student.email}</div>}
                  {student.phone && <div style={{ color: '#94a3b8', fontSize: 12 }}>📞 {student.phone}</div>}
                  {studentAppointments.length > 0 && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(59,130,246,0.1)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)' }}>
                      <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, marginBottom: 4 }}>Upcoming Appointments:</div>
                      {studentAppointments.map((apt) => (
                        <div key={apt.id} style={{ fontSize: 11, color: '#cbd5f5', marginTop: 4 }}>
                          📅 {apt.dateTime.toDate().toLocaleString()}
                          {apt.notes && <span style={{ color: '#94a3b8' }}> - {apt.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {student.notes && <div style={{ color: '#cbd5f5', fontSize: 14, maxWidth: 320, marginTop: 8 }}>{student.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={() => openAppointmentModal(student)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid rgba(59,130,246,0.5)',
                      background: 'rgba(59,130,246,0.2)',
                      color: '#93c5fd',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                    }}
                  >
                    📅 Schedule Appointment
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStudent(student.id, student.name)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid rgba(239,68,68,0.5)',
                      background: 'rgba(239,68,68,0.2)',
                      color: '#fca5a5',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Appointment Modal */}
      {showAppointmentModal && selectedStudent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAppointmentModal();
            }
          }}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              border: '1px solid rgba(148,163,184,0.3)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, color: '#ffffff', marginBottom: 8 }}>
              Schedule Appointment with {selectedStudent.name}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
              Select a date and time for your appointment
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#cbd5f5', fontSize: 14, marginBottom: 8, fontWeight: 600 }}>
                Date
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: 'rgba(2,6,23,0.6)',
                  color: '#e2e8f0',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#cbd5f5', fontSize: 14, marginBottom: 8, fontWeight: 600 }}>
                Time
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: 'rgba(2,6,23,0.6)',
                  color: '#e2e8f0',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#cbd5f5', fontSize: 14, marginBottom: 8, fontWeight: 600 }}>
                Notes (optional)
              </label>
              <textarea
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                placeholder="Add any notes about this appointment..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: 'rgba(2,6,23,0.6)',
                  color: '#e2e8f0',
                  fontSize: 14,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.5)',
                color: '#fca5a5',
                marginBottom: 16,
                fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeAppointmentModal}
                disabled={isSavingAppointment}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  cursor: isSavingAppointment ? 'not-allowed' : 'pointer',
                  opacity: isSavingAppointment ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAppointment}
                disabled={isSavingAppointment || !appointmentDate || !appointmentTime}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: isSavingAppointment || !appointmentDate || !appointmentTime ? 'rgba(59,130,246,0.5)' : '#3b82f6',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: isSavingAppointment || !appointmentDate || !appointmentTime ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingAppointment ? 'Saving...' : 'Schedule Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

