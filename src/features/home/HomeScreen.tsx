import { Link } from 'react-router';
import { shopPlace } from '../../data/accounts';
import { fetchHome, type HomeData, type PaymeRequest } from '../../data/book';
import { useCached } from '../../data/use-cached';
import { useI18n } from '../../i18n';
import { displayDate } from '../../lib/dates';
import { formatAmount } from '../../lib/money';
import { AmountText, BigButton, ChoiceTile, EmptyState, Icon, Screen } from '../../ui';
import {
  Freshness,
  LimitBlock,
  PullIndicator,
  RefreshRow,
  useCalendar,
  usePullToRefresh,
} from '../book/common';
import { isStandalone } from '../install/install-prompt';

/** Pay-me requests still waiting for the customer (PAY-1). */
export const OPEN_PAYME: PaymeRequest['status'][] = ['sent', 'seen', 'partially_paid'];

/** W4: My shops. Each shop's balance, limit and due date; what needs attention first. */
export function HomeScreen() {
  const { t } = useI18n();
  const cached = useCached<HomeData>('home', fetchHome);
  const pull = usePullToRefresh(() => void cached.refresh());
  const data = cached.data;
  const open = data?.accounts.filter((a) => a.status === 'active' || a.status === 'paused') ?? [];
  const pending = data?.accounts.filter((a) => a.status === 'pending') ?? [];
  const asks = data?.payme.filter((p) => OPEN_PAYME.includes(p.status)) ?? [];

  return (
    <Screen
      title={t('homeTitle')}
      help={{ title: t('homeTitle'), body: t('homeHelpBody') }}
      banner={<Freshness cached={cached} />}
    >
      <PullIndicator pull={pull} />
      {data === undefined && cached.refreshing && (
        <p role="status" className="muted">
          {t('loading')}
        </p>
      )}

      {pending.length > 0 && (
        <section className="card" style={{ borderColor: 'var(--ledger)' }}>
          <p className="title">{t('invitedBanner', { count: pending.length })}</p>
          <p className="muted">{pending.map((a) => a.shop.name).join(', ')}</p>
          <BigButton label={t('invitedBannerAction')} to="/invites" />
        </section>
      )}

      {asks.map((p) => {
        const shop = data!.accounts.find((a) => a.id === p.account_id)!;
        return <PaymeCard key={p.id} request={p} shop={shop.shop.name} />;
      })}

      {open.length > 0 ? (
        <ul className="list" aria-label={t('homeTitle')}>
          {open.map((a) => (
            <li key={a.id}>
              <Link
                className="card"
                to={`/shops/${a.id}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <span className="row row--between">
                  <span className="title">{a.shop.name}</span>
                  <Icon name="chevron" />
                </span>
                {shopPlace(a.shop) && <span className="small muted">{shopPlace(a.shop)}</span>}
                <span className="small muted">{t('balanceLabel')}</span>
                <AmountText santim={a.balance_santim} size="balance" />
                {data!.limits[a.id] && (
                  <LimitBlock balance={a.balance_santim} limits={data!.limits[a.id]!} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        data !== undefined &&
        pending.length === 0 && (
          <EmptyState icon="book" message={t('myShopsEmpty')} detail={t('myShopsEmptyBody')} />
        )
      )}

      {!isStandalone() && (
        <section className="card">
          <p>{t('installLaterBody')}</p>
          <BigButton label={t('installLater')} icon="download" variant="secondary" to="/install" />
        </section>
      )}

      <RefreshRow cached={cached} />
      <ChoiceTile title={t('settingsTitle')} icon="settings" to="/settings" />
    </Screen>
  );
}

function PaymeCard({ request, shop }: { request: PaymeRequest; shop: string }) {
  const { t, language } = useI18n();
  const calendar = useCalendar();
  return (
    <section
      className="card"
      style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)' }}
    >
      <p className="title">
        {t('paymeCard', { shop, amount: formatAmount(request.amount, language) })}
      </p>
      {request.message && <p>{request.message}</p>}
      {request.due_date && (
        <p>{t('payBy', { date: displayDate(request.due_date, language, calendar) })}</p>
      )}
      {request.payment_details && (
        <p className="small">{t('paymeHowToPay', { details: request.payment_details })}</p>
      )}
      <BigButton label={shop} icon="book" variant="secondary" to={`/shops/${request.account_id}`} />
    </section>
  );
}
