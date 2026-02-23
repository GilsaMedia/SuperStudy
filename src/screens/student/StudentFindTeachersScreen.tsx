import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { collection, getDocs, query, where, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import StarRating from '../../components/StarRating';
import { SUBJECTS } from '../../constants/subjects';
import { colors } from '../../theme';

const SUBJECT_OPTIONS = ['all', ...SUBJECTS];

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
  hasLessonsWithStudent?: boolean;
};

export default function StudentFindTeachersScreen() {
  const { user, profile } = useFirebaseAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subject, setSubject] = useState('all');
  const [locationQuery, setLocationQuery] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = useState<string | null>(null);
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});

  const checkHasLessons = useCallback(async (teacherId: string, studentId: string): Promise<boolean> => {
    try {
      const studentRef = doc(db, 'users', teacherId, 'students', studentId);
      const studentDoc = await getDoc(studentRef);
      if (!studentDoc.exists()) return false;
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsSnap = await getDocs(
        query(
          appointmentsRef,
          where('teacherId', '==', teacherId),
          where('studentId', '==', studentId)
        )
      );
      return !appointmentsSnap.empty;
    } catch {
      return false;
    }
  }, []);

  const fetchTeacherRatings = useCallback(async (teacherId: string) => {
    try {
      const ratingsRef = collection(db, 'users', teacherId, 'ratings');
      const snap = await getDocs(ratingsRef);
      let total = 0,
        count = 0;
      snap.docs.forEach((d) => {
        const r = d.data().rating;
        if (typeof r === 'number' && r >= 1 && r <= 5) {
          total += r;
          count++;
        }
        if (user?.uid && d.data().studentId === user.uid) {
          setUserRatings((prev) => ({ ...prev, [teacherId]: r }));
        }
      });
      return { average: count ? total / count : 0, count };
    } catch {
      return { average: 0, count: 0 };
    }
  }, [user?.uid]);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(query(usersRef, where('role', '==', 'teacher')));
      const list: Teacher[] = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const teacherId = docSnap.id;
          const { average, count } = await fetchTeacherRatings(teacherId);
          let hasLessons = false;
          if (user?.uid) hasLessons = await checkHasLessons(teacherId, user.uid);
          return {
            id: teacherId,
            fullName: data.fullName || data.name,
            subject: data.subject,
            subjects: Array.isArray(data.subjects) ? data.subjects : data.subject ? [data.subject] : undefined,
            points: data.points,
            location: data.location,
            email: data.email,
            phone: data.phone,
            rules: data.rules,
            averageRating: average,
            ratingCount: count,
            hasLessonsWithStudent: hasLessons,
          };
        })
      );
      setTeachers(list);
    } catch {
      setError('Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  }, [fetchTeacherRatings, checkHasLessons, user?.uid]);

  useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers]);

  const handleRating = async (teacherId: string, rating: number) => {
    if (!user || profile?.role !== 'student') {
      setError('You must be logged in as a student to rate.');
      return;
    }
    const hasLessons = await checkHasLessons(teacherId, user.uid);
    if (!hasLessons) {
      setError('You can only rate teachers you have had at least one lesson with.');
      return;
    }
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
      setUserRatings((prev) => ({ ...prev, [teacherId]: rating }));
      const { average, count } = await fetchTeacherRatings(teacherId);
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacherId ? { ...t, averageRating: average, ratingCount: count } : t))
      );
      setSuccess('Rating submitted!');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to submit rating.');
    } finally {
      setSubmittingRating(null);
    }
  };

  const copyToClipboard = async (text: string, type: 'email' | 'phone') => {
    await Clipboard.setStringAsync(text);
    if (type === 'email') {
      setCopiedEmail(text);
      setTimeout(() => setCopiedEmail(null), 2000);
    } else {
      setCopiedPhone(text);
      setTimeout(() => setCopiedPhone(null), 2000);
    }
  };

  const normalizedLocation = locationQuery.trim().toLowerCase();
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const teacherSubjects = t.subjects?.length ? t.subjects : t.subject ? [t.subject] : [];
      const matchSubject =
        subject === 'all' || teacherSubjects.some((s) => s.toLowerCase() === subject.toLowerCase());
      const loc = (t.location || '').trim().toLowerCase();
      const matchLoc =
        !normalizedLocation || loc.startsWith(normalizedLocation) || loc.includes(normalizedLocation);
      return matchSubject && matchLoc;
    });
  }, [teachers, subject, normalizedLocation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading teachers…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Find Private Teachers</Text>
      <Text style={styles.subtitle}>Filter by subject and location.</Text>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {SUBJECT_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, subject === s && styles.chipActive]}
              onPress={() => setSubject(s)}
            >
              <Text style={styles.chipText}>{s === 'all' ? 'All' : s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.filterLabel}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="City or area"
          placeholderTextColor={colors.textDim}
          value={locationQuery}
          onChangeText={setLocationQuery}
        />
      </View>

      {error ? <View style={styles.alertDanger}><Text style={styles.alertText}>{error}</Text></View> : null}
      {success ? <View style={styles.alertSuccess}><Text style={styles.alertText}>{success}</Text></View> : null}

      {filteredTeachers.length === 0 ? (
        <Text style={styles.empty}>No teachers match your filters.</Text>
      ) : (
        filteredTeachers.map((teacher) => (
          <View key={teacher.id} style={styles.card}>
            <Text style={styles.teacherName}>{teacher.fullName || 'Unnamed Teacher'}</Text>
            <View style={styles.ratingRow}>
              <StarRating
                rating={teacher.averageRating || 0}
                ratingCount={teacher.ratingCount || 0}
                interactive={
                  !!user &&
                  profile?.role === 'student' &&
                  submittingRating !== teacher.id &&
                  teacher.hasLessonsWithStudent === true
                }
                onRatingChange={(r) => handleRating(teacher.id, r)}
                size="small"
                showCount
              />
              {user && profile?.role === 'student' && !teacher.hasLessonsWithStudent && (
                <Text style={styles.rateHint}>Rate after your first lesson</Text>
              )}
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
                  <Pressable
                    style={[styles.contactBtn, copiedEmail === teacher.email && styles.contactBtnCopied]}
                    onPress={() => copyToClipboard(teacher.email!, 'email')}
                  >
                    <Text style={styles.contactBtnText}>
                      📧 {copiedEmail === teacher.email ? '✓ Copied!' : teacher.email}
                    </Text>
                  </Pressable>
                )}
                {teacher.phone && (
                  <Pressable
                    style={[styles.contactBtn, copiedPhone === teacher.phone && styles.contactBtnCopied]}
                    onPress={() => copyToClipboard(teacher.phone!, 'phone')}
                  >
                    <Text style={styles.contactBtnText}>
                      📞 {copiedPhone === teacher.phone ? '✓ Copied!' : teacher.phone}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
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
  filters: { marginBottom: 20 },
  filterLabel: { color: colors.textMuted, marginBottom: 8, fontWeight: '600' },
  chipScroll: { marginBottom: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginRight: 8,
    backgroundColor: 'rgba(2,6,23,0.6)',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText: { color: colors.text, fontSize: 14 },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(2,6,23,0.6)',
    color: colors.text,
    fontSize: 14,
  },
  alertDanger: { padding: 12, borderRadius: 8, backgroundColor: colors.dangerBg, marginBottom: 16 },
  alertSuccess: { padding: 12, borderRadius: 8, backgroundColor: colors.successBg, marginBottom: 16 },
  alertText: { color: colors.text, textAlign: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 40 },
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
  rateHint: { fontSize: 11, color: colors.textDim, fontStyle: 'italic', marginTop: 4 },
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
  contactBtnCopied: { backgroundColor: colors.successBg, borderColor: 'rgba(34,197,94,0.5)' },
  contactBtnText: { color: colors.primaryLight, fontSize: 14 },
});
