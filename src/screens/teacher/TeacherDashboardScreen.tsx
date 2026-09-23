import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, onSnapshot, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import { openGoogleCalendar } from '../../utils/googleCalendar';
import StarRating from '../../components/StarRating';
import { useLanguage } from '../../context/Language';
import { colors } from '../../theme';

type CalendarAppointment = {
  id: string;
  appointmentId: string;
  studentId?: string;
  studentName?: string;
  dateTime: Timestamp;
  notes?: string;
  status: string;
};

export default function TeacherDashboardScreen() {
  const { user, profile } = useFirebaseAuth();
  const navigation = useNavigation<any>();
  const { t, language } = useLanguage();
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [loadingRatings, setLoadingRatings] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setStudentCount(0);
      return;
    }
    const studentsRef = collection(db, 'users', user.uid, 'students');
    const unsub = onSnapshot(
      query(studentsRef),
      (snap) => setStudentCount(snap.size),
      () => setStudentCount(0)
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setLoadingRatings(false);
      return;
    }
    const load = async () => {
      try {
        const ratingsRef = collection(db, 'users', user.uid, 'ratings');
        const snap = await getDocs(ratingsRef);
        let total = 0,
          count = 0;
        snap.docs.forEach((d) => {
          const r = d.data().rating as number;
          if (typeof r === 'number' && r >= 1 && r <= 5) {
            total += r;
            count++;
          }
        });
        setAverageRating(count ? total / count : 0);
        setRatingCount(count);
      } catch {
        setAverageRating(0);
        setRatingCount(0);
      } finally {
        setLoadingRatings(false);
      }
    };
    void load();
  }, [user?.uid]);

  useEffect(() => {
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
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              appointmentId: data.appointmentId,
              studentId: data.studentId,
              studentName: data.studentName,
              dateTime: data.dateTime,
              notes: data.notes,
              status: data.status || 'scheduled',
            };
          })
          .filter((apt) => apt.status === 'scheduled' && apt.dateTime.toDate() >= now)
          .sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis());
        setAppointments(next);
        setLoadingAppointments(false);
      },
      () => setLoadingAppointments(false)
    );
    return () => unsub();
  }, [user?.uid]);

  const nextAppointment = appointments[0];
  const nextLessonValue = nextAppointment
    ? `${nextAppointment.studentName || t('Student')} - ${nextAppointment.dateTime.toDate().toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : t('You have no lessons scheduled today.');

  const subjectsText = profile?.subjects?.length
    ? profile.subjects.map((s) => t(s)).join(', ')
    : profile?.subject
      ? t(profile.subject)
      : t('Not set');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('Welcome, {name}', { name: profile?.fullName || t('Teacher') })} 👋</Text>
      <Text style={styles.subtitle}>
        {t('Subjects: {subjects} · Units: {units} · Location: {location}', {
          subjects: subjectsText,
          units: profile?.points || '—',
          location: profile?.location || '—',
        })}
      </Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Total Students')}</Text>
          <Text style={styles.cardValue}>{studentCount === null ? '—' : studentCount}</Text>
          <Text style={styles.cardDesc}>{t('Number of students linked to you.')}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Your Rating')}</Text>
          {loadingRatings ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : ratingCount > 0 ? (
            <StarRating rating={averageRating} ratingCount={ratingCount} interactive={false} size="medium" showCount />
          ) : (
            <Text style={styles.cardMuted}>{t('No ratings yet')}</Text>
          )}
          <Text style={styles.cardDesc}>
            {ratingCount > 0
              ? ratingCount === 1
                ? t('Average from {count} student.', { count: ratingCount })
                : t('Average from {count} students.', { count: ratingCount })
              : t('Students can rate you after lessons.')}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Next Lesson')}</Text>
          <Text style={styles.cardValue}>{nextLessonValue}</Text>
          <Text style={styles.cardDesc}>
            {nextAppointment ? t('Schedule more from Students tab.') : t('Add lessons from Students tab.')}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('TeacherStudents')}>
        <Text style={styles.linkBtnText}>{t('View Students')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('TeacherProfile')}>
        <Text style={styles.linkBtnText}>{t('Edit Profile')}</Text>
      </TouchableOpacity>

      {appointments.length > 0 && (
        <View style={styles.appointmentsCard}>
          <Text style={styles.appointmentsTitle}>📅 {t('Upcoming Appointments')}</Text>
          {appointments.slice(0, 5).map((apt) => {
            const aptDate = apt.dateTime.toDate();
            const isToday = aptDate.toDateString() === new Date().toDateString();
            return (
              <View key={apt.id} style={styles.aptRow}>
                <View style={styles.aptInfo}>
                  <View style={styles.aptHeader}>
                    <Text style={styles.aptStudent}>{apt.studentName || t('Student')}</Text>
                    {isToday && <View style={styles.badge}><Text style={styles.badgeText}>{t('Today')}</Text></View>}
                  </View>
                  <Text style={styles.aptDate}>
                    {aptDate.toLocaleString(locale, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  {apt.notes ? <Text style={styles.aptNotes}>{apt.notes}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.calBtn}
                  onPress={() =>
                    openGoogleCalendar({
                      title: t('Appointment with {name}', { name: apt.studentName || t('Student') }),
                      description: apt.notes || '',
                      startTime: aptDate,
                      endTime: new Date(aptDate.getTime() + 60 * 60 * 1000),
                    })
                  }
                >
                  <Text style={styles.calBtnText}>📅 {t('Add to Calendar')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, color: colors.white, marginBottom: 8, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: 24 },
  grid: { gap: 16, marginBottom: 24 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: { fontSize: 14, color: colors.primaryLight, marginBottom: 8, fontWeight: '600' },
  cardValue: { fontSize: 20, color: colors.white, fontWeight: '600' },
  cardMuted: { color: colors.textDim },
  cardDesc: { marginTop: 8, color: colors.textMuted, fontSize: 14 },
  linkBtn: { marginBottom: 12 },
  linkBtnText: { color: colors.primaryLight, fontSize: 16 },
  appointmentsCard: {
    marginTop: 24,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    borderRadius: 12,
    padding: 20,
  },
  appointmentsTitle: { fontSize: 18, color: colors.white, marginBottom: 16, fontWeight: '600' },
  aptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  aptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aptStudent: { fontWeight: '600', color: colors.white },
  badge: { backgroundColor: colors.successBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 11, color: colors.successLight, fontWeight: '600' },
  aptDate: { color: colors.primaryLight, fontSize: 14, marginTop: 4 },
  aptNotes: { color: colors.textMuted, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  aptInfo: { flex: 1 },
  calBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)', backgroundColor: colors.primaryBg },
  calBtnText: { color: colors.primaryLight, fontWeight: '600', fontSize: 12 },
});
