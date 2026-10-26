import { useCallback, useEffect, useState } from 'react';
import { useParams } from '../../app/router';
import { useI18n } from '../../i18n';
import { BigButton, CalmBanner, EmptyState, ErrorPanel, Screen, SupportButton } from '../../ui';
import { isStandalone } from '../install/install-prompt';
import { LanguagePicker } from '../start/LanguagePicker';
import { type InviteLookup, lookUpInvite } from './invite-api';

/** Where "Continue" goes: install first (WEB-001), unless this already is the installed app. */
export function afterInvitePath(): string {
  return isStandalone() ? '/signin' : '/install';
}

/**
 * WEB-001 step 2: the SMS link `/i/<code>`. The shop's name, one plain sentence and the
 * language choice; these taps also help Chrome treat the page as installable.
 */
export function InviteScreen() {
  const { code = '' } = useParams();
  const { t, chosen, setLanguage } = useI18n();
  const [lookup, setLookup] = useState<InviteLookup | 'loading' | 'error'>('loading');

  const fetchInvite = useCallback(() => {
    lookUpInvite(code).then(
      (result) => {
        // The shop chose the SMS language: start there unless the person already chose.
        if (result.kind === 'found' && !chosen) setLanguage(result.invite.language);
        setLookup(result);
      },
      () => setLookup('error'),
    );
    // Only on a new code: changing the language must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(fetchInvite, [fetchInvite]);

  const load = () => {
    setLookup('loading');
    fetchInvite();
  };

  const help = { title: t('helpButton'), body: t('inviteHelpBody') };

  if (lookup === 'loading') {
    return (
      <Screen title={t('appTitle')} help={help}>
        <p role="status" className="muted">
          {t('inviteChecking')}
        </p>
      </Screen>
    );
  }
  if (lookup === 'error') {
    return (
      <Screen title={t('appTitle')} help={help}>
        <ErrorPanel onRetry={load} />
      </Screen>
    );
  }
  if (lookup.kind === 'offline') {
    return (
      <Screen
        title={t('appTitle')}
        help={help}
        actions={<BigButton label={t('tryAgain')} icon="refresh" onClick={load} />}
      >
        <CalmBanner message={t('inviteOfflineBody')} />
      </Screen>
    );
  }
  if (lookup.kind === 'not-found') {
    return (
      <Screen
        title={t('inviteNotFoundTitle')}
        help={help}
        actions={
          <>
            <SupportButton variant="primary" />
            <BigButton label={t('inviteContinue')} variant="quiet" to={afterInvitePath()} />
          </>
        }
      >
        <EmptyState
          icon="info"
          message={t('inviteNotFoundTitle')}
          detail={t('inviteNotFoundBody')}
        />
      </Screen>
    );
  }

  const { invite } = lookup;
  const shop = invite.shop.name;
  const continueButton = (
    <BigButton
      label={t('inviteContinue')}
      to={invite.state === 'accepted' && isStandalone() ? '/' : afterInvitePath()}
    />
  );

  if (invite.state === 'closed') {
    return (
      <Screen
        title={t('inviteClosedTitle')}
        help={help}
        actions={<SupportButton variant="primary" />}
      >
        <EmptyState
          icon="info"
          message={t('inviteClosedTitle')}
          detail={t('inviteClosedBody', { shop })}
        />
      </Screen>
    );
  }
  if (invite.state === 'accepted') {
    return (
      <Screen title={t('inviteAcceptedTitle', { shop })} help={help} actions={continueButton}>
        <EmptyState
          icon="check"
          message={t('inviteAcceptedTitle', { shop })}
          detail={t('inviteAcceptedBody')}
        />
      </Screen>
    );
  }

  const expired = invite.state === 'expired';
  return (
    <Screen
      title={t('appTitle')}
      help={help}
      actions={continueButton}
      banner={lookup.fromCache ? <CalmBanner message={t('noInternetShowingSaved')} /> : undefined}
    >
      <div className="card">
        <p className="headline">{expired ? t('inviteExpiredTitle') : t('inviteTitle', { shop })}</p>
        <p>{expired ? t('inviteExpiredBody') : t('inviteBody')}</p>
      </div>
      <h2 className="title">{t('chooseLanguageTitle')}</h2>
      <LanguagePicker />
    </Screen>
  );
}
