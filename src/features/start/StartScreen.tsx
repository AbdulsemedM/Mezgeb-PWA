import { useI18n } from '../../i18n';
import { BigButton, Screen } from '../../ui';
import { LanguagePicker } from './LanguagePicker';

/** First open without an invite link: choose the language, then sign in (WEB-001 step 5). */
export function StartScreen() {
  const { chosen, t } = useI18n();
  return (
    <Screen
      title={t('chooseLanguageTitle')}
      help={{ title: t('chooseLanguageTitle'), body: t('languageHelpBody') }}
      actions={chosen && <BigButton label={t('next')} to="/signin" />}
    >
      <LanguagePicker />
    </Screen>
  );
}
