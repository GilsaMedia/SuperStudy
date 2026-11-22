import { initializeApp, getApps } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig as any)?.extra ?? {};
const firebaseConfig = {
  apiKey: extra.firebaseApiKey ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: extra.firebaseAuthDomain ?? process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: extra.firebaseProjectId ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: extra.firebaseStorageBucket ?? process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.firebaseMessagingSenderId ?? process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.firebaseAppId ?? process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const firebaseApp = app;
/**
 * On native, getAuth() keeps the session in memory only, so users were logged out on
 * every app restart. initializeAuth with AsyncStorage persistence keeps them signed in.
 * getReactNativePersistence only exists in Firebase's React Native build (not in the typings).
 */
function createAuth(): FirebaseAuth.Auth {
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(app);
  const getReactNativePersistence = (FirebaseAuth as any).getReactNativePersistence;
  try {
    return FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Already initialized (e.g. after a fast refresh).
    return FirebaseAuth.getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
