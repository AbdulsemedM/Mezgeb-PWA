import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api/client';
import { type Book, type Entry, fetchBook, type Representative } from '../../data/book';
import { useCached } from '../../data/use-cached';
import { useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import {
  AmountText,
  ChoiceTile,
  Chips,
  EmptyState,
  Icon,
  Screen,
  Segmented,
  StatusPill,
} from '../../ui';
import { LIMIT_KINDS } from '../limits/LimitsScreen';
import { openRaises, RaiseCard } from '../limits/RaiseCard';
import { REP_KINDS } from '../people/PeopleScreen';
import { QueueNotice } from './QueueNotice';
import { PAY_KINDS } from '../payments/PayScreen';
import { ReportsList } from '../payments/ReportsList';
import { useMarkSeen } from '../payments/use-mark-seen';
import {
  balanceEffect,
  entryDate,
  entryTypeLabel,
  Freshness,
  LimitBlock,
  methodLabel,
  PullIndicator,
  RefreshRow,
  useCalendar,
  usePullToRefresh,
  whoTook,
} from './common';

type View = 'simple' | 'detailed';

export function useBook(accountId: string) {
  return useCached<Book>(`book:${accountId}`, () => fetchBook(accountId));
}

/** W4: one shop's dube book, newest first, with who took each purchase (US-07). */
export function BookScreen() {
  const { accountId = '' } = useParams();
  const { t } = useI18n();
  const cached = useBook(accountId);
  const pull = usePullToRefresh(() => void cached.refresh());
  const book = cached.data;
  const [view, setView] = useState<View | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useMarkSeen(book?.payme ?? []);

  const shownView: View = view ?? book?.account.customer_detail_view ?? 'simple';
  function changeView(next: View) {
    setView(next);
    // The customer's own view preference (ADR-006); kept on this phone if offline.
    void api('PATCH', `/v1/accounts/${accountId}`, { body: { customer_detail_view: next } }).catch(
      () => undefined,
    );
  }

  const entries = [...(book?.entries ?? [])].reverse().filter((e) => {
    if (filter === 'all') return true;
    if (e.type !== 'purchase') return false;
    if (filter === 'me') return e.taken_by_type === 'customer';
    if (filter === 'delivery') return e.taken_by_type === 'delivery';
    return e.representative_id === filter;
  });
  const reps = book?.representatives ?? [];
  const filters = [
    { value: 'all', label: t('filterAll') },
    { value: 'me', label: t('filterMe') },
    ...reps.filter((r) => r.status !== 'revoked').map((r) => ({ value: r.id, label: r.name })),
    ...(book?.entries.some((e) => e.taken_by_type === 'delivery')
      ? [{ value: 'delivery', label: t('filterDelivery') }]
      : []),
  ];

  return (
    <Screen
      title={book?.account.shop.name ?? t('ledgerTitle')}
      back="/"
      help={{ title: t('ledgerTitle'), body: t('bookHelpBody') }}
      banner={
        <>
          <Freshness cached={cached} />
          <QueueNotice kinds={[...LIMIT_KINDS, ...REP_KINDS, ...PAY_KINDS]} />
        </>
      }
    >
      <PullIndicator pull={pull} />
      {book === undefined && cached.refreshing && (
        <p role="status" className="muted">
          {t('loading')}
        </p>
      )}
      {book && (
        <>
          <section className="card">
            <span className="small muted">{t('balanceLabel')}</span>
            <AmountText santim={book.account.balance_santim} size="balance" />
            <LimitBlock balance={book.account.balance_santim} limits={book.limits} />
          </section>

          {openRaises(book.raises).map((r) => (
            <RaiseCard
              key={r.id}
              raise={r}
              shop={book.account.shop.name}
              onDone={() => void cached.refresh()}
            />
          ))}

          <nav className="list" aria-label={book.account.shop.name}>
            <ChoiceTile title={t('bookActionPay')} icon="money" to={`/shops/${accountId}/pay`} />
            <ChoiceTile
              title={t('bookActionLimits')}
              icon="settings"
              to={`/shops/${accountId}/limits`}
            />
            <ChoiceTile
              title={t('bookActionPeople')}
              icon="people"
              to={`/shops/${accountId}/people`}
            />
          </nav>

          <ReportsList accountId={accountId} reports={book.reports} limit={3} />

          <h2 className="title">{t('ledgerTitle')}</h2>
          <Segmented
            label={t('ledgerTitle')}
            value={shownView}
            onChange={changeView}
            options={[
              { value: 'simple', label: t('viewSimple') },
              { value: 'detailed', label: t('viewDetailed') },
            ]}
          />
          {filters.length > 2 && (
            <Chips label={t('ledgerTitle')} value={filter} onChange={setFilter} options={filters} />
          )}
          {entries.length === 0 ? (
            <EmptyState
              icon="book"
              message={filter === 'all' ? t('entriesNone') : t('entriesNoneFiltered')}
            />
          ) : (
            <ul className="list">
              {entries.map((e) => (
                <li key={e.id}>
                  <EntryRow entry={e} reps={reps} view={shownView} accountId={accountId} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <RefreshRow cached={cached} />
    </Screen>
  );
}

function EntryRow({
  entry,
  reps,
  view,
  accountId,
}: {
  entry: Entry;
  reps: Representative[];
  view: View;
  accountId: string;
}) {
  const { t, language } = useI18n();
  const calendar = useCalendar();
  const who = whoTook(t, entry, reps);
  const effect = balanceEffect(entry);
  const [first] = entry.lines;
  return (
    <Link className="entry" to={`/shops/${accountId}/entries/${entry.id}`}>
      <span className="entry__text">
        <span className="row row--between">
          <strong>{entryTypeLabel(t, entry)}</strong>
          <AmountText
            santim={effect}
            className={effect < 0 ? 'entry__amount--credit' : undefined}
          />
        </span>
        <span className="small muted">{entryDate(entry, language, calendar)}</span>
        {who && <span className="small">{t('entryTakenBy', { who })}</span>}
        {entry.payment_method && (
          <span className="small">
            {t('entryPaidWith', { method: methodLabel(t, entry.payment_method) })}
          </span>
        )}
        {view === 'simple' && first && (
          <span className="small">
            {entry.lines.length > 1
              ? t('entryItemsMore', { first: first.name, count: entry.lines.length - 1 })
              : first.name}
          </span>
        )}
        {view === 'detailed' &&
          entry.lines.map((l) => (
            <span key={l.line_no} className="small row row--between">
              <span>
                {l.name}
                {l.qty && l.unit_price !== null && (
                  <span className="muted">
                    {' '}
                    (
                    {t('entryLine', {
                      qty: `${l.qty}${l.unit ? ` ${l.unit}` : ''}`,
                      price: formatAmount(l.unit_price, language),
                    })}
                    )
                  </span>
                )}
              </span>
              <AmountText santim={l.amount} />
            </span>
          ))}
        {entry.reason && (
          <span className="small muted">{t('entryReason', { reason: entry.reason })}</span>
        )}
        {entry.flags.some((f) => f === 'over_limit_override' || f === 'over_hard_stop') && (
          <StatusPill label={t('entryOverLimit')} tone="warn" icon="warning" />
        )}
      </span>
      <Icon name="chevron" />
    </Link>
  );
}
