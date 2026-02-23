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
  const navigation = useNavigation<any>();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }
    const calendarRef = collection(db, 'users', profile.uid, 'calendar');
    const q = query(calendarRef, orderBy('dateTime', 'asc'));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const now = new Date();
        const list: CalendarAppointment[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const aptDate = data.dateTime.toDate();
          if (data.status !== 'scheduled' || aptDate < now || !data.teacherId) continue;
          const studentRef = doc(db, 'users', data.teacherId, 'students', profile.uid);
          const studentDoc = await getDoc(studentRef);
          if (!studentDoc.exists()) continue;
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
        setAppointments(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [profile?.uid]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome back, {profile?.fullName || 'Student'} 👋</Text>
      <Text style={styles.subtitle}>
        View your upcoming appointments and manage your learning journey.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : appointments.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Upcoming Appointments</Text>
          {appointments.slice(0, 5).map((apt) => {
            const aptDate = apt.dateTime.toDate();
            const isToday = aptDate.toDateString() === new Date().toDateString();
            return (
              <View key={apt.id} style={styles.aptRow}>
                <View style={styles.aptInfo}>
                  <View style={styles.aptHeader}>
                    <Text style={styles.aptTeacher}>{apt.teacherName || 'Teacher'}</Text>
                    {isToday && <View style={styles.badge}><Text style={styles.badgeText}>Today</Text></View>}
                  </View>
                  <Text style={styles.aptDate}>
                    {aptDate.toLocaleString(undefined, {
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
                      title: `Appointment with ${apt.teacherName || 'Teacher'}`,
                      description: apt.notes || '',
                      startTime: aptDate,
                      endTime: new Date(aptDate.getTime() + 60 * 60 * 1000),
                    })
                  }
                >
                  <Text style={styles.calBtnText}>📅 Add to Calendar</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {appointments.length > 5 && (
            <Text style={styles.more}>+ {appointments.length - 5} more</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>No Upcoming Appointments</Text>
          <Text style={styles.emptyText}>Your teachers will schedule appointments here.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.aboutTitle}>About SuperStudy</Text>
        <Text style={styles.aboutText}>
          SuperStudy brings everything you need for school into one place. From this dashboard you can
          move between tools and get support from real teachers.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionPrimary]}
          onPress={() => navigation.navigate('MyTeachers')}
        >
          <Text style={styles.actionBtnText}>View My Teachers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionSecondary]}
          onPress={() => navigation.navigate('FindTeachers')}
        >
          <Text style={styles.actionBtnText}>Find a Private Teacher</Text>
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
