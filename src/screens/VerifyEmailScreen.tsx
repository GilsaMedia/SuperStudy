import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { reload } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logOut, sendVerificationEmail } from '../auth';
import { colors } from '../theme';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { tr, useLanguage } from '../context/Language';

const RESEND_COOLDOWN_MS = 60_000;

function mapSendError(code?: string): string {
  switch (code) {
    case 'auth/too-many-requests':
      return tr('Too many emails sent. Wait a few minutes and try again.');
    case 'auth/user-token-expired':
    case 'auth/requires-recent-login':
      return tr('Your session expired. Sign out and sign in again to resend.');
    default:
      return tr('Could not send the verification email. Try again.');
  }
}

export default function VerifyEmailScreen() {
  const navigation = useNavigation<any>();
  const { refreshProfile } = useFirebaseAuth();
  const { t } = useLanguage();
  const user = auth.currentUser;
  const email = user?.email ?? t('your email');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    t("Open the verification link we sent to {email}. If it isn't there, check spam or resend it.", { email })
  );
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    const current = auth.currentUser;
    if (!current) {
      navigation.replace('Login');
      return;
    }
    if (Date.now() < cooldownUntil) {
      const seconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setError(t('You can resend in {seconds}s.', { seconds }));
      return;
    }
    setSending(true);
    try {
      await sendVerificationEmail(current);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      setNotice(t('Verification email sent to {email}.', { email: current.email ?? email }));
    } catch (e: any) {
      setError(mapSendError(e?.code));
    } finally {
      setSending(false);
    }
  };

  const handleCheck = async () => {
    setError(null);
    const current = auth.currentUser;
    if (!current) {
      navigation.replace('Login');
      return;
    }
    setChecking(true);
    try {
      await reload(current);
      const refreshed = auth.currentUser;
      if (!refreshed?.emailVerified) {
        setNotice(null);
        setError(t('Not verified yet. Open the link in your email, then try again.'));
        return;
      }
      try {
        await updateDoc(doc(db, 'users', refreshed.uid), {
          emailVerified: true,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Profile write is best-effort; Auth is the source of truth.
      }
      // The profile may have been read before signup finished writing it; load it again.
      await refreshProfile();
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch {
      setError(t('Could not refresh your account. Check your connection and try again.'));
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await logOut();
    navigation.replace('Login');
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('Verify your email')}</Text>
      <Text style={styles.subtitle}>
        {t(
          'Confirm {email} before using SuperStudy. Check your inbox and spam folder for a message from Firebase.',
          { email }
        )}
      </Text>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, checking && styles.btnDisabled]}
        onPress={handleCheck}
        disabled={checking || sending}
      >
        {checking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>{t("I've verified my email")}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnSecondary, (sending || checking) && styles.btnDisabled]}
        onPress={handleResend}
        disabled={sending || checking}
      >
        {sending ? (
          <ActivityIndicator color={colors.primaryLight} />
        ) : (
          <Text style={styles.btnSecondaryText}>{t('Resend verification email')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={handleSignOut}>
        <Text style={styles.linkText}>{t('Sign out')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: 24,
    paddingTop: 48,
  },
  title: { fontSize: 28, color: colors.white, marginBottom: 12, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginBottom: 24, lineHeight: 22 },
  notice: { color: colors.successLight, marginBottom: 16, lineHeight: 22 },
  error: { color: colors.dangerLight, marginBottom: 16, lineHeight: 22 },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  btnSecondaryText: { color: colors.primaryLight, fontWeight: '600', fontSize: 16 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.textDim },
});
