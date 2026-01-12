import React from 'react';
import { Link } from 'react-router-dom';
import './student-help.css';
import { useFirebaseAuth } from '../context/FirebaseAuth';

type ImageDataPart = {
  mimeType: string;
  /** Base64 (no data: prefix) */
  data: string;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageData?: ImageDataPart | null;
};
type AgentState = {
  studentLevel: 'beginner' | 'intermediate' | 'advanced';
  currentTopic: string | null;
  hintsGiven: number;
  lastApproach: string | null;
};

// AI Agent with enhanced capabilities
class StudyTutorAgent {
  private state: AgentState = {
    studentLevel: 'intermediate',
    currentTopic: null,
    hintsGiven: 0,
    lastApproach: null,
  };

  // Analyze student's question to understand context
  analyzeQuestion(question: string): { topic: string; complexity: 'simple' | 'medium' | 'complex' } {
    const lower = question.toLowerCase();
    let topic = 'general';
    let complexity: 'simple' | 'medium' | 'complex' = 'medium';

    // Detect subject - check more specific subjects first to avoid false matches
    // Language subjects
    if (lower.includes('hebrew') || lower.includes('עברית') || /[\u0590-\u05FF]/.test(question)) {
      topic = 'hebrew';
    } else if (lower.includes('english') || lower.includes('grammar') || lower.includes('syntax') || 
               lower.includes('essay') || lower.includes('writing') || lower.includes('literature') ||
               lower.includes('poem') || lower.includes('poetry') || lower.includes('novel') ||
               lower.includes('analyze this text') || lower.includes('what does this mean') ||
               lower.includes('comprehension') || lower.includes('reading')) {
      topic = 'english';
    } else if (lower.includes('spanish') || lower.includes('french') || lower.includes('german') ||
               lower.includes('arabic') || lower.includes('chinese') || lower.includes('japanese')) {
      topic = lower.includes('spanish') ? 'spanish' : 
              lower.includes('french') ? 'french' :
              lower.includes('german') ? 'german' :
              lower.includes('arabic') ? 'arabic' :
              lower.includes('chinese') ? 'chinese' : 'japanese';
    }
    // Math subjects - be more specific to avoid false positives
    else if (lower.includes('derivative') || lower.includes('integral') || lower.includes('calculus') ||
             lower.includes('limit') || lower.includes('differentiation')) {
      topic = 'calculus';
      complexity = 'complex';
    } else if (lower.includes('triangle') || lower.includes('angle') || lower.includes('geometry') ||
               lower.includes('circle') || lower.includes('perimeter') || lower.includes('area') ||
               lower.includes('volume') || lower.includes('polygon') || lower.includes('theorem')) {
      topic = 'geometry';
    } else if ((lower.includes('solve') && (lower.includes('equation') || lower.includes('x') || lower.includes('y') || lower.includes('variable'))) ||
               lower.includes('quadratic') || lower.includes('polynomial') || lower.includes('linear equation') ||
               lower.includes('system of equations') || lower.includes('inequality')) {
      topic = 'algebra';
    } else if (lower.includes('statistics') || lower.includes('probability') || lower.includes('mean') ||
               lower.includes('median') || lower.includes('standard deviation')) {
      topic = 'statistics';
    } else if (lower.includes('trigonometry') || lower.includes('sin') || lower.includes('cos') ||
               lower.includes('tan') || lower.includes('trig')) {
      topic = 'trigonometry';
    }
    // Science subjects
    else if (lower.includes('physics') || lower.includes('force') || lower.includes('velocity') ||
             lower.includes('acceleration') || lower.includes('momentum') || lower.includes('energy') ||
             lower.includes('electricity') || lower.includes('magnetism') || lower.includes('wave') ||
             lower.includes('quantum') || lower.includes('thermodynamics')) {
      topic = 'physics';
    } else if (lower.includes('chemistry') || lower.includes('molecule') || lower.includes('reaction') ||
               lower.includes('atom') || lower.includes('element') || lower.includes('compound') ||
               lower.includes('periodic table') || lower.includes('bond') || lower.includes('ph')) {
      topic = 'chemistry';
    } else if (lower.includes('biology') || lower.includes('cell') || lower.includes('organism') ||
               lower.includes('dna') || lower.includes('gene') || lower.includes('evolution') ||
               lower.includes('ecosystem') || lower.includes('photosynthesis')) {
      topic = 'biology';
    } else if (lower.includes('geology') || lower.includes('earth science') || lower.includes('rock') ||
               lower.includes('mineral') || lower.includes('plate tectonics')) {
      topic = 'earth science';
    }
    // Social studies
    else if (lower.includes('history') || lower.includes('historical') || lower.includes('war') ||
             lower.includes('ancient') || lower.includes('civilization') || lower.includes('empire')) {
      topic = 'history';
    } else if (lower.includes('geography') || lower.includes('map') || lower.includes('country') ||
               lower.includes('continent') || lower.includes('climate')) {
      topic = 'geography';
    } else if (lower.includes('government') || lower.includes('politics') || lower.includes('civics') ||
               lower.includes('constitution') || lower.includes('democracy')) {
      topic = 'government';
    } else if (lower.includes('economics') || lower.includes('economy') || lower.includes('market') ||
               lower.includes('supply') || lower.includes('demand')) {
      topic = 'economics';
    }
    // Arts and other subjects
    else if (lower.includes('art') || lower.includes('drawing') || lower.includes('painting') ||
             lower.includes('sculpture') || lower.includes('design')) {
      topic = 'art';
    } else if (lower.includes('music') || lower.includes('note') || lower.includes('chord') ||
               lower.includes('scale') || lower.includes('rhythm')) {
      topic = 'music';
    } else if (lower.includes('computer science') || lower.includes('programming') || lower.includes('code') ||
               lower.includes('algorithm') || lower.includes('software')) {
      topic = 'computer science';
    } else if (lower.includes('philosophy') || lower.includes('ethics') || lower.includes('logic')) {
      topic = 'philosophy';
    }

    // Detect complexity
    if (lower.includes('step') || lower.includes('show') || lower.includes('explain')) {
      complexity = 'medium';
    }
    if (lower.split(' ').length > 20 || lower.includes('prove') || lower.includes('theorem') ||
        lower.includes('analyze') || lower.includes('compare') || lower.includes('evaluate')) {
      complexity = 'complex';
    }
    if (lower.split(' ').length < 5) {
      complexity = 'simple';
    }

    return { topic, complexity };
  }

