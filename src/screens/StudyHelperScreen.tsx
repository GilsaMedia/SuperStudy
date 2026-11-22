import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type Anthropic from '@anthropic-ai/sdk';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { Language, useLanguage } from '../context/Language';
import { colors } from '../theme';
import { askClaude, describeClaudeError, isClaudeConfigured } from '../utils/claude';
import {
  LearningResume,
  fetchLearningResume,
  formatResumeForTutor,
  updateLearningResumeFromChat,
} from '../utils/learningResume';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  imageData?: { mimeType: string; data: string } | null;
  /** UI-only notices (greeting, errors). Never sent to Claude or saved to the resume. */
  local?: boolean;
};

const GREETING = "Hi! I'm your AI study tutor. Type a question and I'll guide you step-by-step.";

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const SUPPORTED_IMAGE_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function toImageMediaType(mimeType: string | undefined): ImageMediaType {
  const normalized = (mimeType || '').toLowerCase().replace('image/jpg', 'image/jpeg') as ImageMediaType;
  // The picker re-encodes edited images as JPEG, so JPEG is the safe default.
  return SUPPORTED_IMAGE_TYPES.includes(normalized) ? normalized : 'image/jpeg';
}

function toClaudeMessages(messages: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return messages
    .filter((m) => !m.local)
    .map((m) => {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (m.imageData) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: toImageMediaType(m.imageData.mimeType), data: m.imageData.data },
        });
      }
      content.push({ type: 'text', text: m.content?.trim() || '[Image]' });
      return { role: m.role, content };
    });
}

async function getTutorReply(
  messages: ChatMessage[],
  resume: LearningResume | null | undefined,
  language: Language
): Promise<string> {
  const profileBlock = formatResumeForTutor(resume);
  const systemPrompt = `You are an expert tutor. Your role is to guide students to discover solutions themselves through hints and questions.
NEVER give the complete answer. Only give hints, clues, and guiding questions. Ask Socratic questions.
Keep responses under 200 words. End with a question to guide their next step.
If the student already knows a topic, do not restart from the basics — skip ahead or briefly confirm, then focus on where they need help.
Always reply in the same language the student writes in. If unsure, reply in ${language === 'he' ? 'Hebrew' : 'English'}.
${profileBlock}`;

  return askClaude({
    // Thinking tokens count toward max_tokens; the 200-word limit is enforced by the prompt.
    max_tokens: 8000,
    output_config: { effort: 'low' },
    system: systemPrompt,
    messages: toClaudeMessages(messages),
  });
}

