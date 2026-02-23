import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { FirebaseAuthProvider } from './src/context/FirebaseAuth';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <FirebaseAuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </FirebaseAuthProvider>
  );
}
