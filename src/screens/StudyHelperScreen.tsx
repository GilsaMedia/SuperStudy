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
import Constants from 'expo-constants';
import { useFirebaseAuth } from '../context/FirebaseAuth';
import { colors } from '../theme';

const extra = (Constants.expoConfig as any)?.extra ?? {};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  imageData?: { mimeType: string; data: string } | null;
};

async function getGeminiReply(messages: ChatMessage[], apiKey: string): Promise<string> {
  const systemPrompt = `You are an expert tutor. Your role is to guide students to discover solutions themselves through hints and questions.
NEVER give the complete answer. Only give hints, clues, and guiding questions. Ask Socratic questions.
Keep responses under 200 words. End with a question to guide their next step.`;

  const contents = messages.map((m) => {
    const parts: any[] = [];
    if (m.content?.trim()) parts.push({ text: m.content.trim() });
    if (m.imageData) parts.push({ inlineData: { mimeType: m.imageData.mimeType, data: m.imageData.data } });
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: parts.length ? parts : [{ text: '[Image]' }],
    };
  });

  if (contents.length > 0 && contents[0].role === 'user') {
    const first = contents[0];
    if (first.parts[0] && 'text' in first.parts[0]) {
      first.parts[0].text = `${systemPrompt}\n\nUser: ${first.parts[0].text}`;
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error: ${res.status}`);
  }
  const json = await res.json();
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('No content from Gemini');
  return content;
}

export default function StudyHelperScreen() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI study tutor. Type a question and I'll guide you step-by-step.",
    },
  ]);
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setImageError('Permission to access photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) {
      setAttachedImage(null);
      setImageError(null);
      return;
    }
    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) {
      setImageError('Could not get image data.');
      return;
    }
    setAttachedImage({
      uri: asset.uri,
      base64,
      mimeType: asset.mimeType || 'image/jpeg',
    });
    setImageError(null);
  };

  const send = async () => {
    const trimmed = input.trim();
    const hasImage = !!attachedImage?.base64;
    if ((!trimmed && !hasImage) || sending) return;
    const apiKey = extra.geminiApiKey ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Gemini API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY to your app config (e.g. .env or app.json extra).',
        },
      ]);
      return;
    }
    if (!user) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Please log in to use the Study Helper.' },
      ]);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed || (hasImage ? '[Image question]' : ''),
      imageData: hasImage
        ? { mimeType: attachedImage!.mimeType, data: attachedImage!.base64 }
        : undefined,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setAttachedImage(null);
    setSending(true);

    try {
      const reply = await getGeminiReply(nextMessages, apiKey);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${msg}. Check your API key and try again.` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm your AI study tutor. Type a question and I'll guide you.",
      },
    ]);
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
        <Text style={styles.heroTitle}>Study Helper</Text>
        <Text style={styles.heroSubtitle}>Describe a question. We guide — you solve.</Text>
      </View>

      {!user && (
        <View style={styles.loginHint}>
          <Text style={styles.loginHintText}>Log in or sign up to use the Study Helper.</Text>
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
            <Text style={styles.msgRole}>{m.role === 'user' ? 'You' : 'Tutor'}</Text>
            <Text style={styles.msgText}>{m.content}</Text>
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
            <Text style={styles.msgRole}>Tutor</Text>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.thinking}>Thinking…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Help me with this physics problem..."
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
            <Text style={styles.attachBtnText}>📷 Photo</Text>
          </TouchableOpacity>
          {attachedImage && (
            <View style={styles.previewRow}>
              <Image source={{ uri: attachedImage.uri }} style={styles.previewImg} />
              <TouchableOpacity onPress={() => setAttachedImage(null)}>
                <Text style={styles.removePreview}>Remove</Text>
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
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={resetChat}>
              <Text style={styles.clearBtnText}>New Chat</Text>
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
