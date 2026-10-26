import { useState } from 'react';
import { Navigate, useNavigate, useParams } from '../../app/router';
import { ApiError, OfflineError } from '../../api/client';
import { acceptInvite, listMyAccounts } from '../../data/accounts';
import { useT } from '../../i18n';
import { useLoad } from '../../lib/use-load';
import { BigButton, CalmBanner, ErrorPanel, Icon, Screen, useSuccess } from '../../ui';

/**
 * US-02: the dube agreement in plain language, then "I agree" opens the dube book with that
 * shop. Online only: accepting changes the account for both sides.
 */
export function TermsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const success = useSuccess();
  const { accountId = '' } = useParams();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'offline' | 'outdated' | 'error' | null>(null);
  const loaded = useLoad(
    async () => (await listMyAccounts()).find((a) => a.id === accountId) ?? null,
    [accountId],
  );

  const help = { title: t('termsTitle'), body: t('termsHelpBody') };

  if (loaded.status === 'loading') {
    return (
      <Screen title={t('termsTitle')} help={help} back="/invites">
        <p role="status" className="muted">
          {t('loading')}
        </p>
      </Screen>
    );
  }
  if (loaded.status !== 'ready') {
    return (
      <Screen
        title={t('termsTitle')}
        help={help}
        back="/invites"
        actions={<BigButton label={t('tryAgain')} icon="refresh" onClick={loaded.reload} />}
      >
        {loaded.status === 'offline' ? (
          <CalmBanner message={t('needInternetAction')} />
        ) : (
          <ErrorPanel />
        )}
      </Screen>
    );
  }
  const account = loaded.data;
  if (!account || account.status !== 'pending') return <Navigate to="/invites" replace />;

  async function agree() {
    setBusy(true);
    setProblem(null);
    try {
      await acceptInvite(accountId);
      success(t('joinedShop', { shop: account!.shop.name }));
      navigate('/invites', { replace: true });
    } catch (err) {
      setBusy(false);
      if (err instanceof OfflineError) setProblem('offline');
      else if (err instanceof ApiError && err.code === 'terms_outdated') setProblem('outdated');
      else setProblem('error');
    }
  }

  const points = ['termsPoint1', 'termsPoint2', 'termsPoint3', 'termsPoint4'] as const;
  return (
    <Screen
      title={t('termsTitle')}
      help={help}
      back="/invites"
      actions={
        <BigButton
          label={t('termsAgree')}
          busy={busy}
          busyLabel={t('sending')}
          onClick={() => void agree()}
        />
      }
    >
      <p className="headline">{t('termsShop', { shop: account.shop.name })}</p>
      <ul className="list">
        {points.map((p) => (
          <li key={p} className="row" style={{ alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--good)' }}>
              <Icon name="check" />
            </span>
            <span>{t(p)}</span>
          </li>
        ))}
      </ul>
      {problem === 'offline' && <CalmBanner message={t('needInternetAction')} />}
      {problem === 'outdated' && (
        <ErrorPanel what={t('termsOutdatedWhat')} whatToDo={t('termsOutdatedToDo')} />
      )}
      {problem === 'error' && <ErrorPanel onRetry={() => void agree()} />}
    </Screen>
  );
}
