import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
