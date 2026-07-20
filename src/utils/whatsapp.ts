import * as Linking from 'expo-linking';

/**
 * Open a WhatsApp chat with the given phone number (wa.me deep link).
 * Falls back silently if WhatsApp / a handler is unavailable.
 */
export async function openWhatsApp(phone: string, message?: string): Promise<void> {
  const digits = (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  const url = `https://wa.me/${digits}${text}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else await Linking.openURL(url); // web/dev: let the browser handle it
  } catch {
    // no-op
  }
}
