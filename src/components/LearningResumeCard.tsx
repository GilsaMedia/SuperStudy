import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGeminiApiKey,
  LearningResume,
  ResumeText,
  translateResumeToHebrew,
} from '../utils/learningResume';
import { useLanguage } from '../context/Language';
import { colors } from '../theme';

const HE_CACHE_PREFIX = 'superstudy_resume_he:';
const inFlight = new Map<string, Promise<ResumeText>>();

function cacheKey(resume: LearningResume): string {
  let hash = 0;
  const source = `${resume.updatedAtMs ?? ''}|${resume.teacherNotes}`;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0;
  return `${HE_CACHE_PREFIX}${hash}`;
}

async function loadHebrew(resume: LearningResume): Promise<ResumeText> {
  const key = cacheKey(resume);
  const cached = await AsyncStorage.getItem(key).catch(() => null);
  if (cached) return JSON.parse(cached) as ResumeText;
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Missing Gemini API key');
  let pending = inFlight.get(key);
  if (!pending) {
    pending = translateResumeToHebrew(resume, apiKey).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const translated = await pending;
  await AsyncStorage.setItem(key, JSON.stringify(translated)).catch(() => {});
  return translated;
}

/** Returns the resume text in the active language, translating older English-only resumes on demand. */
function useLocalizedResume(resume: LearningResume | null | undefined) {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<ResumeText | null>(null);
  const [translating, setTranslating] = useState(false);

  const needsTranslation = language === 'he' && !!resume?.teacherNotes && !resume.he;

  useEffect(() => {
    setTranslated(null);
    if (!needsTranslation || !resume) return;
    let cancelled = false;
    setTranslating(true);
    loadHebrew(resume)
      .then((text) => {
        if (!cancelled) setTranslated(text);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsTranslation, resume?.teacherNotes, resume?.updatedAtMs]);

  if (!resume?.teacherNotes || language !== 'he') return { text: resume ?? null, translating: false };
  return { text: resume.he ?? translated ?? resume, translating: needsTranslation && translating };
}

type Props = {
  resume: LearningResume | null | undefined;
  audience: 'teacher' | 'student';
  compact?: boolean;
};

export default function LearningResumeCard({ resume, audience, compact }: Props) {
  const { t, language } = useLanguage();
  const [expanded, setExpanded] = useState(!compact);
  const { text, translating } = useLocalizedResume(resume);

  if (!resume?.teacherNotes || !text) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('Learning resume')}</Text>
        <Text style={styles.empty}>
          {audience === 'teacher'
            ? t('This student has not used the Study Helper enough yet. A resume will appear after they practice with the AI tutor.')
            : t('Use the Study Helper and a short resume will appear here for your teachers — what you already know and where you need help.')}
        </Text>
      </View>
    );
  }

  const updated = resume.updatedAtMs
    ? new Date(resume.updatedAtMs).toLocaleDateString(language === 'he' ? 'he-IL' : undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('Learning resume')}</Text>
        {updated ? <Text style={styles.meta}>{t('Updated {date}', { date: updated })}</Text> : null}
      </View>
      <Text style={styles.hint}>
        {audience === 'teacher'
          ? t('From Study Helper chats — use this to teach what they still need.')
          : t('Shared with your teachers so lessons focus on where you need help.')}
      </Text>
      {translating ? <Text style={styles.meta}>{t('Translating…')}</Text> : null}
      <Text style={styles.notes} numberOfLines={expanded ? undefined : 4}>
        {text.teacherNotes}
      </Text>
      {text.learningStyle ? (
        <Text style={styles.style}>{t('Learns better: {style}', { style: text.learningStyle })}</Text>
      ) : null}
      {expanded && (
        <>
          {text.knownTopics.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Already comfortable')}</Text>
              <View style={styles.chips}>
                {text.knownTopics.map((topic) => (
                  <View key={topic} style={[styles.chip, styles.chipKnown]}>
                    <Text style={styles.chipKnownText}>{topic}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {text.needsHelp.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Needs help')}</Text>
              <View style={styles.chips}>
                {text.needsHelp.map((topic) => (
                  <View key={topic} style={[styles.chip, styles.chipHelp]}>
                    <Text style={styles.chipHelpText}>{topic}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
      {compact ? (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.toggle}>
          <Text style={styles.toggleText}>{expanded ? t('Show less') : t('Show full resume')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: colors.white, fontWeight: '700', fontSize: 14 },
  meta: { color: colors.textDim, fontSize: 11 },
  hint: { color: colors.primaryLight, fontSize: 12, marginTop: 6, marginBottom: 8 },
  notes: { color: colors.text, fontSize: 13, lineHeight: 20 },
  style: { color: colors.textMuted, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  empty: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 6 },
  section: { marginTop: 12 },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  chipKnown: { backgroundColor: colors.successBg, borderColor: 'rgba(34,197,94,0.4)' },
  chipKnownText: { color: colors.successLight, fontSize: 12 },
  chipHelp: { backgroundColor: colors.dangerBg, borderColor: 'rgba(239,68,68,0.4)' },
  chipHelpText: { color: colors.dangerLight, fontSize: 12 },
  toggle: { marginTop: 10 },
  toggleText: { color: colors.primaryLight, fontWeight: '600', fontSize: 13 },
});