export default function StudyHelperScreen() {
  const { user, loading: authLoading, refreshProfile } = useFirebaseAuth();
  const { t, language } = useLanguage();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: GREETING, local: true }]);
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [resume, setResume] = useState<LearningResume | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const resumeRef = useRef<LearningResume | null>(null);
  const updatingResume = useRef(false);
  const pendingResumeMessages = useRef<ChatMessage[] | null>(null);
  /** Bumped by "New Chat" so a reply that arrives for an old chat is dropped. */
  const chatIdRef = useRef(0);
  /** Whether the current chat has already been counted in the resume's sessionCount. */
  const sessionCountedRef = useRef(false);

  useEffect(() => {
    resumeRef.current = resume;
  }, [resume]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    if (!user?.uid) {
      setResume(null);
      return;
    }
    let cancelled = false;
    fetchLearningResume(user.uid)
      .then((next) => {
        if (!cancelled) setResume(next);
      })
      .catch(() => {
        if (!cancelled) setResume(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setImageError(t('Permission to access photos is required.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      base64: true,
      // Keep base64 payloads well under Claude's 5 MB per-image limit.
      quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) {
      setAttachedImage(null);
      setImageError(null);
      return;
    }
    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) {
      setImageError(t('Could not get image data.'));
      return;
    }
    setAttachedImage({
      uri: asset.uri,
      base64,
      mimeType: toImageMediaType(asset.mimeType),
    });
    setImageError(null);
  };

  const send = async () => {
    const trimmed = input.trim();
    const hasImage = !!attachedImage?.base64;
    if ((!trimmed && !hasImage) || sending) return;
    if (!isClaudeConfigured()) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          local: true,
          content: t(
            'Claude API key is missing. Add EXPO_PUBLIC_ANTHROPIC_API_KEY to your app config (e.g. .env or app.json extra).'
          ),
        },
      ]);
      return;
    }
    if (!user) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', local: true, content: t('Please log in to use the Study Helper.') },
      ]);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed || '[Image question]',
      imageData: hasImage ? { mimeType: attachedImage!.mimeType, data: attachedImage!.base64 } : undefined,
    };
    const chatId = chatIdRef.current;
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setAttachedImage(null);
    setSending(true);

    try {
      const reply = await getTutorReply(nextMessages, resumeRef.current, language);
      if (chatId !== chatIdRef.current) return; // user started a new chat meanwhile
      const withReply: ChatMessage[] = [...nextMessages, { role: 'assistant', content: reply }];
      setMessages(withReply);

      const uid = user.uid;
      const persistResume = (chat: ChatMessage[]) => {
        if (updatingResume.current) {
          pendingResumeMessages.current = chat;
          return;
        }
        updatingResume.current = true;
        const newSession = !sessionCountedRef.current;
        sessionCountedRef.current = true;
        void updateLearningResumeFromChat({
          userId: uid,
          previous: resumeRef.current,
          newSession,
          messages: chat.filter((m) => !m.local).map((m) => ({ role: m.role, content: m.content })),
        })
          .then((next) => {
            if (next) {
              // Update the ref now so a queued update builds on this resume, not the old one.
              resumeRef.current = next;
              setResume(next);
              void refreshProfile();
            }
          })
          .catch(() => {
            if (newSession) sessionCountedRef.current = false;
          })
          .finally(() => {
            updatingResume.current = false;
            const queued = pendingResumeMessages.current;
            pendingResumeMessages.current = null;
            if (queued) persistResume(queued);
          });
      };
      persistResume(withReply);
    } catch (err) {
      if (chatId !== chatIdRef.current) return;
      const msg = describeClaudeError(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', local: true, content: t('Error: {msg}. Check your API key and try again.', { msg }) },
      ]);
    } finally {
      if (chatId === chatIdRef.current) setSending(false);
    }
  };

  const resetChat = () => {
    chatIdRef.current += 1;
    sessionCountedRef.current = false;
    setSending(false);
    setInput('');
    setAttachedImage(null);
    setImageError(null);
    setMessages([{ role: 'assistant', content: GREETING, local: true }]);
  };

  if (authLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('Study Helper')}</Text>
        <Text style={styles.heroSubtitle}>
          {t(
            'Describe a question. We guide — you solve. Your teacher gets a short resume of how you learn and where you need help.'
          )}
        </Text>
        {resume?.needsHelp.length ? (
          <Text style={styles.resumeHint}>
            {t('Focusing on: {topics}', { topics: resume.needsHelp.slice(0, 3).join(', ') })}
          </Text>
        ) : null}
      </View>

      {!user && (
        <View style={styles.loginHint}>
          <Text style={styles.loginHintText}>{t('Log in or sign up to use the Study Helper.')}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.msg, m.role === 'user' ? styles.msgUser : styles.msgAssistant]}>
            <Text style={styles.msgRole}>{m.role === 'user' ? t('You') : t('Tutor')}</Text>
            <Text style={styles.msgText}>{m.content === GREETING ? t(m.content) : m.content}</Text>
            {m.imageData && (
              <Image
                source={{ uri: `data:${m.imageData.mimeType};base64,${m.imageData.data}` }}
                style={styles.msgImage}
                resizeMode="contain"
              />
            )}
          </View>
        ))}
        {sending && (
          <View style={styles.msg}>
            <Text style={styles.msgRole}>{t('Tutor')}</Text>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.thinking}>{t('Thinking…')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TextInput
          style={styles.input}
          placeholder={t('e.g. Help me with this physics problem...')}
          placeholderTextColor={colors.textDim}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!!user && !sending}
        />
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.attachBtn, (!user || sending) && styles.btnDisabled]}
            onPress={pickImage}
            disabled={!user || sending}
          >
            <Text style={styles.attachBtnText}>{t('📷 Photo')}</Text>
          </TouchableOpacity>
          {attachedImage && (
            <View style={styles.previewRow}>
              <Image source={{ uri: attachedImage.uri }} style={styles.previewImg} />
              <TouchableOpacity onPress={() => setAttachedImage(null)}>
                <Text style={styles.removePreview}>{t('Remove')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {imageError ? <Text style={styles.imageError}>{imageError}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.sendBtn, (sending || (!input.trim() && !attachedImage) || !user) && styles.btnDisabled]}
              onPress={send}
              disabled={sending || (!input.trim() && !attachedImage) || !user}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>{t('Send')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={resetChat}>
              <Text style={styles.clearBtnText}>{t('New Chat')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  hero: { padding: 24, paddingBottom: 16 },
  heroTitle: { fontSize: 24, color: colors.white, fontWeight: '700', marginBottom: 8 },
  heroSubtitle: { color: colors.textMuted },
  resumeHint: { color: colors.primaryLight, marginTop: 8, fontSize: 13 },
  loginHint: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginHintText: { color: colors.primaryLight },
  chat: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 24 },
  msg: { marginBottom: 16 },
  msgUser: {},
  msgAssistant: {},
  msgRole: { fontSize: 12, color: colors.textDim, fontWeight: '600', marginBottom: 4 },
  msgText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  msgImage: { width: 200, height: 200, borderRadius: 8, marginTop: 8 },
  thinking: { color: colors.textDim, fontStyle: 'italic', marginTop: 4 },
  footer: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(2,6,23,0.6)',
    color: colors.text,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  actions: {},
  attachBtn: { marginBottom: 8 },
  attachBtnText: { color: colors.primaryLight },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  previewImg: { width: 48, height: 48, borderRadius: 8 },
  removePreview: { color: colors.dangerLight, fontSize: 12 },
  imageError: { color: colors.dangerLight, fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  sendBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  sendBtnText: { color: colors.white, fontWeight: '700' },
  clearBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center' },
  clearBtnText: { color: colors.text },
  btnDisabled: { opacity: 0.6 },
});
