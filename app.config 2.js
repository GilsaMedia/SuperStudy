// Load .env.local (and .env) so REACT_APP_* and EXPO_PUBLIC_* are available in extra
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const project = require('./app.json');

module.exports = {
  ...project.expo,
  name: project.expo.name || 'SuperStudy',
  slug: project.expo.slug || 'SuperStudy',
  scheme: project.expo.scheme || 'superstudy',
  plugins: ['expo-web-browser'],
  extra: {
    // Firebase (from REACT_APP_* or EXPO_PUBLIC_*)
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID,
    // Gemini (optional)
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY,
  },
};
