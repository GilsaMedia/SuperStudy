import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, onSnapshot, query, orderBy, getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import { openGoogleCalendar } from '../../utils/googleCalendar';
import { colors } from '../../theme';
import { useLanguage } from '../../context/Language';
import LearningResumeCard from '../../components/LearningResumeCard';
import { LearningResume, parseLearningResume } from '../../utils/learningResume';

type CalendarAppointment = {
  id: string;
  appointmentId: string;
  teacherId?: string;
  teacherName?: string;
  dateTime: Timestamp;
  notes?: string;
  status: string;
};

export default function StudentDashboardScreen() {
  const { profile } = useFirebaseAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation<any>();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [resume, setResume] = useState<LearningResume | null>(profile?.learningResume ?? null);

  useEffect(() => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }
    const calendarRef = collection(db, 'users', profile.uid, 'calendar');
    const q = query(calendarRef, orderBy('dateTime', 'asc'));
    // Snapshots can arrive back to back (cache, then server) while the async link checks
    // below are still running; only the newest one may update state.
    let seq = 0;
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const mine = ++seq;
        try {
          const now = new Date();
          const list: CalendarAppointment[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (!data.dateTime?.toDate) continue;
            const aptDate = data.dateTime.toDate();
            if (data.status !== 'scheduled' || aptDate < now || !data.teacherId) continue;
            const studentRef = doc(db, 'users', data.teacherId, 'students', profile.uid);
            const studentDoc = await getDoc(studentRef).catch(() => null);
            if (!studentDoc?.exists()) continue;
            list.push({
              id: docSnap.id,
              appointmentId: data.appointmentId,
              teacherId: data.teacherId,
              teacherName: data.teacherName,
              dateTime: data.dateTime,
              notes: data.notes,
              status: data.status || 'scheduled',
            });
          }
          list.sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis());
          if (mine === seq) setAppointments(list);
        } finally {
          if (mine === seq) setLoading(false);
        }
      },
      () => setLoading(false)
    );
    return () => {
      seq = -1; // drop results that land after unmount
      unsub();
    };
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) {
      setResume(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', profile.uid),
      (snap) => {
        setResume(parseLearningResume(snap.data()?.learningResume));
      },
      () => setResume(profile.learningResume ?? null)
    );
    return () => unsub();
  }, [profile?.uid, profile?.learningResume]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {t('Welcome back, {name} 👋', { name: profile?.fullName || t('Student') })}
      </Text>
      <Text style={styles.subtitle}>
        {t('View your upcoming appointments and manage your learning journey.')}
      </Text>

      <LearningResumeCard resume={resume} audience="student" />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : appointments.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('📅 Upcoming Appointments')}</Text>
          {appointments.slice(0, 5).map((apt) => {
            const aptDate = apt.dateTime.toDate();
            const isToday = aptDate.toDateString() === new Date().toDateString();
            return (
              <View key={apt.id} style={styles.aptRow}>
                <View style={styles.aptInfo}>
                  <View style={styles.aptHeader}>
                    <Text style={styles.aptTeacher}>{apt.teacherName || t('Teacher')}</Text>
                    {isToday && <View style={styles.badge}><Text style={styles.badgeText}>{t('Today')}</Text></View>}
                  </View>
                  <Text style={styles.aptDate}>
                    {aptDate.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', {
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
                      title: t('Appointment with {name}', { name: apt.teacherName || t('Teacher') }),
                      description: apt.notes || '',
                      startTime: aptDate,
                      endTime: new Date(aptDate.getTime() + 60 * 60 * 1000),
                    })
                  }
                >
                  <Text style={styles.calBtnText}>{t('📅 Add to Calendar')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {appointments.length > 5 && (
            <Text style={styles.more}>{t('+ {count} more', { count: appointments.length - 5 })}</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>{t('No Upcoming Appointments')}</Text>
          <Text style={styles.emptyText}>{t('Your teachers will schedule appointments here.')}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.aboutTitle}>{t('About SuperStudy')}</Text>
        <Text style={styles.aboutText}>
          {t(
            'SuperStudy brings everything you need for school into one place. From this dashboard you can move between tools and get support from real teachers.'
          )}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionPrimary]}
          onPress={() => navigation.navigate('MyTeachers')}
        >
          <Text style={styles.actionBtnText}>{t('View My Teachers')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionSecondary]}
          onPress={() => navigation.navigate('FindTeachers')}
        >
          <Text style={styles.actionBtnText}>{t('Find a Private Teacher')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, color: colors.white, marginBottom: 8, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: 24 },
  loader: { marginVertical: 32 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 18, color: colors.white, marginBottom: 16, fontWeight: '600' },
  aptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  aptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aptTeacher: { fontWeight: '600', color: colors.white },
  badge: { backgroundColor: colors.successBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 11, color: colors.successLight, fontWeight: '600' },
  aptDate: { color: colors.primaryLight, fontSize: 14, marginTop: 4 },
  aptNotes: { color: colors.textMuted, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  aptInfo: { flex: 1 },
  calBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    backgroundColor: colors.primaryBg,
  },
  calBtnText: { color: colors.primaryLight, fontWeight: '600', fontSize: 12 },
  more: { color: colors.textDim, fontSize: 13, marginTop: 12 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { fontSize: 18, color: colors.white, marginBottom: 8 },
  emptyText: { color: colors.textDim, fontSize: 14 },
  aboutTitle: { fontSize: 14, color: colors.primaryLight, marginBottom: 8, fontWeight: '600' },
  aboutText: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  actions: { gap: 12 },
  actionBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  actionPrimary: { backgroundColor: colors.success },
  actionSecondary: { backgroundColor: '#4f46e5' },
  actionBtnText: { color: colors.white, fontWeight: '700' },
});
