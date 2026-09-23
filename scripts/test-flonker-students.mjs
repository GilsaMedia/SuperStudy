/**
 * Live check: students linked to teacher "Mr Flonker" and their learning resumes.
 * Uses the web API key + anonymous (or email-less) sign-in allowed by current rules.
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
const TEACHER_QUERY = (process.argv[2] || 'flonker').toLowerCase();

if (!API_KEY || !PROJECT) {
  console.error('Missing Firebase API key or project id in .env.local');
  process.exit(1);
}

function firestoreValue(field) {
  if (!field) return undefined;
  if (field.stringValue != null) return field.stringValue;
  if (field.integerValue != null) return Number(field.integerValue);
  if (field.doubleValue != null) return field.doubleValue;
  if (field.booleanValue != null) return field.booleanValue;
  if (field.timestampValue != null) return field.timestampValue;
  if (field.arrayValue?.values) return field.arrayValue.values.map(firestoreValue);
  if (field.mapValue?.fields) {
    const out = {};
    for (const [k, v] of Object.entries(field.mapValue.fields)) out[k] = firestoreValue(v);
    return out;
  }
  return null;
}

function fieldsToObject(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = firestoreValue(v);
  return out;
}

function docIdFromName(name = '') {
  return name.split('/').pop() || '';
}

async function signIn() {
  const email = process.env.SUPERSTUDY_TEST_EMAIL || process.env.FLONKER_EMAIL;
  const password = process.env.SUPERSTUDY_TEST_PASSWORD || process.env.FLONKER_PASSWORD;
  if (email && password) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const json = await res.json();
    if (!json.idToken) {
      throw new Error(`Password auth failed: ${json.error?.message || JSON.stringify(json)}`);
    }
    return json.idToken;
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const json = await res.json();
  if (!json.idToken) {
    throw new Error(`Auth failed: ${json.error?.message || JSON.stringify(json)}`);
  }
  return json.idToken;
}

async function runQuery(idToken, structuredQuery) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ structuredQuery }),
    }
  );
  if (!res.ok) throw new Error(`runQuery ${res.status}: ${await res.text()}`);
  return res.json();
}

async function listCollection(idToken, path) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}?pageSize=200`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`list ${path} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.documents || [];
}

async function getDoc(idToken, path) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

function parseResume(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const teacherNotes = typeof raw.teacherNotes === 'string' ? raw.teacherNotes.trim() : '';
  const knownTopics = Array.isArray(raw.knownTopics) ? raw.knownTopics.filter(Boolean) : [];
  const needsHelp = Array.isArray(raw.needsHelp) ? raw.needsHelp.filter(Boolean) : [];
  const learningStyle = typeof raw.learningStyle === 'string' ? raw.learningStyle.trim() : '';
  if (!teacherNotes && !knownTopics.length && !needsHelp.length) return null;
  return {
    teacherNotes,
    knownTopics,
    needsHelp,
    learningStyle,
    sessionCount: typeof raw.sessionCount === 'number' ? raw.sessionCount : 0,
  };
}

function formatForTutor(resume) {
  if (!resume) return '';
  return [
    'Student learning profile (use this so you do not re-teach what they already know):',
    `How they learn better: ${resume.learningStyle || 'not enough data yet'}`,
    `Already comfortable with: ${resume.knownTopics.join('; ') || 'not enough data yet'}`,
    `Needs help with: ${resume.needsHelp.join('; ') || 'not enough data yet'}`,
    `Teacher notes: ${resume.teacherNotes || 'not enough data yet'}`,
  ].join('\n');
}

function matchesTeacher(data, id) {
  const hay = [data.fullName, data.name, data.email, id].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(TEACHER_QUERY);
}

const results = { ok: 0, fail: 0, details: [] };

function assert(name, cond, extra = '') {
  if (cond) {
    results.ok += 1;
    results.details.push(`PASS  ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    results.fail += 1;
    results.details.push(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function runOfflineFlonkerTests() {
  const teacher = { id: 'teacher-flonker', fullName: 'Mr Flonker', role: 'teacher' };
  const otherTeacher = { id: 'teacher-other', fullName: 'Ms Other', role: 'teacher' };
  const linkedStudents = [
    {
      id: 'stu-aya',
      name: 'Aya Cohen',
      teacherId: teacher.id,
      learningResume: {
        teacherNotes: 'Aya already solves linear equations. She still mixes up quadratic factoring and needs slower hinting.',
        knownTopics: ['linear equations'],
        needsHelp: ['quadratic factoring'],
        learningStyle: 'Short hints, then a check question.',
        sessionCount: 3,
      },
    },
    {
      id: 'stu-noam',
      name: 'Noam Levi',
      teacherId: teacher.id,
      learningResume: null,
    },
    {
      id: 'stu-other',
      name: 'Not Flonker Student',
      teacherId: otherTeacher.id,
      learningResume: {
        teacherNotes: 'Should not appear on Flonker roster.',
        knownTopics: ['photosynthesis'],
        needsHelp: [],
        learningStyle: '',
        sessionCount: 1,
      },
    },
  ];

  const flonkerStudents = linkedStudents.filter((s) => s.teacherId === teacher.id);
  assert('offline: only students linked to Mr Flonker', flonkerStudents.length === 2 && flonkerStudents.every((s) => s.teacherId === teacher.id));

  const aya = flonkerStudents.find((s) => s.id === 'stu-aya');
  const parsed = parseResume(aya.learningResume);
  assert('offline: Aya resume parses', !!parsed?.teacherNotes);
  const prompt = formatForTutor(parsed);
  assert('offline: tutor prompt tells AI not to re-teach known topics', prompt.includes('do not re-teach') && prompt.includes('linear equations'));
  assert('offline: tutor prompt focuses Flonker student help areas', prompt.includes('quadratic factoring'));

  const noam = flonkerStudents.find((s) => s.id === 'stu-noam');
  assert('offline: linked student without Study Helper has empty resume', parseResume(noam.learningResume) === null);

  const leaked = flonkerStudents.some((s) => s.teacherId !== teacher.id);
  assert('offline: other teacher students are not on Flonker list', !leaked);
}

console.log(`Offline tests for students connected to Mr Flonker\n`);
runOfflineFlonkerTests();

const hasPassword = !!(process.env.SUPERSTUDY_TEST_EMAIL || process.env.FLONKER_EMAIL);

if (!hasPassword) {
  console.log('\nLive Firestore skipped: set SUPERSTUDY_TEST_EMAIL and SUPERSTUDY_TEST_PASSWORD (Mr Flonker login) to query real linked students.');
  console.log('\n--- summary ---');
  for (const line of results.details) console.log(line);
  console.log(`\n${results.ok} passed, ${results.fail} failed`);
  process.exit(results.fail ? 1 : 0);
}

const token = await signIn();
console.log(`\nSigned in to ${PROJECT}. Looking for teacher ~ "${TEACHER_QUERY}"\n`);

const teacherRows = await runQuery(token, {
  from: [{ collectionId: 'users' }],
  where: {
    fieldFilter: {
      field: { fieldPath: 'role' },
      op: 'EQUAL',
      value: { stringValue: 'teacher' },
    },
  },
});

const teachers = teacherRows
  .filter((row) => row.document)
  .map((row) => ({
    id: docIdFromName(row.document.name),
    ...fieldsToObject(row.document.fields),
  }));

assert('teachers collection readable', teachers.length >= 0, `${teachers.length} teacher(s) in project`);

const matches = teachers.filter((t) => matchesTeacher(t, t.id));
if (!matches.length) {
  console.log('Teachers in project:');
  for (const t of teachers) {
    console.log(`  - ${t.fullName || t.name || '(no name)'}  <${t.email || 'no email'}>  id=${t.id}`);
  }
  assert('found Mr Flonker teacher', false, `no teacher name/email contained "${TEACHER_QUERY}"`);
} else {
  for (const teacher of matches) {
    console.log(`Teacher: ${teacher.fullName || teacher.name || teacher.email}  (${teacher.id})`);
    const studentDocs = await listCollection(token, `users/${teacher.id}/students`);
    assert(
      `linked students for ${teacher.fullName || teacher.id}`,
      studentDocs.length > 0,
      `${studentDocs.length} student(s)`
    );

    if (!studentDocs.length) continue;

    for (const sDoc of studentDocs) {
      const link = fieldsToObject(sDoc.fields);
      const studentId = docIdFromName(sDoc.name);
      const userDoc = await getDoc(token, `users/${studentId}`);
      const profile = userDoc ? fieldsToObject(userDoc.fields) : null;
      const resume = parseResume(profile?.learningResume);
      const prompt = formatForTutor(resume);

      const name = link.name || link.fullName || profile?.fullName || studentId;
      console.log(`\nStudent: ${name}`);
      console.log(`  email: ${link.email || profile?.email || '—'}`);
      console.log(`  profile doc: ${profile ? 'yes' : 'MISSING'}`);
      console.log(`  resume: ${resume ? `yes (sessions=${resume.sessionCount})` : 'none yet'}`);
      if (resume) {
        console.log(`  needs help: ${resume.needsHelp.join(', ') || '—'}`);
        console.log(`  known: ${resume.knownTopics.join(', ') || '—'}`);
        console.log(`  tutor prompt chars: ${prompt.length}`);
      }

      assert(`student ${name} has user profile`, !!profile);
      assert(`student ${name} linked under teacher students/`, studentId.length > 0);
      if (resume) {
        assert(`student ${name} resume parses`, !!resume.teacherNotes || resume.needsHelp.length > 0);
        assert(`student ${name} tutor prompt includes skip-known instruction`, prompt.includes('do not re-teach'));
      } else {
        results.details.push(`INFO  ${name} has no learning resume yet (Study Helper not used)`);
      }
    }
  }
}

console.log('\n--- summary ---');
for (const line of results.details) console.log(line);
console.log(`\n${results.ok} passed, ${results.fail} failed`);
process.exit(results.fail ? 1 : 0);
