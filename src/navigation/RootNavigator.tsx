import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { useLanguage } from '../context/Language';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import StudyHelperScreen from '../screens/StudyHelperScreen';
import StudentTabs from './StudentTabs';
import TeacherTabs from './TeacherTabs';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: { email?: string } | undefined;
  VerifyEmail: undefined;
  StudyHelper: undefined;
  StudentTabs: undefined;
  TeacherTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#93c5fd" />
      <Text style={styles.loadingText}>{t('Loading…')}</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { loading } = useFirebaseAuth();
  const { t, isRTL } = useLanguage();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={[styles.root, { direction: isRTL ? 'rtl' : 'ltr' }]}>
    <NavigationContainer direction={isRTL ? 'rtl' : 'ltr'}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0b1024' },
          headerTintColor: '#e2e8f0',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0b1024' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: t('SuperStudy') }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: t('Sign in') }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: t('Sign up') }} />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ title: t('Reset password') }}
        />
        <Stack.Screen
          name="VerifyEmail"
          component={VerifyEmailScreen}
          options={{ title: t('Verify email'), headerBackVisible: false }}
        />
        <Stack.Screen
          name="StudyHelper"
          component={StudyHelperScreen}
          options={{ title: t('Study Helper') }}
        />
        <Stack.Screen
          name="StudentTabs"
          component={StudentTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TeacherTabs"
          component={TeacherTabs}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1024' },
  loading: {
    flex: 1,
    backgroundColor: '#0b1024',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
});
