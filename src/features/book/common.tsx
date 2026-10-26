import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../auth/useSession';
import type { Cached } from '../../data/use-cached';
import type { Entry, Limits, PaymentMethod, Representative } from '../../data/book';
import { type Language, type MessageKey, type Translate, useI18n } from '../../i18n';
import {
  type CalendarPref,
  displayDate,
  displayInstantDate,
  displayTime,
  displayWhen,
} from '../../lib/dates';
import { formatAmount } from '../../lib/money';
import { BigButton, CalmBanner, ErrorPanel, LimitUsageBar, StatusPill } from '../../ui';

/** The reader's calendar (ADR-003); Gregorian until they choose. */
export function useCalendar(): CalendarPref {
  const session = useSession();
  return session.status === 'signed-in' ? (session.user.calendar_pref ?? 'gregorian') : 'gregorian';
}

/** Balance against the stricter limit, in colour AND words AND an icon, and the due date. */
export function LimitBlock({ balance, limits }: { balance: number; limits: Limits }) {
  const { t, language } = useI18n();
  const calendar = useCalendar();
  const { value, time } = limits.state;
  const limit = value.effective_limit;
  return (
    <div className="stack">
      {limit !== null && limit > 0 ? (
        <>
          <LimitUsageBar
            label={t('limitsTitle')}
            used={balance / limit}
            words={
              balance >= limit
                ? t('limitReached')
                : t('limitUsed', { percent: Math.max(0, Math.floor((balance / limit) * 100)) })
            }
          />
          <p className="small muted">{t('limitOf', { amount: formatAmount(limit, language) })}</p>
        </>
      ) : (
        <p className="small muted">{t('limitNone')}</p>
      )}
      {time.due_date && time.state !== 'none' && (
        <p className="row" style={{ flexWrap: 'wrap' }}>
          <span>{t('payBy', { date: displayDate(time.due_date, language, calendar) })}</span>
          {time.state === 'due_soon' && (
            <StatusPill label={t('dueSoon')} tone="warn" icon="clock" />
          )}
          {time.state === 'due' && <StatusPill label={t('dueToday')} tone="warn" icon="clock" />}
          {time.state === 'overdue' && (
            <StatusPill label={t('overdue')} tone="crit" icon="warning" />
          )}
        </p>
      )}
    </div>
  );
}

/**
 * WEB-001 offline: what was saved shows with "Last updated", calm, with a visible Refresh.
 * Nothing saved and no internet: a calm note and Try again. A refusal: the error panel.
 */
export function Freshness<T>({ cached }: { cached: Cached<T> }) {
  const { t, language } = useI18n();
  const calendar = useCalendar();
  const when = cached.savedAt ? displayWhen(cached.savedAt, language, calendar) : null;
  if (cached.offline) {
    return cached.data !== undefined ? (
      <CalmBanner
        message={t('noInternetShowingSaved')}
        detail={when ? t('lastUpdated', { time: when }) : undefined}
        action={{ label: t('refresh'), onClick: () => void cached.refresh() }}
      />
    ) : (
      <CalmBanner
        message={t('needInternetAction')}
        action={{ label: t('tryAgain'), onClick: () => void cached.refresh() }}
      />
    );
  }
  if (cached.error && cached.data === undefined)
    return <ErrorPanel onRetry={() => void cached.refresh()} />;
  return null;
}

/** The visible Refresh button with "Last updated" (pull-to-refresh is only a shortcut). */
export function RefreshRow<T>({ cached }: { cached: Cached<T> }) {
  const { t, language } = useI18n();
  const calendar = useCalendar();
  return (
    <div className="row row--between" style={{ flexWrap: 'wrap' }}>
      <span className="small muted" aria-live="polite">
        {cached.refreshing
          ? t('refreshing')
          : cached.savedAt
            ? t('lastUpdated', { time: displayWhen(cached.savedAt, language, calendar) })
            : ''}
      </span>
      <div style={{ minWidth: '10rem' }}>
        <BigButton
          label={t('refresh')}
          icon="refresh"
          variant="secondary"
          disabled={cached.refreshing}
          onClick={() => void cached.refresh()}
        />
      </div>
    </div>
  );
}

/** Pull down at the top of the page to refresh; returns the pull distance for an indicator. */
export function usePullToRefresh(onRefresh: () => void, threshold = 80): number {
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const cb = useRef(onRefresh);
  useEffect(() => {
    cb.current = onRefresh;
  });
  useEffect(() => {
    let distance = 0;
    const down = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 ? (e.touches[0]?.clientY ?? null) : null;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      distance = Math.max(0, (e.touches[0]?.clientY ?? 0) - start.current);
      setPull(Math.min(distance, threshold * 1.5));
    };
    const up = () => {
      if (start.current !== null && distance >= threshold) cb.current();
      start.current = null;
      distance = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [threshold]);
  return pull;
}

export function PullIndicator({ pull }: { pull: number }) {
  const t = useI18n().t;
  return (
    <div
      className="pull small"
      style={{ height: pull ? Math.min(pull, 60) : 0 }}
      aria-hidden="true"
    >
      {t('pullToRefresh')}
    </div>
  );
}

const METHOD_KEYS: Record<PaymentMethod, MessageKey> = {
  cash: 'methodCash',
  telebirr: 'methodTelebirr',
  cbe_birr: 'methodCbeBirr',
  mpesa: 'methodMpesa',
  bank_transfer: 'methodBank',
  other: 'methodOther',
};

export function methodLabel(t: Translate, method: PaymentMethod): string {
  return t(METHOD_KEYS[method]);
}

export function entryTypeLabel(t: Translate, e: Entry): string {
  return t(
    e.type === 'purchase'
      ? 'entryPurchase'
      : e.type === 'payment'
        ? 'entryPayment'
        : 'entryCorrection',
  );
}

/** Who took the goods, by the name the customer knows (MOB-002 §4). */
export function whoTook(t: Translate, e: Entry, reps: Representative[]): string | null {
  if (e.type !== 'purchase') return null;
  if (e.taken_by_type === 'delivery') return t('whoDelivery');
  if (e.taken_by_type === 'representative') {
    return reps.find((r) => r.id === e.representative_id)?.name ?? t('whoSomeone');
  }
  return t('whoMe');
}

/** What the entry does to the balance: payments lower it (ADR-004). */
export function balanceEffect(e: Entry): number {
  return e.type === 'payment' ? -e.amount : e.amount;
}

/** "12 Tikimt 2019 10:42": an entry always shows its date and time. */
export function entryDate(e: Entry, language: Language, calendar: CalendarPref): string {
  return `${displayInstantDate(e.recorded_at, language, calendar)} ${displayTime(e.recorded_at)}`;
}
