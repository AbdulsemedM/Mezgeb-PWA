import { ETHIOPIAN_MONTHS, gregorianToEthiopian } from '@shared/calendar/ethiopian';
import { ADDIS_OFFSET_MS, type LocalDate, localDate, parseLocalDate } from '@shared/calendar/local';
import type { Language } from '../i18n';

/** ADR-003: each person picks Ethiopian or Gregorian once. */
export type CalendarPref = 'ethiopian' | 'gregorian';

const GREGORIAN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * A local date in the reader's calendar, formatted exactly like the API's statements
 * (`displayDate` in apps/api): "12 Tikimt 2019", "ጥቅምት 12 2019 ዓ.ም." or "22 Oct 2026".
 */
export function displayDate(date: LocalDate, language: Language, calendar: CalendarPref): string {
  const g = parseLocalDate(date);
  if (calendar === 'ethiopian') {
    const e = gregorianToEthiopian(g);
    const month = ETHIOPIAN_MONTHS[language][e.month - 1];
    return language === 'am' ? `${month} ${e.day} ${e.year} ዓ.ም.` : `${e.day} ${month} ${e.year}`;
  }
  if (language === 'en') return `${g.day} ${GREGORIAN_MONTHS[g.month - 1]} ${g.year}`;
  return `${String(g.day).padStart(2, '0')}/${String(g.month).padStart(2, '0')}/${g.year}`;
}

/** An instant's Addis Ababa date in the reader's calendar. */
export function displayInstantDate(
  instant: Date | string,
  language: Language,
  calendar: CalendarPref,
): string {
  return displayDate(localDate(new Date(instant)), language, calendar);
}

/**
 * Addis Ababa clock time "14:05" (24-hour, Western digits).
 * TODO(i18n-review): ask native reviewers whether Amharic should use Ethiopian hours.
 */
export function displayTime(instant: Date | string): string {
  const t = new Date(new Date(instant).getTime() + ADDIS_OFFSET_MS);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}

/** "Last updated" wording: the time today, else the date and time. */
export function displayWhen(
  instant: Date | string,
  language: Language,
  calendar: CalendarPref,
  now: Date = new Date(),
): string {
  const at = new Date(instant);
  const time = displayTime(at);
  return localDate(at) === localDate(now)
    ? time
    : `${displayInstantDate(at, language, calendar)} ${time}`;
}

export { localDate };
