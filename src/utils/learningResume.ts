import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '../firebase';

/** The AI-written parts of a resume, in one language. */
export type ResumeText = {
  /** Teacher-facing summary: how the student learns and where to focus */
  teacherNotes: string;
  /** Topics the student already handles — AI should not linger here */
  knownTopics: string[];
  /** Topics / skills they still struggle with */
  needsHelp: string[];
  /** How they learn better (style that works for them) */
  learningStyle: string;
};

export type LearningResume = ResumeText & {
  sessionCount: number;
  updatedAtMs?: number;
  /** Hebrew version for display. The English fields stay canonical for the AI tutor. */
  he?: ResumeText;
};

type ChatTurn = { role: 'user' | 'assistant'; content: string };

const MAX_NOTES = 1600;
const MAX_LIST = 12;
const MAX_STYLE = 400;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_LIST);
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

export function parseLearningResume(raw: unknown): LearningResume | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const teacherNotes = typeof data.teacherNotes === 'string' ? data.teacherNotes.trim() : '';
  if (!teacherNotes && !asStringArray(data.knownTopics).length && !asStringArray(data.needsHelp).length) {
    return null;
  }
  const updatedAt = data.updatedAt as { toMillis?: () => number } | number | undefined;
  let updatedAtMs: number | undefined;
  if (typeof updatedAt === 'number') updatedAtMs = updatedAt;
  else if (updatedAt && typeof updatedAt.toMillis === 'function') updatedAtMs = updatedAt.toMillis();
  else if (typeof data.updatedAtMs === 'number') updatedAtMs = data.updatedAtMs;

  return {
    teacherNotes,
    knownTopics: asStringArray(data.knownTopics),
    needsHelp: asStringArray(data.needsHelp),
    learningStyle: typeof data.learningStyle === 'string' ? data.learningStyle.trim() : '',
    sessionCount: typeof data.sessionCount === 'number' ? data.sessionCount : 0,
    updatedAtMs,
    he: parseResumeText(data.he) ?? undefined,
  };
}

function parseResumeText(raw: unknown, maxNotes = MAX_NOTES): ResumeText | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const teacherNotes = typeof data.teacherNotes === 'string' ? clip(data.teacherNotes, maxNotes) : '';
  if (!teacherNotes) return null;
  return {
    teacherNotes,
    knownTopics: asStringArray(data.knownTopics),
    needsHelp: asStringArray(data.needsHelp),
    learningStyle: typeof data.learningStyle === 'string' ? clip(data.learningStyle, MAX_STYLE) : '',
  };
}

export function getGeminiApiKey(): string | undefined {
  const extra = (Constants.expoConfig as any)?.extra ?? {};
  return extra.geminiApiKey ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY;
}

async function callGemini(apiKey: string, prompt: string, maxOutputTokens: number): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens },
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Resume API error: ${res.status}`);
  }
  const json = await res.json();
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content || typeof content !== 'string') throw new Error('No resume content from Gemini');
  return content;
}

/** Translates the AI-written resume text to Hebrew (for resumes saved before `he` existed). */
export async function translateResumeToHebrew(resume: ResumeText, apiKey: string): Promise<ResumeText> {
  const prompt = `Translate this student learning resume from English to natural, modern Israeli Hebrew for teachers and students.
Keep the same meaning and the same number of list items, in the same order. Use gender-neutral forms where practical. Keep formulas and proper names as-is.

${JSON.stringify({
    teacherNotes: resume.teacherNotes,
    knownTopics: resume.knownTopics,
    needsHelp: resume.needsHelp,
    learningStyle: resume.learningStyle,
  })}

