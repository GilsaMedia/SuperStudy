import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { FirebaseAuthProvider } from './src/context/FirebaseAuth';
import { LanguageProvider } from './src/context/Language';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <LanguageProvider>
      <FirebaseAuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </FirebaseAuthProvider>
    </LanguageProvider>
  );
}