  // Generate adaptive system prompt based on conversation
  generateSystemPrompt(messages: ChatMessage[]): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    const lastQuestion = userMessages[userMessages.length - 1]?.content || '';
    const analysis = this.analyzeQuestion(lastQuestion);

    this.state.currentTopic = analysis.topic;
    this.state.hintsGiven = messages.filter((m) => m.role === 'assistant').length;

    let prompt = `You are an expert ${analysis.topic} tutor. Your CRITICAL role is to guide students to discover solutions themselves through hints and questions.

STRICT RULES - YOU MUST FOLLOW THESE:
1. NEVER provide the complete answer or final solution
2. NEVER show all the steps to solve the problem
3. ONLY give hints, clues, and guiding questions
4. Ask Socratic questions that lead the student to think
5. Break problems into smaller pieces and guide them through ONE step at a time
6. If the student asks for the answer, redirect them with: "Let's work through this together. What do you think the first step should be?"

CURRENT CONTEXT:
- Subject: ${analysis.topic}
- Problem complexity: ${analysis.complexity}
- Hints given so far: ${this.state.hintsGiven}
- Student level: ${this.state.studentLevel}

ADAPTIVE GUIDANCE:
- If student has received ${this.state.hintsGiven} hints and is still stuck, provide a slightly more specific hint about the NEXT step only
- Never give away the complete solution, even if they're frustrated
- Always encourage them to try the next step themselves

RESPONSE FORMAT:
- Use numbered steps or bullet points for clarity
- Keep responses under 200 words
- Use encouraging, supportive language
- Always end with a question to check their understanding or guide their next step
- Example good response: "Great question! Let's think about this step by step. What information do you already have? What are you trying to find? [Then ask a guiding question]"

Remember: Your job is to TEACH, not to SOLVE. Guide them to discover the answer themselves.`;

    return prompt;
  }

  // Get agent's reasoning before responding
  async getAgentReasoning(messages: ChatMessage[]): Promise<string> {
    const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
    const analysis = this.analyzeQuestion(lastUserMsg);

    return `Agent Analysis:
- Detected topic: ${analysis.topic}
- Complexity: ${analysis.complexity}
- Strategy: ${this.state.hintsGiven < 2 ? 'Start with broad hints' : 'Provide more specific guidance'}
- Goal: Guide student to solution through questioning`;
  }

  // Reset agent state for new conversation
  reset(): void {
    this.state = {
      studentLevel: 'intermediate',
      currentTopic: null,
      hintsGiven: 0,
      lastApproach: null,
    };
  }
}

const agent = new StudyTutorAgent();

async function getAiReply(messages: ChatMessage[]): Promise<string> {
  const geminiKey = process.env.REACT_APP_GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error(
      'Gemini API key is missing. Please create a .env.local file in the project root and add:\n' +
      'REACT_APP_GEMINI_API_KEY=your_api_key_here\n\n' +
      'Get your API key from: https://makersuite.google.com/app/apikey\n' +
      'After adding the key, restart the development server (npm start).'
    );
  }
  return getGeminiReply(messages, geminiKey);
}