Return ONLY JSON with the same keys: {"teacherNotes": "...", "knownTopics": [...], "needsHelp": [...], "learningStyle": "..."}`;
  const content = await callGemini(apiKey, prompt, 1200);
  const parsed = parseResumeText(extractJsonObject(content));
  if (!parsed) throw new Error('Could not parse Hebrew resume');
  return parsed;
}

export async function fetchLearningResume(userId: string): Promise<LearningResume | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return parseLearningResume(snap.data()?.learningResume);
}

export function formatResumeForTutor(resume: LearningResume | null | undefined): string {
  if (!resume) return '';
  const known = resume.knownTopics.length ? resume.knownTopics.join('; ') : 'not enough data yet';
  const help = resume.needsHelp.length ? resume.needsHelp.join('; ') : 'not enough data yet';
  const style = resume.learningStyle || 'not enough data yet';
  const notes = resume.teacherNotes || 'not enough data yet';
  return [
    'Student learning profile (use this so you do not re-teach what they already know):',
    `How they learn better: ${style}`,
    `Already comfortable with (acknowledge briefly, then move on): ${known}`,
    `Needs help with (focus hints here): ${help}`,
    `Teacher notes: ${notes}`,
  ].join('\n');
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function transcriptFromMessages(messages: ChatTurn[]): string {
  return messages
    .filter((m) => m.content?.trim() && m.content !== '[Image]' && !m.content.startsWith('Hi! I\'m your AI'))
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.trim()}`)
    .join('\n');
}

export async function updateLearningResumeFromChat(options: {
  userId: string;
  apiKey: string;
  previous: LearningResume | null;
  messages: ChatTurn[];
}): Promise<LearningResume | null> {
  const { userId, apiKey, previous, messages } = options;
  const transcript = transcriptFromMessages(messages);
  if (!transcript.includes('Student:')) return previous;

  const previousJson = previous
    ? JSON.stringify({
        teacherNotes: previous.teacherNotes,
        knownTopics: previous.knownTopics,
        needsHelp: previous.needsHelp,
        learningStyle: previous.learningStyle,
      })
    : 'null';

  const prompt = `You maintain a concise learning resume for a student. Teachers use it to teach better. The AI tutor uses it to skip material the student already knows.

Previous resume JSON:
${previousJson}

Latest Study Helper chat:
${transcript}

Update the resume. Keep facts that are still true. Add or refine based on this chat only. Do not invent subjects that were not discussed. Never include full homework answers.

Return ONLY JSON with this shape:
{
  "teacherNotes": "4-7 sentences for the teacher: how this student learns better, what they already understand, and where they need help next.",
  "knownTopics": ["short topic the student already handles"],
  "needsHelp": ["short topic or skill they still struggle with"],
  "learningStyle": "1-2 sentences about what kind of hints or explanations work for them",
  "he": {
    "teacherNotes": "the same teacherNotes in natural modern Israeli Hebrew",
    "knownTopics": ["the same knownTopics in Hebrew, same order"],
    "needsHelp": ["the same needsHelp in Hebrew, same order"],
    "learningStyle": "the same learningStyle in Hebrew"
  }
}
The top-level fields must be in English. The "he" object is a faithful Hebrew translation of them (gender-neutral where practical).`;

  const content = await callGemini(apiKey, prompt, 1500);

  const parsed = extractJsonObject(content);
  if (!parsed) throw new Error('Could not parse learning resume');

  const next: LearningResume = {
    teacherNotes: clip(typeof parsed.teacherNotes === 'string' ? parsed.teacherNotes : previous?.teacherNotes || '', MAX_NOTES),
    knownTopics: asStringArray(parsed.knownTopics),
    needsHelp: asStringArray(parsed.needsHelp),
    learningStyle: clip(
      typeof parsed.learningStyle === 'string' ? parsed.learningStyle : previous?.learningStyle || '',
      MAX_STYLE
    ),
    sessionCount: (previous?.sessionCount || 0) + 1,
    updatedAtMs: Date.now(),
    he: parseResumeText(parsed.he) ?? undefined,
  };

  if (!next.teacherNotes) return previous;

  await setDoc(
    doc(db, 'users', userId),
    {
      learningResume: {
        teacherNotes: next.teacherNotes,
        knownTopics: next.knownTopics,
        needsHelp: next.needsHelp,
        learningStyle: next.learningStyle,
        sessionCount: next.sessionCount,
        // Firestore merge would keep a stale `he` from the previous resume, so always overwrite.
        he: next.he ?? null,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return next;
}
