/** Phone numbers typed on the NumberPad, as the Flutter app does (no system keyboard). */
export const MAX_PHONE_DIGITS = 10;

export function pressPhoneDigit(digits: string, d: string): string {
  return digits.length >= MAX_PHONE_DIGITS ? digits : digits + d;
}

/** "0911223344" → "09 11 22 33 44"; "911223344" → "911 22 33 44". */
export function formatPhoneDigits(digits: string): string {
  const groups = digits.startsWith('0') ? [2, 2, 2, 2, 2] : [3, 2, 2, 2];
  const out: string[] = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + size));
    i += size;
  }
  if (i < digits.length) out.push(digits.slice(i));
  return out.join(' ');
}

/** "+251911223344" → "09 11 22 33 44", the way people write their own number. */
export function displayPhone(e164: string): string {
  const m = /^\+251([79]\d{8})$/.exec(e164);
  return m ? formatPhoneDigits(`0${m[1]}`) : e164;
}
