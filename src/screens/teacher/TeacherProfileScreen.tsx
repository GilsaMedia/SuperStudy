import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirebaseAuth } from '../../context/FirebaseAuth';
import CitySelector from '../../components/CitySelector';
import StarRating from '../../components/StarRating';
import { SUBJECTS } from '../../constants/subjects';
import { colors } from '../../theme';

const POINTS = ['3', '4', '5'];

export default function TeacherProfileScreen() {
  const { user, profile, refreshProfile } = useFirebaseAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [loadingRatings, setLoadingRatings] = useState(true);
  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    subjects: profile?.subjects?.length ? [...profile.subjects] : (profile?.subject ? [profile.subject] : []),
    points: profile?.points || '',
    location: profile?.location || '',
    rules: profile?.rules || '',
  });
  const [subjectsModalVisible, setSubjectsModalVisible] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        subjects: profile.subjects?.length ? [...profile.subjects] : (profile.subject ? [profile.subject] : []),
        points: profile.points || '',
        location: profile.location || '',
        rules: profile.rules || '',
      });
    }
  }, [profile]);

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

  const handleSave = async () => {
    if (!user) return;
    if (formData.subjects.length === 0) {
      setError('Select at least one subject.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: formData.fullName.trim() || null,
        subjects: formData.subjects.length ? formData.subjects : null,
        points: formData.points.trim() || null,
        location: formData.location.trim() || null,
        rules: formData.rules.trim() || null,
      });
      setSuccess(true);
      setIsEditing(false);
      await refreshProfile();
    } catch {
      setError('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      fullName: profile?.fullName || '',
      subjects: profile?.subjects?.length ? [...profile.subjects] : (profile?.subject ? [profile.subject] : []),
      points: profile?.points || '',
      location: profile?.location || '',
      rules: profile?.rules || '',
    });
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  };

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Your Profile</Text>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Profile</Text>
      <Text style={styles.subtitle}>
        {isEditing ? 'Edit your profile. Changes are visible to students.' : 'Review what students see.'}
      </Text>

      {error ? <View style={styles.alertDanger}><Text style={styles.alertText}>{error}</Text></View> : null}
      {success ? <View style={styles.alertSuccess}><Text style={styles.alertText}>Profile updated!</Text></View> : null}

      {!isEditing && (
        <View style={styles.ratingBox}>
          <Text style={styles.ratingLabel}>⭐ Your Rating</Text>
          {loadingRatings ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : ratingCount > 0 ? (
            <>
              <StarRating rating={averageRating} ratingCount={ratingCount} interactive={false} size="large" showCount />
              <Text style={styles.ratingDesc}>
                Average from {ratingCount} {ratingCount === 1 ? 'student' : 'students'}.
              </Text>
            </>
          ) : (
            <Text style={styles.ratingMuted}>No ratings yet. Students can rate after lessons.</Text>
          )}
        </View>
      )}

      {isEditing ? (
        <>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={formData.fullName}
            onChangeText={(t) => setFormData((prev) => ({ ...prev, fullName: t }))}
            placeholder="Full name"
            placeholderTextColor={colors.textDim}
          />
          <Text style={styles.label}>Email (read-only)</Text>
          <Text style={styles.readOnly}>{profile.email || '—'}</Text>
          <Text style={styles.label}>Subjects</Text>
          <TouchableOpacity
            style={styles.subjectSelector}
            onPress={() => setSubjectsModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.subjectSelectorText}>
              {formData.subjects.length
                ? formData.subjects.join(', ')
                : 'Select subjects (you can choose multiple)'}
            </Text>
          </TouchableOpacity>
          <Modal
            visible={subjectsModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setSubjectsModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Select subjects</Text>
                <ScrollView style={styles.modalList}>
                  {SUBJECTS.map((s) => {
                    const checked = formData.subjects.includes(s);
                    return (
                      <TouchableOpacity
                        key={s}
                        style={styles.checkboxRow}
                        onPress={() => {
                          setFormData((prev) => ({
                            ...prev,
                            subjects: checked
                              ? prev.subjects.filter((x) => x !== s)
                              : [...prev.subjects, s],
                          }));
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                        </View>
                        <Text style={styles.checkboxLabel}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={() => setSubjectsModalVisible(false)}
                  >
                    <Text style={styles.modalButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <Text style={styles.label}>Units</Text>
          <View style={styles.chipRow}>
            {POINTS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, formData.points === p && styles.chipActive]}
                onPress={() => setFormData((prev) => ({ ...prev, points: p }))}
              >
                <Text style={styles.chipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Location</Text>
          <CitySelector value={formData.location} onChange={(v) => setFormData((prev) => ({ ...prev, location: v }))} placeholder="Select city" />
          <Text style={styles.label}>Rules</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.rules}
            onChangeText={(t) => setFormData((prev) => ({ ...prev, rules: t }))}
            placeholder="Teaching rules and guidelines..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={6}
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleCancel} disabled={loading}>
              <Text style={styles.btnTextSecondary}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <Text style={styles.fieldValue}>{profile.fullName || 'Not set'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profile.email || 'Not set'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Subjects</Text>
            <Text style={styles.fieldValue}>
              {profile.subjects?.length ? profile.subjects.join(', ') : profile.subject || 'Not set'}
            </Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Units</Text>
            <Text style={styles.fieldValue}>{profile.points || '—'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location</Text>
            <Text style={styles.fieldValue}>{profile.location || 'Not set'}</Text>
          </View>
          {formData.rules ? (
            <View style={styles.rulesBox}>
              <Text style={styles.rulesLabel}>📋 Rules</Text>
              <Text style={styles.rulesText}>{formData.rules}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, color: colors.white, marginBottom: 8, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: 20 },
  alertDanger: { padding: 12, borderRadius: 8, backgroundColor: colors.dangerBg, marginBottom: 16 },
  alertSuccess: { padding: 12, borderRadius: 8, backgroundColor: colors.successBg, marginBottom: 16 },
  alertText: { color: colors.text },
  ratingBox: { marginBottom: 24, padding: 20, borderRadius: 12, backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  ratingLabel: { fontSize: 14, color: colors.textDim, fontWeight: '600', marginBottom: 12 },
  ratingDesc: { marginTop: 12, color: colors.textMuted, fontSize: 14 },
  ratingMuted: { color: colors.textDim },
  label: { color: colors.textMuted, marginBottom: 8, fontWeight: '600' },
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
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  readOnly: { color: colors.textDim, marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  subjectSelector: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(15,23,42,0.9)',
    marginBottom: 16,
  },
  subjectSelectorText: { color: colors.text, fontSize: 16 },
  checkboxList: { marginBottom: 16 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  checkboxCheck: { color: colors.white, fontSize: 14, fontWeight: '700' },
  checkboxLabel: { color: colors.text, fontSize: 16, flex: 1 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText: { color: colors.text, fontSize: 14 },
  row: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { borderWidth: 1, borderColor: colors.borderStrong },
  btnText: { color: colors.white, fontWeight: '700' },
  btnTextSecondary: { color: colors.text },
  field: { marginBottom: 16 },
  fieldLabel: { color: colors.textDim, fontSize: 12, marginBottom: 4 },
  fieldValue: { color: colors.text, fontSize: 16 },
  rulesBox: { marginTop: 16, padding: 16, borderRadius: 8, backgroundColor: 'rgba(148,163,184,0.08)' },
  rulesLabel: { fontSize: 12, color: colors.textDim, fontWeight: '600', marginBottom: 8 },
  rulesText: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  editBtn: { marginTop: 24, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  editBtnText: { color: colors.white, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 12,
  },
  modalList: { maxHeight: 320, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalButtonPrimary: { backgroundColor: colors.primary },
  modalButtonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
});
