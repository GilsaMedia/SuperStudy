import Anthropic from '@anthropic-ai/sdk';
import Constants from 'expo-constants';

/**
 * Shared Claude (Anthropic) client for the Study Helper and learning resume.
 *
 * Config (in .env / .env.local, read by app.config.js into `extra`):
 *   EXPO_PUBLIC_ANTHROPIC_API_KEY  - API key from https://console.anthropic.com/settings/keys
 *   EXPO_PUBLIC_CLAUDE_MODEL       - optional, defaults to DEFAULT_MODEL
 *   EXPO_PUBLIC_CLAUDE_BASE_URL    - optional, point at your own proxy so the key stays off devices
 */
export const DEFAULT_MODEL = 'claude-opus-5-5';

const extra = (Constants.expoConfig as any)?.extra ?? {};

export function getClaudeApiKey(): string | undefined {
  return extra.anthropicApiKey || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || undefined;
}

function getBaseURL(): string | undefined {
  return extra.claudeBaseUrl || process.env.EXPO_PUBLIC_CLAUDE_BASE_URL || undefined;
}

export function getClaudeModel(): string {
  return extra.claudeModel || process.env.EXPO_PUBLIC_CLAUDE_MODEL || DEFAULT_MODEL;
}

/** True when the app can talk to Claude (an API key or a proxy URL is configured). */
export function isClaudeConfigured(): boolean {
  return !!(getClaudeApiKey() || getBaseURL());
}

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!client) {
    const baseURL = getBaseURL();
    const apiKey = getClaudeApiKey();
    if (!apiKey && !baseURL) throw new Error('Missing Claude API key');
    client = new Anthropic({
      // A proxy may hold the real key itself; the SDK still needs a non-empty value.
      apiKey: apiKey || 'proxy',
      baseURL,
      // The app calls the API directly from the device (React Native / web).
      dangerouslyAllowBrowser: true,
      maxRetries: 2,
    });
  }
  return client;
}

type CreateParams = Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, 'model' | 'betas' | 'fallbacks'>;

/**
 * Sends one Messages API request and returns the text of the reply.
 * Server-side fallback is on, so if the model declines on a safety classifier
 * the API retries on a fallback model in the same call.
 */
export async function askClaude(params: CreateParams): Promise<string> {
  const response = await getClaude().beta.messages.create({
    ...params,
    model: getClaudeModel(),
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer this request.');
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) {
    throw new Error(
      response.stop_reason === 'max_tokens' ? 'Claude ran out of tokens before answering.' : 'No content from Claude'
    );
  }
  return text;
}

/** Turns SDK errors into a short message that is useful to show in the UI. */
export function describeClaudeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Invalid Claude API key.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This Claude API key is not allowed to use this model.';
  if (err instanceof Anthropic.RateLimitError) return 'Too many requests to Claude. Wait a moment and try again.';
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach Claude. Check your internet connection.';
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ''}`.trim();
  return err instanceof Error ? err.message : String(err);
}
