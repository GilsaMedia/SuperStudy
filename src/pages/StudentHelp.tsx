import React from 'react';
import { Link } from 'react-router-dom';
import './student-help.css';
import { useFirebaseAuth } from '../context/FirebaseAuth';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
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

    // Detect subject
    if (lower.includes('solve') || lower.includes('equation') || lower.includes('x') || lower.includes('y')) {
      topic = 'algebra';
    } else if (lower.includes('derivative') || lower.includes('integral') || lower.includes('calculus')) {
      topic = 'calculus';
      complexity = 'complex';
    } else if (lower.includes('triangle') || lower.includes('angle') || lower.includes('geometry')) {
      topic = 'geometry';
    } else if (lower.includes('physics') || lower.includes('force') || lower.includes('velocity')) {
      topic = 'physics';
    } else if (lower.includes('chemistry') || lower.includes('molecule') || lower.includes('reaction')) {
      topic = 'chemistry';
    } else if (lower.includes('history') || lower.includes('historical')) {
      topic = 'history';
    } else if (lower.includes('biology') || lower.includes('cell') || lower.includes('organism')) {
      topic = 'biology';
    }

    // Detect complexity
    if (lower.includes('step') || lower.includes('show') || lower.includes('explain')) {
      complexity = 'medium';
    }
    if (lower.split(' ').length > 20 || lower.includes('prove') || lower.includes('theorem')) {
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
  const groqKey = process.env.REACT_APP_GROQ_API_KEY;
  const openaiKey = process.env.REACT_APP_OPENAI_API_KEY;

  // Prioritize Groq (free and fast), then OpenAI, then fallback
  if (groqKey) {
    return getGroqReply(messages);
  } else if (openaiKey) {
    return getOpenAiReply(messages);
  } else {
    return getFallbackAgentReply(messages);
  }
}

// OpenAI API call
async function getOpenAiReply(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not found');

  // Enhanced system prompt from agent
  const systemPrompt = agent.generateSystemPrompt(messages);
  const enhancedMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.filter((m) => m.role !== 'system'),
  ];

  const MAX_MESSAGES = 20;
  const trimmedHistory = enhancedMessages.slice(-MAX_MESSAGES);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: trimmedHistory,
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `OpenAI API error: ${response.status}`);
  }

  const json = await response.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  return content || 'Sorry — I could not generate a response.';
}

// Groq API call - Primary AI provider
async function getGroqReply(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.REACT_APP_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key not found. Please add REACT_APP_GROQ_API_KEY to your .env file');
  }

  // Generate enhanced system prompt from agent
  const systemPrompt = agent.generateSystemPrompt(messages);
  
  // Build message array with system prompt and conversation history
  // Filter out any existing system messages and add our enhanced one
  const conversationMessages = messages.filter((m) => m.role !== 'system');
  const enhancedMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationMessages,
  ];

  // Keep last 16 messages to stay within token limits while maintaining context
  const MAX_MESSAGES = 16;
  const trimmedHistory = enhancedMessages.slice(-MAX_MESSAGES);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Free and fast model
        messages: trimmedHistory,
        temperature: 0.3, // Lower temperature for more focused, educational responses
        max_tokens: 400, // Limit response length to keep it concise
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error (${response.status}): ${errorText || 'Unknown error'}`);
    }

    const json = await response.json();
    const content: string | undefined = json?.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from Groq API');
    }

    return content;
  } catch (error) {
    console.error('Error calling Groq API:', error);
    throw error;
  }
}

// Fallback agent with rule-based logic
async function getFallbackAgentReply(messages: ChatMessage[]): Promise<string> {
  const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
  const analysis = agent.analyzeQuestion(lastUserMsg);
  const hintsGiven = messages.filter((m) => m.role === 'assistant').length;

  // Progressive hint system
  const hints = [
    `Let's break down this ${analysis.topic} problem. What information do you already know?`,
    `Think about the key concepts in ${analysis.topic}. What formula or method might apply here?`,
    `Try working backwards. What would the answer look like?`,
    `Can you identify what you're trying to find? What are the given values?`,
    `Consider breaking this into smaller steps. What's the first thing you need to do?`,
  ];

  const hintIndex = Math.min(hintsGiven, hints.length - 1);
  return hints[hintIndex] || "I'm here to guide you. What specific part are you stuck on?";
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

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    if (!user) {
      setAccessError('Study Helper is available once you log in. Please log in or sign up to continue.');
      return;
    }
    
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setShowAgentThinking(true);

    try {
      // Log agent reasoning for debugging
      const reasoning = await agent.getAgentReasoning(nextMessages);
      console.log('🤖 Agent Analysis:', reasoning);
      
      // Check which provider will be used
      const groqKey = process.env.REACT_APP_GROQ_API_KEY;
      const openaiKey = process.env.REACT_APP_OPENAI_API_KEY;
      if (groqKey) {
        console.log('✅ Using Groq AI');
      } else if (openaiKey) {
        console.log('✅ Using OpenAI');
      } else {
        console.log('⚠️ Using fallback (no API keys found)');
      }

      const reply = await getAiReply(nextMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('❌ AI error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          content: `There was a problem contacting the AI: ${errorMessage}. Please check your API key in the .env file and make sure REACT_APP_GROQ_API_KEY is set correctly.` 
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
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
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
            placeholder="e.g., Solve: 2x + 5 = 17. Show each step."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            disabled={!user || sending}
            style={{ opacity: !user ? 0.6 : 1 }}
          />

          <div className="help__actions">
            <button type="submit" disabled={sending || !input.trim() || !user} className="help__btn help__btn--primary">
              {sending ? 'Thinking…' : 'Send'}
            </button>
            <button type="button" className="help__btn" onClick={() => setInput('')}>Clear</button>
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


