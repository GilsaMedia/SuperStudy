import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { useLanguage } from '../context/Language';
import { needsEmailVerification } from '../auth';
import { colors } from '../theme';

export default function HomeScreen() {
  const { user, profile, loading, profileLoading } = useFirebaseAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  useEffect(() => {
    // Only the visible Home routes; a Home left under Login/Signup must not also navigate.
    if (!isFocused || loading || profileLoading || !user) return;
    // reset (not replace) so no stale Home/Login/VerifyEmail stays under the tabs.
    const go = (name: string) => navigation.reset({ index: 0, routes: [{ name }] });
    if (needsEmailVerification(user)) go('VerifyEmail');
    else if (profile?.role === 'student') go('StudentTabs');
    else if (profile?.role === 'teacher') go('TeacherTabs');
    // Signed in but no Firestore role: the "Role Required" view below handles it.
  }, [isFocused, profile, loading, profileLoading, user, navigation]);

  if (loading || (user && profileLoading) || needsEmailVerification(user)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('Loading your profile...')}</Text>
      </View>
    );
  }

  if (user && !profile?.role) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('Role Required')}</Text>
        <Text style={styles.subtitle}>
          {t('Your account needs to be set up as a student or a teacher. Please contact support or sign up again with the correct role.')}
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnText}>{t('Switch account')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = user?.displayName || user?.email || undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>SuperStudy</Text>
      {user ? (
        <>
          <Text style={styles.title}>
            {displayName ? t('Hello {name}', { name: displayName }) : t('Hello')}
          </Text>
          <Text style={styles.subtitle}>{t('More personalized content is coming soon.')}</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('Welcome to SuperStudy')}</Text>
          <Text style={styles.subtitle}>{t('Your hub to study smarter and track your progress.')}</Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.btnText}>{t('Log in')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('Signup')}
          >
            <Text style={styles.btnTextSecondary}>{t('Create account')}</Text>
          </TouchableOpacity>
        </>
      )}
      <Text style={styles.footer}>{t('By continuing you agree to our Terms and Privacy Policy.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  brand: { fontSize: 28, fontWeight: '700', color: colors.white, marginBottom: 24 },
  title: { fontSize: 24, color: colors.white, marginBottom: 12, textAlign: 'center' },
  subtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 320,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  btnTextSecondary: { color: colors.primaryLight, fontWeight: '600', fontSize: 16 },
  footer: { position: 'absolute', bottom: 32, color: colors.textDim, fontSize: 12 },
});
