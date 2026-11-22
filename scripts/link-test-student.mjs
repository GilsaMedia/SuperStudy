/**
 * Links a student to a teacher and runs a short Study Helper (Claude) session
 * so a learning resume is generated — mirrors the app's exact flows.
 *
 * Usage:
 *   SUPERSTUDY_STUDENT_EMAIL=... SUPERSTUDY_STUDENT_PASSWORD=... \
 *   node scripts/link-test-student.mjs [teacherUid]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

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
const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || process.env.REACT_APP_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.EXPO_PUBLIC_CLAUDE_MODEL || 'claude-opus-5-5';

const STUDENT_EMAIL = process.env.SUPERSTUDY_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.SUPERSTUDY_STUDENT_PASSWORD;
const TEACHER_UID = process.argv[2] || 'r0xwUUhH11NjmE8lJC8lSp49XL83'; // Dana Levi (Test)

if (!API_KEY || !PROJECT || !ANTHROPIC_KEY || !STUDENT_EMAIL || !STUDENT_PASSWORD) {
  console.error(
    'Missing Firebase API key, project id, EXPO_PUBLIC_ANTHROPIC_API_KEY, or SUPERSTUDY_STUDENT_EMAIL / SUPERSTUDY_STUDENT_PASSWORD.'
  );
  process.exit(1);
}

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function fsValue(field) {
  if (!field) return undefined;
  if (field.stringValue != null) return field.stringValue;
  if (field.integerValue != null) return Number(field.integerValue);
  if (field.booleanValue != null) return field.booleanValue;
  if (field.arrayValue?.values) return field.arrayValue.values.map(fsValue);
  if (field.mapValue?.fields) {
    const out = {};
    for (const [k, v] of Object.entries(field.mapValue.fields)) out[k] = fsValue(v);
    return out;
  }
  return null;
}

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const json = await res.json();
  if (!json.idToken) throw new Error(`Sign-in failed for ${email}: ${json.error?.message}`);
  return json;
}

async function getDoc(token, path) {
  const res = await fetch(`${FS}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchDoc(token, path, fields, { updateMask, mustExist = false } = {}) {
  const params = new URLSearchParams();
  if (mustExist) params.set('currentDocument.exists', 'true');
  for (const f of updateMask || []) params.append('updateMask.fieldPaths', f);
  const query = params.toString();
  const res = await fetch(`${FS}/${path}${query ? `?${query}` : ''}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`patch ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

/** Same request shape as src/utils/claude.ts askClaude(). */
async function claude(params) {
  const response = await anthropic.beta.messages.create({
    ...params,
    model: CLAUDE_MODEL,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined the request');
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error(`No content from Claude (stop_reason=${response.stop_reason})`);
  return text;
}

// ---------------------------------------------------------------------------
// 1. Sign in as the student.
const student = await signIn(STUDENT_EMAIL, STUDENT_PASSWORD);
const studentUid = student.localId;
console.log(`Student signed in: uid=${studentUid}`);

const studentDoc = await getDoc(student.idToken, `users/${studentUid}`);
const sp = studentDoc ? Object.fromEntries(Object.entries(studentDoc.fields || {}).map(([k, v]) => [k, fsValue(v)])) : {};
const studentName = sp.fullName || student.displayName || STUDENT_EMAIL;

const teacherDoc = await getDoc(student.idToken, `users/${TEACHER_UID}`);
if (!teacherDoc) throw new Error(`Teacher ${TEACHER_UID} not found`);
const teacherName = fsValue(teacherDoc.fields.fullName);
console.log(`Linking "${studentName}" to teacher "${teacherName}"…`);

// 2. Create the teacher→student link (same shape TeacherStudentsScreen writes).
const now = new Date().toISOString();
const s = (v) => (v == null ? { nullValue: null } : { stringValue: String(v) });
await patchDoc(student.idToken, `users/${TEACHER_UID}/students/${studentUid}`, {
  teacherId: s(TEACHER_UID),
  userId: s(studentUid),
  name: s(studentName),
  email: s(sp.email || STUDENT_EMAIL),
  phone: sp.phone ? s(sp.phone) : { nullValue: null },
  createdAt: { timestampValue: now },
  updatedAt: { timestampValue: now },
});
console.log('Link created: users/%s/students/%s', TEACHER_UID, studentUid);

// 3. Short Study Helper session (same system prompt + model as the app).
const systemPrompt = `You are an expert tutor. Your role is to guide students to discover solutions themselves through hints and questions.
NEVER give the complete answer. Only give hints, clues, and guiding questions. Ask Socratic questions.
Keep responses under 200 words. End with a question to guide their next step.
If the student already knows a topic, do not restart from the basics — skip ahead or briefly confirm, then focus on where they need help.`;

const studentTurns = [
  "Hi, I have a physics test next week on Newton's laws. I get the first law but I always mess up force diagram questions with friction.",
  "OK so if a box is being pushed and it moves at constant speed, I think the pushing force is bigger than friction? That's why it keeps moving?",
  'Oh wait, constant speed means acceleration is zero, so the forces must be balanced. So friction equals the push force. I always thought moving means net force.',
];

const messages = [];
console.log('\n--- Study Helper demo session ---');
for (const turn of studentTurns) {
  messages.push({ role: 'user', content: turn });
  console.log(`\nStudent: ${turn}`);
  const reply = await claude({
    max_tokens: 8000,
    output_config: { effort: 'low' },
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  messages.push({ role: 'assistant', content: reply });
  console.log(`\nTutor: ${reply}`);
}

// 4. Build the learning resume from the chat (same prompt as updateLearningResumeFromChat).
const transcript = messages
  .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.trim()}`)
  .join('\n');

const resumePrompt = `You maintain a concise learning resume for a student. Teachers use it to teach better. The AI tutor uses it to skip material the student already knows.

Previous resume JSON:
null

Latest Study Helper chat:
${transcript}

Update the resume. Keep facts that are still true. Add or refine based on this chat only. Do not invent subjects that were not discussed. Never include full homework answers.

Return JSON with this shape:
{
  "teacherNotes": "4-7 sentences for the teacher: how this student learns better, what they already understand, and where they need help next.",
  "knownTopics": ["short topic the student already handles"],
  "needsHelp": ["short topic or skill they still struggle with"],
  "learningStyle": "1-2 sentences about what kind of hints or explanations work for them"
}`;

const resumeRaw = await claude({
  max_tokens: 8000,
  output_config: {
    effort: 'low',
    format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          teacherNotes: { type: 'string' },
          knownTopics: { type: 'array', items: { type: 'string' } },
          needsHelp: { type: 'array', items: { type: 'string' } },
          learningStyle: { type: 'string' },
        },
        required: ['teacherNotes', 'knownTopics', 'needsHelp', 'learningStyle'],
        additionalProperties: false,
      },
    },
  },
  messages: [{ role: 'user', content: resumePrompt }],
});
const resume = JSON.parse(resumeRaw);

// 5. Save the resume onto the student profile (merge only these fields).
await patchDoc(
  student.idToken,
  `users/${studentUid}`,
  {
    learningResume: {
      mapValue: {
        fields: {
          teacherNotes: s(resume.teacherNotes),
          knownTopics: { arrayValue: { values: (resume.knownTopics || []).map((t) => s(t)) } },
          needsHelp: { arrayValue: { values: (resume.needsHelp || []).map((t) => s(t)) } },
          learningStyle: s(resume.learningStyle || ''),
          sessionCount: { integerValue: '1' },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      },
    },
    updatedAt: { timestampValue: new Date().toISOString() },
  },
  { updateMask: ['learningResume', 'updatedAt'], mustExist: true }
);

console.log('\n--- Learning resume saved to student profile ---');
console.log(JSON.stringify(resume, null, 2));
console.log('\nDone. Open the teacher account → Students to see the linked student and resume.');
