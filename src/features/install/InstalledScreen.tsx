import { useT } from '../../i18n';
import { BigButton, Screen } from '../../ui';
import { HomeScreenIconPicture } from './GuidePictures';

/** WEB-001 step 4: "Mezgeb is on your home screen. Open it from there." */
export function InstalledScreen() {
  const t = useT();
  return (
    <Screen
      title={t('installDoneTitle')}
      help={{ title: t('installDoneTitle'), body: t('installHelpBody') }}
      actions={<BigButton label={t('installContinueInBrowser')} variant="quiet" to="/signin" />}
    >
      <HomeScreenIconPicture label={t('installDoneIconAlt')} />
      <p className="headline">{t('installDoneBody')}</p>
    </Screen>
  );
}
