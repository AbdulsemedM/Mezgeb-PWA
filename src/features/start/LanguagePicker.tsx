import { type Language, LANGUAGES, useI18n } from '../../i18n';
import { ChoiceTile } from '../../ui';

const NAMES = { am: 'languageAmharic', om: 'languageOromo', en: 'languageEnglish' } as const;

/** Each language in its own name and script, as radio tiles (no typing, MOB-002 §3). */
export function LanguagePicker({ onPick }: { onPick?: (language: Language) => void }) {
  const { language, chosen, setLanguage, t } = useI18n();
  return (
    <div className="list" role="radiogroup" aria-label={t('chooseLanguageTitle')}>
      {LANGUAGES.map((l) => (
        <ChoiceTile
          key={l}
          title={t(NAMES[l])}
          lang={l}
          selected={chosen && l === language}
          onClick={() => {
            setLanguage(l);
            onPick?.(l);
          }}
        />
      ))}
    </div>
  );
}
