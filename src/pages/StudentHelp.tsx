import React from 'react';
import './student-help.css';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function getAiReply(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) {
    // Simple deterministic fallback so the experience works without an API key
    const last = [...messages].reverse().find((m: ChatMessage) => m.role === 'user') || messages[messages.length - 1];
    const prompt = last?.content || '';
    return `I'll help you think it through step-by-step.\n\n1) Restate the problem: ${prompt || 'Describe the problem clearly.'}\n2) Identify knowns/unknowns.\n3) Choose a method to solve.\n4) Work the steps carefully.\n5) Check the answer in the original problem.`;
  }

  // Keep a short rolling history to control token usage
  const MAX_MESSAGES = 16;
  const trimmedHistory = messages.slice(-MAX_MESSAGES);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: trimmedHistory,
      temperature: 0.2,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `AI request failed with ${response.status}`);
  }

  const json = await response.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  return content || 'Sorry — I could not generate a response.';
}

export default function StudentHelp() {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'system',
      content:
        'You are a patient study tutor. Give hints and step-by-step guidance, not full solutions. Encourage the student to think. Keep replies concise (under 8 bullet points).',
    },
    {
      role: 'assistant',
      content: "Hi! Paste a question and I'll guide you step-by-step.",
    },
  ]);
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Auto-scroll to the latest message
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const reply = await getAiReply(nextMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'There was a problem contacting the AI. Please try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send();
  };

  return (
    <div className="help">
      <section className="help__hero">
        <h1 className="help__title">Study Helper</h1>
        <p className="help__subtitle">Paste or describe a school question. We guide — you solve.</p>
      </section>

      <section className="help__panel">
        <div className="help__chat" ref={listRef} style={{
          overflowY: 'auto',
          maxHeight: '48vh',
          padding: '12px 0',
          borderBottom: '1px solid var(--border-color, #2a2a2a)'
        }}>
          {messages.filter((m) => m.role !== 'system').map((m, i) => (
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
          />

          <div className="help__actions">
            <button type="submit" disabled={sending || !input.trim()} className="help__btn help__btn--primary">
              {sending ? 'Thinking…' : 'Send'}
            </button>
            <button type="button" className="help__btn" onClick={() => setInput('')}>Clear</button>
          </div>

          <p className="help__note">Tip: Add context (what you tried, where you’re stuck) for better guidance.</p>
        </form>
      </section>
    </div>
  );
}


