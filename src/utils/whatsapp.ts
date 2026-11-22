import * as Linking from 'expo-linking';

/**
 * Open a WhatsApp chat with the given phone number (wa.me deep link).
 * Falls back silently if WhatsApp / a handler is unavailable.
 */
export async function openWhatsApp(phone: string, message?: string): Promise<void> {
  let digits = (phone || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  // wa.me needs the international format; local Israeli numbers (050-..., 03-...) start with 0.
  else if (digits.startsWith('0')) digits = `972${digits.slice(1)}`;
  if (!digits) return;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  const url = `https://wa.me/${digits}${text}`;
  try {
    // https links always open (WhatsApp app if installed, otherwise the browser).
    await Linking.openURL(url);
  } catch {
    // no-op
  }
}
