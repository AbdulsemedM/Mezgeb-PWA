import { Navigate, useParams } from 'react-router';
import { useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import { displayInstantDate } from '../../lib/dates';
import { useQueued } from '../../data/queue';
import { AmountText, BigButton, Screen, StatusPill } from '../../ui';
import { DISPUTE_KINDS } from '../disputes/DisputeScreen';
import { QueueNotice } from './QueueNotice';
import { useBook } from './BookScreen';
import {
  balanceEffect,
  entryDate,
  entryTypeLabel,
  Freshness,
  methodLabel,
  useCalendar,
  whoTook,
} from './common';

/** One purchase, payment or correction in full, with what it corrects. */
export function EntryScreen() {
  const { accountId = '', entryId = '' } = useParams();
  const { t, language } = useI18n();
  const calendar = useCalendar();
  const cached = useBook(accountId);
  const book = cached.data;
  const entry = book?.entries.find((e) => e.id === entryId);

  const corrected = entry?.ref_entry_id
    ? book?.entries.find((e) => e.id === entry.ref_entry_id)
    : undefined;
  const who = entry && book ? whoTook(t, entry, book.representatives) : null;
  const disputes = book?.disputes.filter((d) => d.entry_id === entryId) ?? [];
  const waiting = useQueued(DISPUTE_KINDS).filter(
    (w) => !w.failed && w.path === `/v1/entries/${entryId}/disputes`,
  );
  const canDispute =
    entry?.type === 'purchase' &&
    waiting.length === 0 &&
    !disputes.some((d) => d.status === 'open');

  if (book && !entry) return <Navigate to={`/shops/${accountId}`} replace />;

  return (
    <Screen
      title={entry ? entryTypeLabel(t, entry) : t('entryTitle')}
      back={`/shops/${accountId}`}
      help={{ title: t('entryTitle'), body: t('bookHelpBody') }}
      banner={
        <>
          <Freshness cached={cached} />
          <QueueNotice kinds={DISPUTE_KINDS} />
        </>
      }
      actions={
        canDispute ? (
          <BigButton
            label={t('disputeButton')}
            icon="flag"
            variant="secondary"
            to={`/shops/${accountId}/entries/${entryId}/dispute`}
          />
        ) : undefined
      }
    >
      {entry && (
        <>
          <section className="card">
            <AmountText santim={balanceEffect(entry)} size="balance" />
            <p className="muted">
              {t('entryRecordedOn', { date: entryDate(entry, language, calendar) })}
            </p>
            {who && <p>{t('entryTakenBy', { who })}</p>}
            {entry.payment_method && (
              <p>{t('entryPaidWith', { method: methodLabel(t, entry.payment_method) })}</p>
            )}
            {entry.reason && <p>{t('entryReason', { reason: entry.reason })}</p>}
            {corrected && (
              <p>
                {t('entryCorrects', {
                  date: displayInstantDate(corrected.recorded_at, language, calendar),
                })}
              </p>
            )}
            {entry.flags.some((f) => f === 'over_limit_override' || f === 'over_hard_stop') && (
              <StatusPill label={t('entryOverLimit')} tone="warn" icon="warning" />
            )}
          </section>
          {entry.lines.length > 0 && (
            <ul className="list card">
              {entry.lines.map((l) => (
                <li key={l.line_no} className="row row--between">
                  <span>
                    {l.name}
                    {l.qty && l.unit_price !== null && (
                      <span className="small muted">
                        {' '}
                        {t('entryLine', {
                          qty: `${l.qty}${l.unit ? ` ${l.unit}` : ''}`,
                          price: formatAmount(l.unit_price, language),
                        })}
                      </span>
                    )}
                  </span>
                  <AmountText santim={l.amount} />
                </li>
              ))}
            </ul>
          )}
          {(disputes.length > 0 || waiting.length > 0) && (
            <section className="stack" aria-labelledby="dispute-title">
              <h2 id="dispute-title" className="title">
                {t('disputeYours')}
              </h2>
              {waiting.map((w) => (
                <div key={w.id} className="card">
                  <p>{(w.body as { reason: string }).reason}</p>
                  <StatusPill label={t('notSentYet')} tone="warn" icon="clock" />
                </div>
              ))}
              {disputes.map((d) => (
                <div key={d.id} className="card">
                  <p>{d.reason}</p>
                  {d.status === 'open' ? (
                    <StatusPill label={t('disputeOpen')} tone="warn" icon="clock" />
                  ) : d.resolution_entry_id ? (
                    <StatusPill label={t('disputeCorrected')} tone="good" icon="check" />
                  ) : (
                    <StatusPill label={t('disputeAnswered')} tone="good" icon="check" />
                  )}
                  {d.resolution_note && <p>{t('disputeShopNote', { note: d.resolution_note })}</p>}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
