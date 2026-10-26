import { Navigate, useParams } from 'react-router';
import { useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import { displayInstantDate } from '../../lib/dates';
import { AmountText, Screen, StatusPill } from '../../ui';
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
  if (book && !entry) return <Navigate to={`/shops/${accountId}`} replace />;

  const corrected = entry?.ref_entry_id
    ? book?.entries.find((e) => e.id === entry.ref_entry_id)
    : undefined;
  const who = entry && book ? whoTook(t, entry, book.representatives) : null;

  return (
    <Screen
      title={entry ? entryTypeLabel(t, entry) : t('entryTitle')}
      back={`/shops/${accountId}`}
      help={{ title: t('entryTitle'), body: t('bookHelpBody') }}
      banner={<Freshness cached={cached} />}
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
        </>
      )}
    </Screen>
  );
}
