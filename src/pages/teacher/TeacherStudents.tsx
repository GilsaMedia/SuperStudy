import React from 'react';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';

type Student = {
  id: string;
  name: string;
  grade?: string;
  notes?: string;
  email?: string;
  phone?: string;
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

  React.useEffect(() => {
    if (!profile?.uid) return;

    const q = query(collection(db, 'students'), where('teacherId', '==', profile.uid));
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
      const existingQuery = query(
        collection(db, 'students'),
        where('teacherId', '==', profile.uid),
        where('userId', '==', studentUser.id)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
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

      // Add student to students collection
      const studentRef = doc(collection(db, 'students'));
      await setDoc(studentRef, studentData);

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
          {students.map((student) => (
            <div key={student.id} className="TeacherStudents__row">
              <div>
                <div style={{ fontWeight: 600, color: '#ffffff' }}>{student.name}</div>
                {student.grade && <div style={{ color: '#94a3b8', fontSize: 14 }}>Grade: {student.grade}</div>}
                {student.email && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>📧 {student.email}</div>}
                {student.phone && <div style={{ color: '#94a3b8', fontSize: 12 }}>📞 {student.phone}</div>}
              </div>
              {student.notes && <div style={{ color: '#cbd5f5', fontSize: 14, maxWidth: 320 }}>{student.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

