/**
 * Creates a test teacher account (Firebase Auth + Firestore profile) for manual testing.
 *
 * Usage: node scripts/create-test-teacher.mjs [email] [password] [fullName]
 * Defaults: superstudy.teacher1@yopmail.com / TestTeacher123! / "Dana Levi (Test)"
 *
 * After running, the account still needs email verification: open the inbox
 * (yopmail.com for @yopmail addresses) and click the Firebase link, or use the
 * in-app "Resend verification email" button.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const API_KEY = process.env.REACT_APP_FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const PROJECT = process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

if (!API_KEY || !PROJECT) {
  console.error('Missing Firebase API key or project id in .env.local');
  process.exit(1);
}

const EMAIL = process.argv[2] || 'superstudy.teacher1@yopmail.com';
const PASSWORD = process.argv[3] || 'TestTeacher123!';
const FULL_NAME = process.argv[4] || 'Dana Levi (Test)';

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';

async function idp(path, body) {
  const res = await fetch(`${IDENTITY}/${path}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error?.message || JSON.stringify(json)}`);
  return json;
}

// 1. Create the Auth user.
const signup = await idp('accounts:signUp', {
  email: EMAIL,
  password: PASSWORD,
  returnSecureToken: true,
});
const { localId: uid, idToken } = signup;
console.log(`Auth user created: uid=${uid}`);

// 2. Set display name.
await idp('accounts:update', { idToken, displayName: FULL_NAME, returnSecureToken: true });

// 3. Create the Firestore teacher profile (same shape as SignupScreen writes).
const now = new Date().toISOString();
const s = (v) => ({ stringValue: v });
const fields = {
  uid: s(uid),
  email: s(EMAIL),
  fullName: s(FULL_NAME),
  role: s('teacher'),
  createdAt: { timestampValue: now },
  updatedAt: { timestampValue: now },
  emailVerified: { booleanValue: false },
  providerId: s('password'),
  phone: s('+972501234567'),
  subjects: { arrayValue: { values: [s('Math'), s('Physics'), s('Computer Science')] } },
  points: s('5'),
  location: s('Tel Aviv'),
  experience: s('7'),
  pricePerHour: s('150'),
  availability: s('Sun–Thu, afternoons and evenings'),
  bio: s('Test teacher account. Patient Math & Physics tutor focused on exam prep.'),
  profile: { mapValue: { fields: { photoURL: { nullValue: null } } } },
  app: {
    mapValue: {
      fields: { onboardingComplete: { booleanValue: false }, theme: s('dark') },
    },
  },
};

const fsRes = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`,
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields }),
  }
);
if (!fsRes.ok) throw new Error(`Firestore profile write failed: ${await fsRes.text()}`);
console.log('Firestore teacher profile created.');

// 4. Send the verification email.
await idp('accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken });
console.log(`Verification email sent to ${EMAIL}.`);

console.log('\n--- Test teacher credentials ---');
console.log(`Email:    ${EMAIL}`);
console.log(`Password: ${PASSWORD}`);
console.log(`Name:     ${FULL_NAME}`);
console.log('\nVerify the email (yopmail.com inbox for @yopmail addresses), then sign in.');
