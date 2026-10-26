import { useState } from 'react';
import { api, ApiError, OfflineError } from '../../api/client';
import type { Raise } from '../../data/book';
import { useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import { BigButton, CalmBanner, useSuccess } from '../../ui';

/** Waiting requests worth showing: pending and not past their 15 minutes. */
export function openRaises(raises: Raise[], now = Date.now()): Raise[] {
  return raises.filter((r) => r.status === 'pending' && Date.parse(r.expires_at) > now);
}

/**
 * ADR-011 / LIM-3: the shop asks to sell over the customer's hard stop once. The customer
 * approves here without a code. Online only (WEB-001): the shop is waiting at the counter.
 */
export function RaiseCard({
  raise,
  shop,
  onDone,
}: {
  raise: Raise;
  shop: string;
  onDone: () => void;
}) {
  const { t, language } = useI18n();
  const success = useSuccess();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'offline' | 'expired' | 'error' | null>(null);

  async function approve() {
    setBusy(true);
    setProblem(null);
    try {
      await api('POST', `/v1/accounts/${raise.account_id}/raises/${raise.id}/approve`, {
        body: {},
      });
      success(t('raiseApproved', { shop }));
      onDone();
    } catch (err) {
      if (err instanceof OfflineError) setProblem('offline');
      else if (err instanceof ApiError && (err.code === 'raise_expired' || err.status === 404)) {
        setProblem('expired');
      } else setProblem('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="card"
      style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)' }}
    >
      <p className="title">{t('raiseCardTitle')}</p>
      <p>{t('raiseCardBody', { shop, amount: formatAmount(raise.amount, language) })}</p>
      <p className="small muted">{t('raiseExpiresHint')}</p>
      {problem === 'offline' && <CalmBanner message={t('needInternetAction')} />}
      {problem === 'expired' && <CalmBanner icon="info" message={t('raiseExpired')} />}
      {problem === 'error' && (
        <CalmBanner
          tone="warn"
          icon="warning"
          message={`${t('errorGenericWhat')} ${t('errorGenericWhatToDo')}`}
        />
      )}
      {problem !== 'expired' && (
        <BigButton
          label={t('raiseApprove')}
          busy={busy}
          busyLabel={t('sending')}
          onClick={() => void approve()}
        />
      )}
    </section>
  );
}
