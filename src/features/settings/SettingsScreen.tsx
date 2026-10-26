import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signOut, updateMe } from '../../auth/session';
import { useSession } from '../../auth/useSession';
import { type Language, useI18n } from '../../i18n';
import { type CalendarPref, displayInstantDate } from '../../lib/dates';
import { BigButton, CalmBanner, ChoiceTile, ConfirmSheet, Screen } from '../../ui';
import { LanguagePicker } from '../start/LanguagePicker';
import { displayPhone } from '../signin/phone-digits';

/** Language, calendar, sign out (ADR-003: both choices can be changed later). */
export function SettingsScreen() {
  const { t, language } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [offline, setOffline] = useState(false);
  const user = session.status === 'signed-in' ? session.user : null;

  const save = (patch: { language?: Language; calendar_pref?: CalendarPref }) => {
    setOffline(false);
    updateMe(patch).catch(() => setOffline(true));
  };

  return (
    <Screen
      title={t('settingsTitle')}
      back="/"
      help={{ title: t('settingsTitle'), body: t('settingsHelpBody') }}
      actions={
        <BigButton label={t('signOut')} variant="secondary" onClick={() => setConfirm(true)} />
      }
    >
      {offline && <CalmBanner message={t('needInternetAction')} />}
      {user && <p className="muted">{t('signedInAs', { phone: displayPhone(user.phone) })}</p>}
      <h2 className="title">{t('settingsLanguage')}</h2>
      <LanguagePicker onPick={(l) => save({ language: l })} />
      <h2 className="title">{t('settingsCalendar')}</h2>
      <div className="list" role="radiogroup" aria-label={t('settingsCalendar')}>
        {(['ethiopian', 'gregorian'] as const).map((c) => (
          <ChoiceTile
            key={c}
            title={t(c === 'ethiopian' ? 'calendarEthiopian' : 'calendarGregorian')}
            subtitle={t('todayIs', { date: displayInstantDate(new Date(), language, c) })}
            selected={user?.calendar_pref === c}
            onClick={() => save({ calendar_pref: c })}
          />
        ))}
      </div>
      <ConfirmSheet
        open={confirm}
        question={t('signOutConfirm')}
        confirmLabel={t('signOut')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void signOut().then(() => navigate('/start', { replace: true }));
        }}
      />
    </Screen>
  );
}
