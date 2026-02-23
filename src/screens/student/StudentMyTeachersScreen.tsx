import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import StarRating from '../../components/StarRating';
import { colors } from '../../theme';

type Teacher = {
  id: string;
  fullName?: string;
  subject?: string;
  subjects?: string[];
  points?: string;
  location?: string;
  email?: string;
  phone?: string;
  rules?: string;
  averageRating?: number;
  ratingCount?: number;
  userRating?: number;
};

export default function StudentMyTeachersScreen() {
  const { profile, user } = useFirebaseAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = useState<string | null>(null);

  const fetchTeacherRatings = useCallback(
    async (teacherId: string, studentId: string): Promise<{ average: number; count: number; userRating?: number }> => {
      try {
        const ratingsRef = collection(db, 'users', teacherId, 'ratings');
        const snap = await getDocs(ratingsRef);
        let total = 0,
          count = 0,
          userRating: number | undefined;
        snap.docs.forEach((d) => {
          const data = d.data();
          const r = data.rating as number;
          if (typeof r === 'number' && r >= 1 && r <= 5) {
            total += r;
            count++;
            if (d.id === studentId || data.studentId === studentId) userRating = r;
          }
        });
        return { average: count ? total / count : 0, count, userRating };
      } catch {
        return { average: 0, count: 0 };
      }
    },
    []
  );

  useEffect(() => {
    if (!profile?.uid || !user) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersRef = collection(db, 'users');
        const teachersSnap = await getDocs(query(usersRef, where('role', '==', 'teacher')));
        const list: Teacher[] = [];
        for (const teacherDoc of teachersSnap.docs) {
          const teacherId = teacherDoc.id;
          const studentRef = doc(db, 'users', teacherId, 'students', profile.uid);
          const studentDoc = await getDoc(studentRef);
          if (!studentDoc.exists()) continue;
          const teacherProfileData = teacherDoc.data();
          const { average, count, userRating } = await fetchTeacherRatings(teacherId, profile.uid);
          list.push({
            id: teacherId,
            fullName: teacherProfileData?.fullName || teacherProfileData?.name,
            subject: teacherProfileData?.subject,
            subjects: Array.isArray(teacherProfileData?.subjects) ? teacherProfileData.subjects : teacherProfileData?.subject ? [teacherProfileData.subject] : undefined,
            points: teacherProfileData?.points,
            location: teacherProfileData?.location,
            email: teacherProfileData?.email,
            phone: teacherProfileData?.phone,
            rules: teacherProfileData?.rules,
            averageRating: average,
            ratingCount: count,
            userRating,
          });
        }
        setTeachers(list);
      } catch {
        setError('Failed to load your teachers.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [profile?.uid, user, fetchTeacherRatings]);

  const handleRating = async (teacherId: string, rating: number) => {
    if (!user || profile?.role !== 'student') return;
    setSubmittingRating(teacherId);
    setError(null);
    try {
      await setDoc(doc(db, 'users', teacherId, 'ratings', user.uid), {
        rating: Number(rating),
        studentId: user.uid,
        studentName: profile.fullName || 'Anonymous',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const { average, count } = await fetchTeacherRatings(teacherId, user.uid);
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === teacherId ? { ...t, averageRating: average, ratingCount: count, userRating: rating } : t
        )
      );
      setSuccess('Rating submitted!');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to submit rating.');
    } finally {
      setSubmittingRating(null);
    }
  };

  const leaveTeacher = (teacherId: string, teacherName: string) => {
    Alert.alert(
      'Leave teacher',
      `Are you sure you want to leave ${teacherName}? All lessons will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (!profile?.uid) return;
            setError(null);
            setSuccess(null);
            try {
              const appointmentsRef = collection(db, 'appointments');
              const appointmentsSnap = await getDocs(
                query(
                  appointmentsRef,
                  where('teacherId', '==', teacherId),
                  where('studentId', '==', profile.uid)
                )
              );
              const batch = writeBatch(db);
              appointmentsSnap.docs.forEach((d) => {
                const id = d.id;
                batch.delete(doc(db, 'appointments', id));
                batch.delete(doc(db, 'users', profile.uid, 'calendar', id));
                batch.delete(doc(db, 'users', teacherId, 'calendar', id));
              });
              batch.delete(doc(db, 'users', teacherId, 'students', profile.uid));
              await batch.commit();
              setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
              setSuccess(`Left ${teacherName}.`);
              setTimeout(() => setSuccess(null), 3000);
            } catch {
              setError('Failed to leave teacher.');
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = (text: string) => Clipboard.setStringAsync(text);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your teachers…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Teachers</Text>
      <Text style={styles.subtitle}>Teachers who have added you as their student.</Text>

      {error ? <View style={styles.alertDanger}><Text style={styles.alertText}>{error}</Text></View> : null}
      {success ? <View style={styles.alertSuccess}><Text style={styles.alertText}>{success}</Text></View> : null}

      {teachers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👨‍🏫</Text>
          <Text style={styles.emptyTitle}>No teachers yet</Text>
          <Text style={styles.emptyText}>Teachers will appear here once they add you.</Text>
        </View>
      ) : (
        teachers.map((teacher) => (
          <View key={teacher.id} style={styles.card}>
            <Text style={styles.teacherName}>{teacher.fullName || 'Unnamed Teacher'}</Text>
            <View style={styles.ratingRow}>
              <StarRating
                rating={teacher.averageRating || 0}
                ratingCount={teacher.ratingCount || 0}
                userRating={teacher.userRating}
                interactive={!!user && profile?.role === 'student' && submittingRating !== teacher.id}
                onRatingChange={(r) => handleRating(teacher.id, r)}
                size="small"
                showCount
              />
            </View>
            {submittingRating === teacher.id && (
              <Text style={styles.submitting}>Submitting...</Text>
            )}
            <Text style={styles.meta}>Subjects: {teacher.subjects?.length ? teacher.subjects.join(', ') : teacher.subject || '—'}</Text>
            <Text style={styles.meta}>Units: {teacher.points || '—'}</Text>
            <Text style={styles.meta}>Location: {teacher.location || '—'}</Text>
            {teacher.rules ? (
              <View style={styles.rulesBox}>
                <Text style={styles.rulesLabel}>📋 Rules</Text>
                <Text style={styles.rulesText}>{teacher.rules}</Text>
              </View>
            ) : null}
            {(teacher.email || teacher.phone) && (
              <View style={styles.contactBox}>
                <Text style={styles.contactLabel}>Contact</Text>
                {teacher.email && (
                  <Pressable style={styles.contactBtn} onPress={() => copyToClipboard(teacher.email!)}>
                    <Text style={styles.contactBtnText}>📧 {teacher.email}</Text>
                  </Pressable>
                )}
                {teacher.phone && (
                  <Pressable style={styles.contactBtn} onPress={() => copyToClipboard(teacher.phone!)}>
                    <Text style={styles.contactBtnText}>📞 {teacher.phone}</Text>
                  </Pressable>
                )}
              </View>
            )}
            <TouchableOpacity
              style={styles.leaveBtn}
              onPress={() => leaveTeacher(teacher.id, teacher.fullName || 'this teacher')}
            >
              <Text style={styles.leaveBtnText}>🚪 Leave Teacher</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  title: { fontSize: 24, color: colors.white, marginBottom: 8, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: 20 },
  alertDanger: { padding: 12, borderRadius: 8, backgroundColor: colors.dangerBg, marginBottom: 16 },
  alertSuccess: { padding: 12, borderRadius: 8, backgroundColor: colors.successBg, marginBottom: 16 },
  alertText: { color: colors.text, textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, color: colors.white, marginBottom: 8, fontWeight: '600' },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  teacherName: { fontSize: 18, fontWeight: '700', color: colors.white, marginBottom: 8 },
  ratingRow: { marginBottom: 8 },
  submitting: { fontSize: 12, color: colors.primaryLight, fontStyle: 'italic', marginBottom: 4 },
  meta: { color: colors.textMuted, marginBottom: 4 },
  rulesBox: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: 'rgba(148,163,184,0.08)' },
  rulesLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600', marginBottom: 6 },
  rulesText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  contactBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  contactLabel: { fontSize: 11, color: colors.textDim, fontWeight: '600', marginBottom: 12 },
  contactBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    backgroundColor: colors.primaryBg,
    marginBottom: 8,
  },
  contactBtnText: { color: colors.primaryLight, fontSize: 14 },
  leaveBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
  },
  leaveBtnText: { color: colors.dangerLight, fontWeight: '600' },
});
