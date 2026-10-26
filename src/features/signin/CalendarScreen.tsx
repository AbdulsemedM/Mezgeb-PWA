import { useState } from 'react';
import { useNavigate } from 'react-router';
import { OfflineError } from '../../api/client';
import { updateMe } from '../../auth/session';
import { useI18n } from '../../i18n';
import { type CalendarPref, displayInstantDate } from '../../lib/dates';
import { CalmBanner, ChoiceTile, ErrorPanel, Screen } from '../../ui';

/**
 * ADR-003: the person picks Ethiopian or Gregorian once. Each choice shows today's date in that
 * calendar, so the familiar one is easy to recognise.
 */
export function CalendarScreen({ next = '/invites' }: { next?: string }) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [saving, setSaving] = useState<CalendarPref | null>(null);
  const [problem, setProblem] = useState<'offline' | 'error' | null>(null);

  async function choose(calendar: CalendarPref) {
    setSaving(calendar);
    setProblem(null);
    try {
      await updateMe({ calendar_pref: calendar });
      navigate(next, { replace: true });
    } catch (err) {
      setProblem(err instanceof OfflineError ? 'offline' : 'error');
      setSaving(null);
    }
  }

  const today = new Date();
  return (
    <Screen
      title={t('chooseCalendarTitle')}
      help={{ title: t('chooseCalendarTitle'), body: t('calendarHelpBody') }}
    >
      {problem === 'offline' && <CalmBanner message={t('needInternetAction')} />}
      {problem === 'error' && <ErrorPanel />}
      <div className="list" role="radiogroup" aria-label={t('chooseCalendarTitle')}>
        {(['ethiopian', 'gregorian'] as const).map((c) => (
          <ChoiceTile
            key={c}
            title={t(c === 'ethiopian' ? 'calendarEthiopian' : 'calendarGregorian')}
            subtitle={t('todayIs', { date: displayInstantDate(today, language, c) })}
            selected={saving === c}
            onClick={() => void choose(c)}
          />
        ))}
      </div>
    </Screen>
  );
}
