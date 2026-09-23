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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sendPasswordReset } from '../auth';
import { colors } from '../theme';
import { tr, useLanguage } from '../context/Language';

function mapResetError(code?: string): string | null {
  switch (code) {
    case 'auth/invalid-email':
      return tr('Invalid email address.');
    case 'auth/missing-email':
      return tr('Please enter your email.');
    case 'auth/too-many-requests':
      return tr('Too many attempts. Try again later.');
    // Enumeration protection: don't reveal whether the account exists.
    case 'auth/user-not-found':
      return null;
    default:
      return tr('Unable to send a reset email. Please try again.');
  }
}

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('Please enter your email.'));
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordReset(trimmed);
      setSentTo(trimmed);
    } catch (e: any) {
      const message = mapResetError(e?.code);
      if (message) setError(message);
      else setSentTo(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('Forgot password')}</Text>
        <Text style={styles.subtitle}>
          {t("Enter the email on your account. We'll send a link to choose a new password.")}
        </Text>

        {sentTo ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>{t('Check your inbox')}</Text>
            <Text style={styles.successBody}>
              {t(
                'If an account exists for {email}, a password reset link is on its way. Open it to set a new password, then come back and sign in.',
                { email: sentTo }
              )}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>{t('Email')}</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor={colors.textDim}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.btn, isSubmitting && styles.btnDisabled]}
              onPress={handleReset}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t('Send reset link')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>{t('Back to sign in')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 48 },
  title: { fontSize: 28, color: colors.white, marginBottom: 12, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: 24, lineHeight: 22 },
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
  error: { color: colors.dangerLight, marginBottom: 16 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.primaryLight },
  successBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successBg,
    padding: 16,
  },
  successTitle: { color: colors.successLight, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  successBody: { color: colors.text, lineHeight: 22 },
});
