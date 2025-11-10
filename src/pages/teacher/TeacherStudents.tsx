import React from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';

type Student = {
  id: string;
  name: string;
  grade?: string;
  notes?: string;
};

export default function TeacherStudents() {
  const { profile } = useFirebaseAuth();
  const [students, setStudents] = React.useState<Student[]>([]);
  const [loading, setLoading] = React.useState(true);

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
            name: data.name || 'Unnamed',
            grade: data.grade,
            notes: data.notes,
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

  return (
    <div>
      <h1 style={{ fontSize: 26, color: '#ffffff', marginBottom: 12 }}>Your Students</h1>
      <p style={{ color: '#cbd5f5', marginBottom: 20 }}>
        Linked students appear here. Each student document includes a <code style={{ color: '#a5b4fc' }}>teacherId</code> field referencing your UID.
      </p>

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
              </div>
              {student.notes && <div style={{ color: '#cbd5f5', fontSize: 14, maxWidth: 320 }}>{student.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

