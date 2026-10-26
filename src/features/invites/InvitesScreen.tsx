import { Navigate, useNavigate } from '../../app/router';
import { signOut } from '../../auth/session';
import { useSession } from '../../auth/useSession';
import { listMyAccounts, type MyAccount, shopPlace } from '../../data/accounts';
import { useT } from '../../i18n';
import { useLoad } from '../../lib/use-load';
import { BigButton, CalmBanner, ChoiceTile, EmptyState, ErrorPanel, Screen } from '../../ui';
import { savedInvite } from '../invite/invite-api';
import { displayPhone } from '../signin/phone-digits';

/**
 * WEB-001 "Finding the invite after install": after sign-in, every pending invite for this
 * phone comes from the server, so nothing depends on the link (iPhone keeps no storage between
 * Safari and the installed app). A code saved by the invite screen puts its shop first.
 */
export function InvitesScreen() {
  const t = useT();
  const navigate = useNavigate();
  const session = useSession();
  const loaded = useLoad(async () => {
    const [accounts, saved] = await Promise.all([listMyAccounts(), savedInvite()]);
    const pending = accounts
      .filter((a) => a.status === 'pending')
      .sort((a, b) => Number(b.id === saved?.accountId) - Number(a.id === saved?.accountId));
    return {
      pending,
      hasBook: accounts.some((a) => a.status === 'active' || a.status === 'paused'),
    };
  }, []);

  const help = { title: t('invitesTitle'), body: t('invitesHelpBody') };
  const phone = session.status === 'signed-in' ? displayPhone(session.user.phone) : '';

  if (loaded.status === 'loading') {
    return (
      <Screen title={t('invitesTitle')} help={help}>
        <p role="status" className="muted">
          {t('loading')}
        </p>
      </Screen>
    );
  }
  if (loaded.status === 'offline' || loaded.status === 'error') {
    return (
      <Screen
        title={t('invitesTitle')}
        help={help}
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

  const { pending, hasBook } = loaded.data;
  if (pending.length === 0 && hasBook) return <Navigate to="/" replace />;

  if (pending.length === 0) {
    return (
      <Screen
        title={t('invitesTitle')}
        help={help}
        actions={
          <>
            <BigButton label={t('refresh')} icon="refresh" onClick={loaded.reload} />
            <BigButton
              label={t('useAnotherNumber')}
              variant="secondary"
              onClick={() => void signOut().then(() => navigate('/signin', { replace: true }))}
            />
          </>
        }
      >
        <EmptyState
          icon="store"
          message={t('invitesNone')}
          detail={t('invitesNoneBody', { phone })}
        />
        <section className="card" aria-labelledby="wrong-number">
          <h2 id="wrong-number" className="title">
            {t('wrongNumberTitle')}
          </h2>
          <p>{t('wrongNumberBody')}</p>
        </section>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('invitesTitle')}
      help={help}
      actions={
        hasBook ? <BigButton label={t('invitesContinue')} variant="secondary" to="/" /> : undefined
      }
    >
      <p>{t('invitesBody')}</p>
      <ul className="list">
        {pending.map((a: MyAccount) => (
          <li key={a.id}>
            <ChoiceTile
              title={a.shop.name}
              subtitle={shopPlace(a.shop)}
              icon="store"
              to={`/invites/${a.id}`}
            />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