// Gemini API call (primary provider)
async function getGeminiReply(messages: ChatMessage[], apiKey: string): Promise<string> {
  const systemPrompt = agent.generateSystemPrompt(messages);
  const conversationMessages = messages.filter((m) => m.role !== 'system');
  
  // Map messages to Gemini format
  const contents = conversationMessages.map((m) => {
    const parts: Array<
      | {
          text: string;
        }
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
    > = [];

    const trimmedContent = m.content.trim();
    if (trimmedContent) {
      parts.push({ text: trimmedContent });
    }

    if (m.imageData) {
      parts.push({
        inlineData: {
          mimeType: m.imageData.mimeType,
          data: m.imageData.data,
        },
      });
    }

    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  // Prepend system instruction as the first message since gemini-2.5-flash-lite
  // doesn't support systemInstruction field
  if (contents.length > 0 && contents[0].role === 'user') {
    // Prepend system prompt to the first user message
    const firstUserMessage = contents[0];
    if (firstUserMessage.parts.length > 0 && firstUserMessage.parts[0] && 'text' in firstUserMessage.parts[0]) {
      // Prepend system instruction to the first user message text
      firstUserMessage.parts[0].text = `${systemPrompt}\n\nUser question: ${firstUserMessage.parts[0].text}`;
    } else {
      // If first message has no text part, add system prompt as first part
      firstUserMessage.parts.unshift({ text: systemPrompt });
    }
  } else {
    // If no user message yet, prepend system instruction as first message
    contents.unshift({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });
  }

  // Use a single known-good model + version that your key has access to.
  // From your account's model list: "name": "models/gemini-2.5-flash-lite"
  const model = 'gemini-2.5-flash-lite';
  const version = 'v1';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      text ||
        `Gemini API error: ${response.status}. Tried ${version}/models/${model}. ` +
        'Make sure this model exists for your key by calling: ' +
        'curl "https://generativelanguage.googleapis.com/v1/models?key=YOUR_API_KEY"'
    );
  }

  const json = await response.json();
  const content: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('No content received from Gemini API');
  return content;
}

