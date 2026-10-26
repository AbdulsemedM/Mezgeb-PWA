import { formatBirr } from '@shared/money';
import type { Language, Translate } from '../i18n';

/** `ETB 1,234.50` (en, om) or `1,234.50 ብር` (am): Western digits, thousands separators. */
export function formatAmount(santim: number, language: Language): string {
  return formatBirr(santim, language);
}

/** What a screen reader says for an amount (MOB-002 §8): "2340 birr 50 santim". */
export function spokenAmount(t: Translate, santim: number): string {
  const abs = Math.abs(santim);
  const birr = Math.floor(abs / 100);
  const cents = abs % 100;
  const words =
    cents === 0
      ? t('amountSpokenBirr', { birr })
      : t('amountSpokenBirrSantim', { birr, santim: cents });
  return santim < 0 ? t('amountSpokenMinus', { amount: words }) : words;
}
