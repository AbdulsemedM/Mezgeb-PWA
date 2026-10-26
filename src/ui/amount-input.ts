/**
 * What the person typed on the AmountKeypad, in birr: digits, then optionally a point and up
 * to two santim digits. A port of the Flutter app's AmountInput; every key returns a new value.
 */
export const MAX_BIRR_DIGITS = 9;

export function pressKey(text: string, key: string): string {
  const point = text.indexOf('.');
  if (key === '.') {
    if (point >= 0) return text;
    return text === '' ? '0.' : `${text}.`;
  }
  if (!/^\d$/.test(key)) return text;
  if (point >= 0) return text.length - point > 2 ? text : `${text}${key}`;
  if (text === '0') return key;
  if (text.length >= MAX_BIRR_DIGITS) return text;
  return `${text}${key}`;
}

export function backspace(text: string): string {
  return text.slice(0, -1);
}

/** Integer santim (CLAUDE.md rule 2); 0 for empty input. */
export function inputSantim(text: string): number {
  if (text === '') return 0;
  const [birr = '0', cents = ''] = text.split('.');
  return Number(birr) * 100 + Number(cents.padEnd(2, '0'));
}

/** The typed text for an amount, e.g. to prefill the keypad. */
export function santimToInput(santim: number): string {
  const birr = Math.floor(santim / 100);
  const cents = santim % 100;
  return cents === 0 ? String(birr) : `${birr}.${String(cents).padStart(2, '0').replace(/0$/, '')}`;
}
