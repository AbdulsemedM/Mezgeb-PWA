import type { PaymentMethod, PaymentReport } from '../../data/book';
import { useQueued } from '../../data/queue';
import { useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import { BigButton, StatusPill } from '../../ui';
import { displayInstantDate, displayTime } from '../../lib/dates';
import { methodLabel, useCalendar } from '../book/common';

/**
 * US-10: each "I paid", newest first: waiting for the shop, confirmed, or not accepted with the
 * shop's reason and "Send again". Reports still on this phone show as not sent yet.
 */
export function ReportsList({
  accountId,
  reports,
  limit,
}: {
  accountId: string;
  reports: PaymentReport[];
  limit?: number;
}) {
  const { t, language } = useI18n();
  const calendar = useCalendar();
  const queued = useQueued(['report.create']).filter(
    (w) => !w.failed && w.path === `/v1/accounts/${accountId}/payment-reports`,
  );
  const known = new Set(reports.map((r) => r.id));
  const notSent = queued
    .map((w) => w.body as { id: string; amount: number; method: PaymentMethod })
    .filter((b) => !known.has(b.id));
  const shown = [...reports].reverse().slice(0, limit);
  if (shown.length === 0 && notSent.length === 0) return null;

  return (
    <section className="stack" aria-labelledby="reports-title">
      <h2 id="reports-title" className="title">
        {t('reportsTitle')}
      </h2>
      <ul className="list">
        {notSent.map((b) => (
          <li key={b.id} className="card">
            <p>
              {t('reportLine', {
                amount: formatAmount(b.amount, language),
                method: methodLabel(t, b.method),
              })}
            </p>
            <StatusPill label={t('notSentYet')} tone="warn" icon="clock" />
          </li>
        ))}
        {shown.map((r) => (
          <li key={r.id} className="card">
            <div className="row row--between">
              <span>
                {t('reportLine', {
                  amount: formatAmount(r.amount, language),
                  method: methodLabel(t, r.method),
                })}
              </span>
              {r.status === 'reported' && (
                <StatusPill label={t('reportStatusReported')} tone="warn" icon="clock" />
              )}
              {r.status === 'confirmed' && (
                <StatusPill label={t('reportStatusConfirmed')} tone="good" icon="check" />
              )}
              {r.status === 'rejected' && (
                <StatusPill label={t('reportStatusRejected')} tone="crit" icon="close" />
              )}
            </div>
            <p className="small muted">
              {displayInstantDate(r.created_at, language, calendar)} {displayTime(r.created_at)}
              {r.has_receipt ? ` · ${t('reportHasPhoto')}` : ''}
            </p>
            {r.status === 'rejected' && (
              <>
                {r.reject_reason && <p>{t('reportRejectedReason', { reason: r.reject_reason })}</p>}
                {!reports.some((x) => x.resubmitted_from_id === r.id) && (
                  <BigButton
                    label={t('reportSendAgain')}
                    icon="refresh"
                    variant="secondary"
                    to={`/shops/${accountId}/pay?again=${r.id}`}
                  />
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
