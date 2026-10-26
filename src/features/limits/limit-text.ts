import type { LimitSetting } from '../../data/book';
import type { Language, Translate } from '../../i18n';
import { formatAmount } from '../../lib/money';

export type PeriodChoice = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'custom_days';

export function periodText(t: Translate, type: PeriodChoice, days: number | null): string {
  switch (type) {
    case 'weekly':
      return t('periodWeek');
    case 'biweekly':
      return t('period2Weeks');
    case 'monthly':
      return t('periodMonth');
    case 'custom_days':
      return t('periodDays', { days: days ?? 0 });
    default:
      return t('periodNone');
  }
}

/** "ETB 1,000.00 · 1 month" in the reader's words, or "Not set". */
export function describeLimit(t: Translate, language: Language, l: LimitSetting | null): string {
  if (!l) return t('noLimit');
  const parts: string[] = [];
  if (l.value !== null) parts.push(formatAmount(l.value, language));
  if (l.period) parts.push(periodText(t, l.period.type, l.period.days));
  return parts.join(' · ');
}
