import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import StudyHelperScreen from '../screens/StudyHelperScreen';
import StudentTabs from './StudentTabs';
import TeacherTabs from './TeacherTabs';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  StudyHelper: undefined;
  StudentTabs: undefined;
  TeacherTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#93c5fd" />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { loading } = useFirebaseAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0b1024' },
          headerTintColor: '#e2e8f0',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0b1024' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'SuperStudy' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign up' }} />
        <Stack.Screen
          name="StudyHelper"
          component={StudyHelperScreen}
          options={{ title: 'Study Helper' }}
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
  );
}

const styles = StyleSheet.create({
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
