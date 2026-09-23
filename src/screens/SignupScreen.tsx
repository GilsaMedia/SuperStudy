import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { sendVerificationEmail } from '../auth';
import CitySelector from '../components/CitySelector';
import { SUBJECTS } from '../constants/subjects';
import { colors } from '../theme';
import { tr, useLanguage } from '../context/Language';

const POINTS = ['3', '4', '5'];

function mapAuthError(err: any): string {
  switch (err?.code) {
    case 'auth/email-already-in-use':
      return tr('This email is already in use.');
    case 'auth/invalid-email':
      return tr('Invalid email address.');
    case 'auth/weak-password':
      return tr('Password is too weak.');
    default:
      return err?.message
        ? tr('Signup failed: {message}', { message: err.message })
        : tr('Unable to sign up. Please try again.');
  }
}

function validatePhone(phone: string): { isValid: boolean; error: string | null } {
  if (!phone?.trim()) return { isValid: false, error: tr('Phone number is required.') };
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) {
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned))
      return { isValid: false, error: tr('Invalid international format (e.g. +1234567890).') };
  } else {
    if (!/^\d{10,15}$/.test(cleaned))
      return { isValid: false, error: tr('Use international + or 10–15 digits.') };
  }
  return { isValid: true, error: null };
}

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [teacherPoints, setTeacherPoints] = useState('5');
  const [teacherLocation, setTeacherLocation] = useState('');
  const [teacherExperience, setTeacherExperience] = useState('');
  const [teacherPrice, setTeacherPrice] = useState('');
  const [teacherAvailability, setTeacherAvailability] = useState('');
  const [teacherBio, setTeacherBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjectsModalVisible, setSubjectsModalVisible] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (!selectedRole) {
      setError(t('Please select Teacher or Student.'));
      return;
    }
    if (!email || !password || !fullName) {
      setError(t('Please enter full name, email and password.'));
      return;
    }
    const pv = validatePhone(phone);
    if (!pv.isValid) {
      setPhoneError(pv.error);
      setError(pv.error || t('Invalid phone'));
      return;
    }
    if (selectedRole === 'teacher') {
      if (teacherSubjects.length === 0) {
        setError(t('Please select at least one subject.'));
        return;
      }
      if (!teacherLocation?.trim()) {
        setError(t('Please provide your teaching location (city).'));
        return;
      }
    }
    if (password !== confirm) {
      setError(t('Passwords do not match.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(cred.user, { displayName: fullName });
      } catch {}
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        fullName,
        role: selectedRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: cred.user.emailVerified,
        providerId: 'password',
        phone: phone || null,
        subjects: selectedRole === 'teacher' ? teacherSubjects : null,
        points: selectedRole === 'teacher' ? teacherPoints : null,
        location: selectedRole === 'teacher' ? teacherLocation : null,
        experience: selectedRole === 'teacher' ? teacherExperience.trim() || null : null,
        pricePerHour: selectedRole === 'teacher' ? teacherPrice.trim() || null : null,
        availability: selectedRole === 'teacher' ? teacherAvailability.trim() || null : null,
        bio: selectedRole === 'teacher' ? teacherBio.trim() || null : null,
        profile: { photoURL: cred.user.photoURL || null },
        metadata: {
          creationTime: cred.user.metadata?.creationTime || null,
          lastSignInTime: cred.user.metadata?.lastSignInTime || null,
        },
        app: { onboardingComplete: false, theme: 'dark' },
      }, { merge: true });
      try {
        await sendVerificationEmail(cred.user);
      } catch {
        // Account exists; the verify screen can resend the email.
      }
      navigation.replace('VerifyEmail');
    } catch (e: any) {
      setError(mapAuthError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('Sign up')}</Text>

        <Text style={styles.label}>{t('Who are you?')}</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, selectedRole === 'student' && styles.roleBtnActive]}
            onPress={() => setSelectedRole('student')}
          >
            <Text style={styles.roleBtnText}>🎓 {t('Student')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, selectedRole === 'teacher' && styles.roleBtnActive]}
            onPress={() => setSelectedRole('teacher')}
          >
            <Text style={styles.roleBtnText}>👩‍🏫 {t('Teacher')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('Full name')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('Your full name')}
          placeholderTextColor={colors.textDim}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>{t('Email')}</Text>
        <TextInput
          style={styles.input}
          placeholder="name@example.com"
          placeholderTextColor={colors.textDim}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>{t('Password')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('Create a strong password')}
          placeholderTextColor={colors.textDim}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>{t('Confirm Password')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('Repeat your password')}
          placeholderTextColor={colors.textDim}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <Text style={styles.label}>{t('Phone *')}</Text>
        <TextInput
          style={[styles.input, phoneError && styles.inputError]}
          placeholder="+1234567890"
          placeholderTextColor={colors.textDim}
          value={phone}
          onChangeText={(text) => { setPhone(text); setPhoneError(null); }}
          keyboardType="phone-pad"
        />
        {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}

        {selectedRole === 'teacher' && (
          <>
            <Text style={styles.label}>{t('Subjects')}</Text>
            <TouchableOpacity
              style={styles.subjectSelector}
              onPress={() => setSubjectsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.subjectSelectorText}>
                {teacherSubjects.length
                  ? teacherSubjects.map((s) => t(s)).join(', ')
                  : t('Select subjects (you can choose multiple)')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.label}>{t('Units')}</Text>
            <View style={styles.pickerRow}>
              {POINTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, teacherPoints === p && styles.chipActive]}
                  onPress={() => setTeacherPoints(p)}
                >
                  <Text style={styles.chipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>{t('Location (city) *')}</Text>
            <CitySelector value={teacherLocation} onChange={setTeacherLocation} placeholder={t('Select a city')} />
            <Text style={styles.label}>{t('Experience (years)')}</Text>
            <TextInput
              style={styles.input}
              value={teacherExperience}
              onChangeText={setTeacherExperience}
              placeholder={t('e.g. 5')}
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
            />
            <Text style={styles.label}>{t('Price per hour (₪)')}</Text>
            <TextInput
              style={styles.input}
              value={teacherPrice}
              onChangeText={setTeacherPrice}
              placeholder={t('e.g. 120')}
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
            />
            <Text style={styles.label}>{t('Availability')}</Text>
            <TextInput
              style={styles.input}
              value={teacherAvailability}
              onChangeText={setTeacherAvailability}
              placeholder={t('e.g. Sun–Thu, afternoons')}
              placeholderTextColor={colors.textDim}
            />
            <Text style={styles.label}>{t('About me')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={teacherBio}
              onChangeText={setTeacherBio}
              placeholder={t('A short description students will see')}
              placeholderTextColor={colors.textDim}
              multiline
            />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {selectedRole === 'teacher' && (
          <Modal
            visible={subjectsModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setSubjectsModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{t('Select subjects')}</Text>
                <ScrollView style={styles.modalList}>
                  {SUBJECTS.map((s) => {
                    const checked = teacherSubjects.includes(s);
                    return (
                      <TouchableOpacity
                        key={s}
                        style={styles.checkboxRow}
                        onPress={() => {
                          setTeacherSubjects((prev) =>
                            checked ? prev.filter((x) => x !== s) : [...prev, s]
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                        </View>
                        <Text style={styles.checkboxLabel}>{t(s)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={() => setSubjectsModalVisible(false)}
                  >
                    <Text style={styles.modalButtonText}>{t('Done')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        <TouchableOpacity
          style={[styles.btn, isSubmitting && styles.btnDisabled]}
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('Sign up with Email')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>{t('Already have an account? Sign in')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, color: colors.white, marginBottom: 24, fontWeight: '700' },
  label: { color: colors.textMuted, marginBottom: 8, marginTop: 12, fontWeight: '600' },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(2,6,23,0.6)',
    color: colors.text,
    fontSize: 16,
    marginBottom: 8,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.dangerLight, marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  roleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  roleBtnActive: { borderColor: colors.primaryLight, backgroundColor: '#4f46e5' },
  roleBtnText: { color: colors.text, fontWeight: '600' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  subjectSelector: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(15,23,42,0.9)',
    marginBottom: 8,
  },
  subjectSelectorText: { color: colors.text, fontSize: 16 },
  checkboxList: { marginBottom: 12 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
  },
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
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText: { color: colors.text, fontSize: 14 },
  btn: {
    backgroundColor: '#374151',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.primaryLight },
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
