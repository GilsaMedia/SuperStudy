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
import { useNavigation } from '@react-navigation/native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { needsEmailVerification } from '../auth';
import { colors } from '../theme';
import { tr, useLanguage } from '../context/Language';

function mapAuthError(code?: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return tr('Invalid email address.');
    case 'auth/user-disabled':
      return tr('This account has been disabled.');
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return tr('Incorrect email or password.');
    case 'auth/wrong-password':
      return tr('Incorrect password.');
    case 'auth/too-many-requests':
      return tr('Too many attempts. Try again later.');
    default:
      return tr('Unable to sign in. Please try again.');
  }
}

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });

  const handleEmailLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError(t('Please enter email and password.'));
      return;
    }
    setIsSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (needsEmailVerification(cred.user)) {
        navigation.replace('VerifyEmail');
        return;
      }
      goHome();
    } catch (e: any) {
      setError(mapAuthError(e?.code));
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
        <Text style={styles.title}>{t('Sign in')}</Text>

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
        />

        <Text style={styles.label}>{t('Password')}</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textDim}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.forgot}
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
        >
          <Text style={styles.forgotText}>{t('Forgot password?')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, isSubmitting && styles.btnDisabled]}
          onPress={handleEmailLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t('Sign in with Email')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.linkText}>{t("Don't have an account? Sign up")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 48 },
  title: { fontSize: 28, color: colors.white, marginBottom: 24, fontWeight: '700' },
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
  error: { color: colors.dangerLight, marginBottom: 8 },
  forgot: { alignSelf: 'flex-end', marginBottom: 8 },
  forgotText: { color: colors.primaryLight, fontWeight: '600' },
  btn: {
    backgroundColor: '#374151',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.primaryLight },
});
