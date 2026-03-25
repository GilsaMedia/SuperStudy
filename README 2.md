# SuperStudy (React Native)

React Native (Expo) port of the SuperStudy web app. Students can find teachers, manage appointments, and use the AI Study Helper. Teachers can manage students and schedule lessons.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Create a `.env` file in the project root (or use `app.config.js` / EAS secrets) with:

   - **Firebase** (required for auth and Firestore):
     - `EXPO_PUBLIC_FIREBASE_API_KEY`
     - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
     - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `EXPO_PUBLIC_FIREBASE_APP_ID`

   - **Study Helper (optional)**:
     - `EXPO_PUBLIC_GEMINI_API_KEY` — for the AI study tutor (get from [Google AI Studio](https://makersuite.google.com/app/apikey)).

   - **Google Sign-In** (development builds only): In **Expo Go**, only email/password sign-in is shown; the Google button is hidden. To use Google Sign-In, run a **development build** (`npx expo run:ios` or `npx expo run:android`). Then in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your **OAuth 2.0 Client ID** (Web application) → **Authorized redirect URIs**, add the exact URI printed in Metro when you open Login (e.g. `superstudy://redirect`).

   Use the same Firebase project as your web app so users and data are shared.

3. **Run**

   ```bash
   npx expo start
   ```

   Then open in iOS Simulator, Android emulator, or Expo Go.

## Features

- **Auth**: Email/password and **Google sign-in** (same Firestore `users` and roles: student/teacher). New Google users get a default student profile.
- **Students**: Dashboard, Find Teachers (filter by subject/location), My Teachers, Study Helper (Gemini-powered hints).
- **Teachers**: Dashboard, Students (add by email/phone, schedule appointments, remove), Profile (edit subject, location, rules).
- **Shared**: Star ratings, city selector (Nominatim/Israel), Google Calendar links via `expo-linking`, clipboard for contact info.

## Project structure

- `App.tsx` — Root with `FirebaseAuthProvider` and `RootNavigator`.
- `src/context/FirebaseAuth.tsx` — Auth state and profile (with AsyncStorage cache).
- `src/navigation/` — Stack (Home, Login, Signup, StudyHelper) and tab navigators (Student vs Teacher).
- `src/screens/` — Home, Login, Signup, Study Helper, student screens, teacher screens.
- `src/components/` — StarRating, CitySelector.
- `src/utils/` — googleCalendar (linking), firebase, auth.