export default function StudentHelp() {
  const { user, loading } = useFirebaseAuth();
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI study tutor. Paste a question and I'll guide you step-by-step to discover the solution yourself.",
    },
  ]);
  const [sending, setSending] = React.useState(false);
  const [showAgentThinking, setShowAgentThinking] = React.useState(false);
  const [attachedImage, setAttachedImage] = React.useState<{
    file: File;
    previewUrl: string;
    mimeType: string;
    base64Data: string | null;
  } | null>(null);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [accessError, setAccessError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Auto-scroll to the latest message
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  React.useEffect(() => {
    if (user) {
      setAccessError(null);
    }
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachedImage(null);
      setImageError(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file.');
      setAttachedImage(null);
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setImageError('Image is too large. Please select an image under 5MB.');
      setAttachedImage(null);
      return;
    }

    setImageError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        setImageError('Could not read image. Please try a different file.');
        setAttachedImage(null);
        return;
      }

      const commaIndex = result.indexOf(',');
      const base64 = commaIndex >= 0 ? result.substring(commaIndex + 1) : result;

      const previewUrl = URL.createObjectURL(file);

      setAttachedImage({
        file,
        previewUrl,
        mimeType: file.type || 'image/*',
        base64Data: base64,
      });
    };

    reader.readAsDataURL(file);
  };

  const clearAttachedImage = () => {
    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }
    setAttachedImage(null);
    setImageError(null);
  };

  const send = async () => {
    const trimmed = input.trim();
    const hasImage = !!attachedImage?.base64Data;
    if ((!trimmed && !hasImage) || sending) return;
    if (!user) {
      setAccessError('Study Helper is available once you log in. Please log in or sign up to continue.');
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed || (hasImage ? '[Image question]' : ''),
      imageData: hasImage
        ? {
            mimeType: attachedImage!.mimeType,
            data: attachedImage!.base64Data as string,
          }
        : undefined,
    };

    const nextMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    clearAttachedImage();
    setSending(true);
    setShowAgentThinking(true);

    try {
      // Log agent reasoning for debugging
      const reasoning = await agent.getAgentReasoning(nextMessages);
      console.log('🤖 Agent Analysis:', reasoning);
      const reply = await getAiReply(nextMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('❌ AI error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `There was a problem contacting the AI: ${errorMessage}. Please check your Gemini API key (REACT_APP_GEMINI_API_KEY) and try again.`
        },
      ]);
    } finally {
      setSending(false);
      setShowAgentThinking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send();
  };

  const resetChat = () => {
    agent.reset();
    setMessages([
      {
        role: 'assistant',
        content: "Hi! I'm your AI study tutor. Paste a question and I'll guide you step-by-step.",
      },
    ]);
  };

  return (
    <div className="help">
      <section className="help__hero">
        <h1 className="help__title">Study Helper</h1>
        <p className="help__subtitle">Paste or describe a school question. We guide — you solve.</p>
      </section>

      <section className="help__panel">
        {!user && !loading && (
          <div
            className="hint"
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(148,163,184,0.2)',
              color: '#bfdbfe',
            }}
          >
            This feature is available after you log in or create an account.
            {' '}
            <Link to="/login" style={{ color: '#93c5fd', fontWeight: 600 }}>Log in</Link>
            {' '}
            or
            {' '}
            <Link to="/signup" style={{ color: '#93c5fd', fontWeight: 600 }}>Sign up</Link>
            {' '}
            to ask for study help.
          </div>
        )}

        <div className="help__chat" ref={listRef} style={{
          overflowY: 'auto',
          maxHeight: '48vh',
          padding: '12px 0',
          borderBottom: '1px solid var(--border-color, #2a2a2a)'
        }}>
          {messages.map((m, i) => (
            <div key={i} className={`help__msg help__msg--${m.role}`} style={{
              display: 'flex',
              margin: '8px 0'
            }}>
              <div style={{
                fontWeight: 600,
                marginRight: 8,
                minWidth: 72,
                color: 'var(--text-dim, #9aa0a6)'
              }}>{m.role === 'user' ? 'You' : 'Tutor'}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {m.content}
                {m.imageData && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={`data:${m.imageData.mimeType};base64,${m.imageData.data}`}
                      alt="Uploaded study problem"
                      style={{
                        maxWidth: '260px',
                        maxHeight: '260px',
                        borderRadius: 8,
                        border: '1px solid rgba(148,163,184,0.35)',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          {showAgentThinking && (
            <div style={{ 
              color: '#9aa0a6', 
              fontStyle: 'italic', 
              margin: '8px 0 8px 80px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ 
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid #9aa0a6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></span>
              Agent is analyzing your question...
            </div>
          )}
        </div>

        <form className="help__form" onSubmit={handleSubmit}>
          <label className="help__label" htmlFor="q">Your message</label>
          <textarea
            id="q"
            className="help__textarea"
            placeholder="e.g., Help me with this physics problem... or Explain this English passage... or Solve this algebra equation... You can also attach a photo of the problem below."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            disabled={!user || sending}
            style={{ opacity: !user ? 0.6 : 1 }}
          />

          <div
            className="help__image-tools"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
              marginBottom: 4,
              flexWrap: 'wrap',
            }}
          >
            <label
              className="help__btn help__btn--ghost"
              style={{
                cursor: !user || sending ? 'not-allowed' : 'pointer',
                opacity: !user || sending ? 0.6 : 1,
                marginBottom: 0,
              }}
            >
              Photo (take or upload)
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                disabled={!user || sending}
                style={{ display: 'none' }}
              />
            </label>

            {attachedImage && (
              <div
                className="help__image-preview"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(15,23,42,0.6)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  border: '1px solid rgba(148,163,184,0.45)',
                }}
              >
                <img
                  src={attachedImage.previewUrl}
                  alt={attachedImage.file.name || 'Selected problem image'}
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'cover',
                    borderRadius: 6,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#e5e7eb',
                      maxWidth: 180,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {attachedImage.file.name || 'Problem image'}
                  </span>
                  <button
                    type="button"
                    onClick={clearAttachedImage}
                    className="help__btn"
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      alignSelf: 'flex-start',
                      marginTop: 2,
                    }}
                    disabled={sending}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
          {imageError && (
            <p
              className="help__note"
              style={{ color: '#fca5a5', marginTop: 0, marginBottom: 4 }}
            >
              {imageError}
            </p>
          )}

          <div className="help__actions">
            <button
              type="submit"
              disabled={sending || (!input.trim() && !attachedImage?.base64Data) || !user}
              className="help__btn help__btn--primary"
            >
              {sending ? 'Thinking…' : 'Send'}
            </button>
            <button
              type="button"
              className="help__btn"
              onClick={() => {
                setInput('');
                clearAttachedImage();
              }}
            >
              Clear
            </button>
            <button type="button" className="help__btn" onClick={resetChat}>New Chat</button>
          </div>

          <p className="help__note">
            {user
              ? 'Tip: The AI agent adapts to your level and provides personalized guidance. Add context for better help.'
              : 'Tip: Sign in to unlock AI-guided study help.'}
          </p>
          {accessError && (
            <p className="help__note" style={{ color: '#fca5a5' }}>{accessError}</p>
          )}
        </form>
      </section>
    </div>
  );
}


