import { useState } from 'react';
import { useParams } from 'react-router';
import type { Order } from '../../data/book';
import { enqueue, savedText, useQueued } from '../../data/queue';
import { type MessageKey, useI18n } from '../../i18n';
import { displayInstantDate } from '../../lib/dates';
import { formatAmount } from '../../lib/money';
import {
  AmountText,
  BigButton,
  EmptyState,
  Screen,
  Sheet,
  StatusPill,
  TextField,
  useSuccess,
} from '../../ui';
import { useBook } from '../book/BookScreen';
import { Freshness, useCalendar } from '../book/common';
import { QueueNotice } from '../book/QueueNotice';
import { ORDER_KINDS } from './NewOrderScreen';

const STEPS: Order['status'][] = ['sent', 'accepted', 'priced', 'out_for_delivery', 'delivered'];
export const ORDER_STATUS_KEYS: Record<Order['status'], MessageKey> = {
  sent: 'orderStatusNew',
  accepted: 'orderStatusAccepted',
  priced: 'orderStatusPriced',
  out_for_delivery: 'orderStatusOut',
  delivered: 'orderStatusDelivered',
  declined: 'orderStatusDeclined',
};

/** ORD-1..4 (US-12): my orders with their status, the priced list, and "received". */
export function OrdersScreen() {
  const { accountId = '' } = useParams();
  const { t, language } = useI18n();
  const calendar = useCalendar();
  const cached = useBook(accountId);
  const queued = useQueued(ORDER_KINDS).filter((w) => !w.failed);
  const notSent = queued.filter((w) => w.kind === 'order.create' && w.path.includes(accountId));
  const orders = [...(cached.data?.orders ?? [])].reverse();

  return (
    <Screen
      title={t('ordersTitle')}
      back={`/shops/${accountId}`}
      help={{ title: t('ordersTitle'), body: t('ordersHelpBody') }}
      banner={
        <>
          <Freshness cached={cached} />
          <QueueNotice kinds={ORDER_KINDS} />
        </>
      }
      actions={<BigButton label={t('newOrder')} icon="add" to={`/shops/${accountId}/orders/new`} />}
    >
      {orders.length === 0 && notSent.length === 0 && cached.data && (
        <EmptyState icon="delivery" message={t('ordersNone')} detail={t('ordersHelpBody')} />
      )}
      <ul className="list">
        {notSent.map((w) => {
          const body = w.body as { id: string; lines: unknown[] };
          return (
            <li key={body.id} className="card">
              <p className="title">{t('orderItemCount', { count: body.lines.length })}</p>
              <StatusPill label={t('notSentYet')} tone="warn" icon="clock" />
            </li>
          );
        })}
        {orders.map((o) => (
          <li key={o.id}>
            <OrderCard
              order={o}
              confirmedHere={queued.some((w) => w.path === `/v1/orders/${o.id}/receipt`)}
              date={displayInstantDate(o.created_at, language, calendar)}
            />
          </li>
        ))}
      </ul>
    </Screen>
  );
}

function OrderCard({
  order,
  confirmedHere,
  date,
}: {
  order: Order;
  confirmedHere: boolean;
  date: string;
}) {
  const { t, language } = useI18n();
  const success = useSuccess();
  const [missingOpen, setMissingOpen] = useState(false);
  const [missing, setMissing] = useState('');
  const step = STEPS.indexOf(order.status);
  const priced = order.lines.some((l) => l.amount !== undefined);
  const total = order.lines.reduce((sum, l) => sum + (l.unavailable ? 0 : (l.amount ?? 0)), 0);

  async function receipt(missingText?: string) {
    await enqueue({
      kind: 'order.receipt',
      method: 'POST',
      path: `/v1/orders/${order.id}/receipt`,
      body: missingText ? { missing: missingText } : {},
      refresh: [`book:${order.account_id}`],
    });
    success(savedText(t, t(missingText ? 'orderMissingSaved' : 'orderReceivedSaved')));
  }

  return (
    <section className="card">
      <div className="row row--between">
        <span className="title">{t('orderItemCount', { count: order.lines.length })}</span>
        <StatusPill
          label={t(ORDER_STATUS_KEYS[order.status])}
          tone={
            order.status === 'declined' ? 'crit' : order.status === 'delivered' ? 'good' : 'warn'
          }
          icon={
            order.status === 'declined' ? 'close' : order.status === 'delivered' ? 'check' : 'clock'
          }
        />
      </div>
      <p className="small muted">{date}</p>
      {order.status !== 'declined' && (
        <div className="steps-track" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`steps-track__step${i <= step ? ' steps-track__step--done' : ''}`}
            />
          ))}
        </div>
      )}
      {order.status === 'declined' && order.decline_reason && (
        <p>{t('orderDeclinedReason', { reason: order.decline_reason })}</p>
      )}
      <ul className="list">
        {order.lines.map((l, i) => (
          <li key={i} className="row row--between small">
            <span>
              {l.qty ? `${l.qty} ` : ''}
              {l.unit ? `${l.unit} ` : ''}
              {l.name}
            </span>
            {l.unavailable ? (
              <StatusPill label={t('orderUnavailable')} icon="close" />
            ) : (
              l.amount !== undefined && <AmountText santim={l.amount} />
            )}
          </li>
        ))}
      </ul>
      {priced && (
        <p className="title">{t('orderPricedTotal', { amount: formatAmount(total, language) })}</p>
      )}
      {order.delivery_person && (
        <p className="small">{t('orderDeliveryPerson', { name: order.delivery_person })}</p>
      )}
      {order.status === 'delivered' &&
        (order.receipt_confirmed_at || confirmedHere ? (
          <p className="small muted">{t('orderReceiptDone')}</p>
        ) : (
          <div className="stack">
            <BigButton label={t('orderReceived')} icon="check" onClick={() => void receipt()} />
            <BigButton
              label={t('orderMissing')}
              variant="secondary"
              onClick={() => setMissingOpen(true)}
            />
          </div>
        ))}
      <Sheet
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        title={t('orderMissingTitle')}
      >
        <TextField
          label={t('orderMissingTitle')}
          hint={t('orderMissingHint')}
          value={missing}
          maxLength={280}
          onInput={(e) => setMissing((e.target as HTMLInputElement).value)}
        />
        <div className="sheet__actions">
          <BigButton
            label={t('orderMissingSend')}
            disabled={!missing.trim()}
            onClick={() => {
              setMissingOpen(false);
              void receipt(missing.trim());
            }}
          />
          <BigButton
            label={t('confirmNo')}
            variant="secondary"
            onClick={() => setMissingOpen(false)}
          />
        </div>
      </Sheet>
    </section>
  );
}
