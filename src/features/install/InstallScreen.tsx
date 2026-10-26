import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useT } from '../../i18n';
import { BigButton, CalmBanner, Screen } from '../../ui';
import {
  ChromeMenuButtonPicture,
  ChromeMenuItemPicture,
  IphoneAddToHomePicture,
  IphoneShareButtonPicture,
} from './GuidePictures';
import {
  installPromptReady,
  isStandalone,
  onInstallChange,
  promptInstall,
  wasInstalled,
} from './install-prompt';
import { chromeIntentUrl, currentInstallPath, type InstallPath } from './platform';

/**
 * How long "Getting ready…" waits for Chrome's prompt after the tap. Chrome lets prompt() run
 * only within ~5 s of a tap (transient activation), so we stop a little before that.
 */
export const PROMPT_WAIT_MS = 4500;

type Phase = 'offer' | 'waiting' | 'guide' | 'dismissed';

/** WEB-001 step 3: one big button, a fallback for every browser, and never a dead end. */
export function InstallScreen({ path = currentInstallPath() }: { path?: InstallPath }) {
  const t = useT();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>(path === 'android-chromium' ? 'offer' : 'guide');

  // Installed from the browser menu or by the prompt: go to the "open it from there" screen.
  useEffect(
    () =>
      onInstallChange(() => {
        if (wasInstalled()) navigate('/installed', { replace: true });
      }),
    [navigate],
  );

  // "Getting ready…": prompt as soon as Chrome offers it, else show the menu guide.
  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = setTimeout(() => setPhase('guide'), PROMPT_WAIT_MS);
    const off = onInstallChange(() => {
      if (installPromptReady()) {
        clearTimeout(timer);
        off();
        void runPrompt();
      }
    });
    return () => {
      clearTimeout(timer);
      off();
    };
    // runPrompt only changes the phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (isStandalone()) return <Navigate to="/signin" replace />;
  if (wasInstalled()) return <Navigate to="/installed" replace />;

  async function runPrompt() {
    const outcome = await promptInstall();
    if (outcome === 'accepted') navigate('/installed', { replace: true });
    else if (outcome === 'dismissed') setPhase('dismissed');
    else setPhase('guide');
  }

  function onInstallTap() {
    if (installPromptReady()) void runPrompt();
    else setPhase('waiting');
  }

  const continueInBrowser = (
    <BigButton label={t('installContinueInBrowser')} variant="quiet" to="/signin" />
  );
  const help = { title: t('installTitle'), body: t('installHelpBody') };

  if (path === 'android-in-app') {
    return (
      <Screen
        title={t('installInAppTitle')}
        help={help}
        actions={
          <>
            <BigButton
              label={t('installOpenInChrome')}
              icon="openExternal"
              href={chromeIntentUrl(window.location.href)}
            />
            {continueInBrowser}
          </>
        }
      >
        <p>{t('installInAppBody')}</p>
      </Screen>
    );
  }

  if (path === 'android-chromium' && (phase === 'offer' || phase === 'waiting')) {
    return (
      <Screen
        title={t('installTitle')}
        help={help}
        actions={
          <>
            <BigButton
              label={t('installButton')}
              icon="download"
              busy={phase === 'waiting'}
              busyLabel={t('installGettingReady')}
              onClick={onInstallTap}
            />
            {continueInBrowser}
          </>
        }
      >
        <p>{t('installBody')}</p>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('installTitle')}
      help={help}
      actions={
        <>
          {path === 'android-chromium' && (
            <BigButton
              label={t('installOpenInChrome')}
              icon="openExternal"
              variant="secondary"
              href={chromeIntentUrl(window.location.href)}
            />
          )}
          {continueInBrowser}
        </>
      }
    >
      {phase === 'dismissed' && <CalmBanner icon="info" message={t('installDismissed')} />}
      <p>{t('installBody')}</p>
      <Guide path={path} />
    </Screen>
  );
}

function Guide({ path }: { path: InstallPath }) {
  const t = useT();
  if (path === 'android-chromium') {
    return (
      <section className="stack" aria-labelledby="guide-title">
        <h2 id="guide-title" className="title">
          {t('installMenuTitle')}
        </h2>
        <ol className="steps">
          <li>
            {t('installMenuStep1')}
            <ChromeMenuButtonPicture label={t('installMenuStep1')} />
          </li>
          <li>
            {t('installMenuStep2')}
            <ChromeMenuItemPicture label={t('installMenuStep2')} />
          </li>
          <li>{t('installMenuStep3')}</li>
        </ol>
        <p className="muted">{t('installMenuNoInstall')}</p>
      </section>
    );
  }
  if (path === 'ios-safari' || path === 'ios-other') {
    return (
      <section className="stack" aria-labelledby="guide-title">
        {path === 'ios-other' && <CalmBanner icon="info" message={t('installInAppIphoneBody')} />}
        <h2 id="guide-title" className="title">
          {t('installIphoneTitle')}
        </h2>
        <ol className="steps">
          <li>
            {t('installIphoneStep1')}
            <IphoneShareButtonPicture label={t('installIphoneStep1')} />
          </li>
          <li>
            {t('installIphoneStep2')}
            <IphoneAddToHomePicture label={t('installIphoneStep2')} />
          </li>
          <li>{t('installIphoneStep3')}</li>
        </ol>
      </section>
    );
  }
  return (
    <section className="stack" aria-labelledby="guide-title">
      <h2 id="guide-title" className="title">
        {t('installOtherTitle')}
      </h2>
      <ol className="steps">
        <li>{t('installOtherStep1')}</li>
        <li>{t('installOtherStep2')}</li>
      </ol>
    </section>
  );
}
