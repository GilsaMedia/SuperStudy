import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Pressable,
} from 'react-native';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import { openGoogleCalendar } from '../../utils/googleCalendar';
import { colors } from '../../theme';

type Student = { id: string; name: string; grade?: string; notes?: string; email?: string; phone?: string };
type Appointment = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  dateTime: Timestamp;
  notes?: string;
  status: string;
};

export default function TeacherStudentsScreen() {
  const { profile } = useFirebaseAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'email' | 'phone'>('email');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [isSavingAppointment, setIsSavingAppointment] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;
    const studentsRef = collection(db, 'users', profile.uid, 'students');
    const unsub = onSnapshot(
      query(studentsRef),
      (snap) => {
        setStudents(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name || data.fullName || 'Unnamed',
              grade: data.grade,
              notes: data.notes,
              email: data.email,
              phone: data.phone,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) return;
    const appointmentsRef = collection(db, 'appointments');
    const unsub = onSnapshot(
      query(appointmentsRef, where('teacherId', '==', profile.uid)),
      (snap) => {
        setAppointments(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              studentId: data.studentId,
              studentName: data.studentName,
              teacherId: data.teacherId,
              dateTime: data.dateTime,
              notes: data.notes,
              status: data.status || 'scheduled',
            };
          })
        );
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
      const usersRef = collection(db, 'users');
      const snap = await getDocs(query(usersRef, where('role', '==', 'student')));
      const lower = searchQuery.trim().toLowerCase();
      const results = snap.docs
        .map((d) => ({
          id: d.id,
          email: d.data().email,
          phone: d.data().phone,
          fullName: d.data().fullName,
          name: d.data().name,
        }))
        .filter((u) => {
          if (searchType === 'email') return (u.email || '').toLowerCase().includes(lower);
          const phone = (u.phone || '').replace(/\D/g, '');
          const searchPhone = lower.replace(/\D/g, '');
          return phone.includes(searchPhone) || searchPhone.includes(phone);
        });
      setSearchResults(results);
    } catch {
      setError('Failed to search.');
    } finally {
      setIsSearching(false);
    }
  };

  const addStudent = async (studentUser: any) => {
    if (!profile?.uid) return;
    setError(null);
    try {
      const existingRef = doc(db, 'users', profile.uid, 'students', studentUser.id);
      if ((await getDoc(existingRef)).exists()) {
        setError('Student already in your list.');
        return;
      }
      await setDoc(existingRef, {
        teacherId: profile.uid,
        userId: studentUser.id,
        name: studentUser.fullName || studentUser.name || 'Unnamed Student',
        email: studentUser.email || null,
        phone: studentUser.phone || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSuccess(`Added ${studentUser.fullName || studentUser.email}!`);
      setSearchQuery('');
      setSearchResults([]);
      setShowAddForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Failed to add student.');
    }
  };

  const openModal = (student: Student) => {
    setSelectedStudent(student);
    setModalVisible(true);
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentNotes('');
    setError(null);
  };

  const saveAppointment = async () => {
    if (!profile?.uid || !selectedStudent) return;
    if (!appointmentDate || !appointmentTime) {
      setError('Select date and time.');
      return;
    }
    const dateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    if (dateTime <= new Date()) {
      setError('Select a future date and time.');
      return;
    }
    setIsSavingAppointment(true);
    setError(null);
    try {
      const teacherName = profile.fullName || 'Teacher';
      const appointmentData = {
        teacherId: profile.uid,
        teacherName,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        dateTime: Timestamp.fromDate(dateTime),
        notes: appointmentNotes.trim() || null,
        status: 'scheduled',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const appointmentsRef = collection(db, 'appointments');
      const newRef = doc(appointmentsRef);
      const appointmentId = newRef.id;
      await setDoc(newRef, { ...appointmentData, appointmentId });
      await setDoc(doc(db, 'users', profile.uid, 'calendar', appointmentId), {
        appointmentId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        dateTime: Timestamp.fromDate(dateTime),
        notes: appointmentNotes.trim() || null,
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', selectedStudent.id, 'calendar', appointmentId), {
        appointmentId,
        teacherId: profile.uid,
        teacherName,
        dateTime: Timestamp.fromDate(dateTime),
        notes: appointmentNotes.trim() || null,
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });
      setSuccess(`Scheduled with ${selectedStudent.name}`);
      setModalVisible(false);
      setSelectedStudent(null);
      setTimeout(() => setSuccess(null), 3000);
      Alert.alert('Add to Calendar?', 'Open Google Calendar to add this event?', [
        { text: 'No' },
        {
          text: 'Yes',
          onPress: () =>
            openGoogleCalendar({
              title: `Appointment with ${selectedStudent.name}`,
              description: appointmentNotes || '',
              startTime: dateTime,
              endTime: new Date(dateTime.getTime() + 60 * 60 * 1000),
            }),
        },
      ]);
    } catch (e: any) {
      setError(e?.message || 'Failed to save appointment.');
    } finally {
      setIsSavingAppointment(false);
    }
  };

  const removeStudent = (studentId: string, studentName: string) => {
    Alert.alert(
      'Remove student',
      `Remove ${studentName}? All lessons with this student will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!profile?.uid) return;
            try {
              const appointmentsRef = collection(db, 'appointments');
              const snap = await getDocs(
                query(
                  appointmentsRef,
                  where('teacherId', '==', profile.uid),
                  where('studentId', '==', studentId)
                )
              );
              const batch = writeBatch(db);
              snap.docs.forEach((d) => {
                const id = d.id;
                batch.delete(doc(db, 'appointments', id));
                batch.delete(doc(db, 'users', profile.uid, 'calendar', id));
                batch.delete(doc(db, 'users', studentId, 'calendar', id));
              });
              batch.delete(doc(db, 'users', profile.uid, 'students', studentId));
              await batch.commit();
              setSuccess(`Removed ${studentName}.`);
              setTimeout(() => setSuccess(null), 3000);
            } catch {
              setError('Failed to remove student.');
            }
          },
        },
      ]
    );
  };

  const getStudentAppointments = (studentId: string) =>
    appointments
      .filter((a) => a.studentId === studentId && a.status === 'scheduled')
      .sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis());

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Students</Text>
        <TouchableOpacity
          style={[styles.addBtn, showAddForm && styles.addBtnActive]}
          onPress={() => {
            setShowAddForm(!showAddForm);
            setSearchQuery('');
            setSearchResults([]);
            setError(null);
          }}
        >
          <Text style={styles.addBtnText}>{showAddForm ? 'Cancel' : '+ Add Student'}</Text>
        </TouchableOpacity>
      </View>

      {success ? <View style={styles.alertSuccess}><Text style={styles.alertText}>{success}</Text></View> : null}
      {error ? <View style={styles.alertDanger}><Text style={styles.alertText}>{error}</Text></View> : null}

      {showAddForm && (
        <View style={styles.searchCard}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggle, searchType === 'email' && styles.toggleActive]}
              onPress={() => { setSearchType('email'); setSearchResults([]); }}
            >
              <Text style={styles.toggleText}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggle, searchType === 'phone' && styles.toggleActive]}
              onPress={() => { setSearchType('phone'); setSearchResults([]); }}
            >
              <Text style={styles.toggleText}>Phone</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder={searchType === 'email' ? 'student@example.com' : '+1234567890'}
            placeholderTextColor={colors.textDim}
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardType={searchType === 'email' ? 'email-address' : 'phone-pad'}
          />
          <TouchableOpacity
            style={[styles.searchBtn, (isSearching || !searchQuery.trim()) && styles.searchBtnDisabled]}
            onPress={searchForStudent}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Search</Text>}
          </TouchableOpacity>
          {searchResults.length > 0 && (
            <View style={styles.results}>
              {searchResults.map((r) => (
                <View key={r.id} style={styles.resultRow}>
                  <View>
                    <Text style={styles.resultName}>{r.fullName || r.name || 'Unnamed'}</Text>
                    {r.email ? <Text style={styles.resultMeta}>📧 {r.email}</Text> : null}
                    {r.phone ? <Text style={styles.resultMeta}>📞 {r.phone}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.addStudentBtn} onPress={() => addStudent(r)}>
                    <Text style={styles.addStudentBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {students.length === 0 ? (
        <Text style={styles.empty}>You don't have any students yet. Add them by searching email or phone.</Text>
      ) : (
        students.map((student) => {
          const apts = getStudentAppointments(student.id);
          return (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                {student.email ? <Text style={styles.studentMeta}>📧 {student.email}</Text> : null}
                {student.phone ? <Text style={styles.studentMeta}>📞 {student.phone}</Text> : null}
                {apts.length > 0 && (
                  <View style={styles.aptsBox}>
                    <Text style={styles.aptsTitle}>Upcoming:</Text>
                    {apts.map((apt) => (
                      <Text key={apt.id} style={styles.aptsItem}>
                        📅 {apt.dateTime.toDate().toLocaleString()}
                        {apt.notes ? ` - ${apt.notes}` : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.studentActions}>
                <TouchableOpacity style={styles.scheduleBtn} onPress={() => openModal(student)}>
                  <Text style={styles.scheduleBtnText}>📅 Schedule</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeStudent(student.id, student.name)}>
                  <Text style={styles.removeBtnText}>🗑️ Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Schedule with {selectedStudent?.name}</Text>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={appointmentDate}
              onChangeText={setAppointmentDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textDim}
            />
            <Text style={styles.label}>Time</Text>
            <TextInput
              style={styles.input}
              value={appointmentTime}
              onChangeText={setAppointmentTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textDim}
            />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={appointmentNotes}
              onChangeText={setAppointmentNotes}
              placeholder="Notes..."
              placeholderTextColor={colors.textDim}
              multiline
            />
            {error ? <Text style={styles.modalError}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)} disabled={isSavingAppointment}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, (!appointmentDate || !appointmentTime || isSavingAppointment) && styles.modalBtnDisabled]}
                onPress={saveAppointment}
                disabled={!appointmentDate || !appointmentTime || isSavingAppointment}
              >
                {isSavingAppointment ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Schedule</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, color: colors.white, fontWeight: '700' },
  addBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.primaryBg },
  addBtnActive: { backgroundColor: '#4f46e5' },
  addBtnText: { color: colors.white, fontWeight: '700' },
  alertSuccess: { padding: 12, borderRadius: 10, backgroundColor: colors.successBg, marginBottom: 16 },
  alertDanger: { padding: 12, borderRadius: 10, backgroundColor: colors.dangerBg, marginBottom: 16 },
  alertText: { color: colors.text, textAlign: 'center' },
  searchCard: { padding: 20, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toggle: { flex: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  toggleActive: { borderColor: colors.primary, backgroundColor: '#4f46e5' },
  toggleText: { color: colors.text, fontWeight: '600' },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(2,6,23,0.6)',
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  searchBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: colors.white, fontWeight: '700' },
  results: { marginTop: 16 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  resultName: { fontWeight: '600', color: colors.white, marginBottom: 4 },
  resultMeta: { color: colors.textDim, fontSize: 12 },
  addStudentBtn: { backgroundColor: colors.success, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  addStudentBtnText: { color: colors.white, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 40 },
  studentCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  studentInfo: { flex: 1 },
  studentName: { fontWeight: '600', color: colors.white, marginBottom: 4 },
  studentMeta: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  aptsBox: { marginTop: 12, padding: 8, borderRadius: 8, backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  aptsTitle: { fontSize: 12, color: colors.primaryLight, fontWeight: '600', marginBottom: 4 },
  aptsItem: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  studentActions: { gap: 8 },
  scheduleBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)', backgroundColor: colors.primaryBg },
  scheduleBtnText: { color: colors.primaryLight, fontWeight: '600', fontSize: 13 },
  removeBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', backgroundColor: colors.dangerBg },
  removeBtnText: { color: colors.dangerLight, fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'rgba(15,23,42,0.95)', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: colors.borderStrong },
  modalTitle: { fontSize: 20, color: colors.white, marginBottom: 20 },
  label: { color: colors.textMuted, marginBottom: 8, fontWeight: '600' },
  modalError: { color: colors.dangerLight, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 24 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'rgba(255,255,255,0.06)' },
  modalBtnSave: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: colors.primary },
  modalBtnDisabled: { opacity: 0.6 },
  modalBtnText: { color: colors.text },
});
