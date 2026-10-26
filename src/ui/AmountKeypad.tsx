import { useI18n } from '../i18n';
import { formatAmount, spokenAmount } from '../lib/money';
import { backspace, inputSantim, pressKey } from './amount-input';
import { Icon } from './Icon';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * A large on-screen keypad for numbers (MOB-002 §3): no system keyboard. Western digits.
 * `onDigit` / `onPoint` / `onBackspace` make it reusable for codes and counts.
 */
export function NumberPad({
  onDigit,
  onBackspace,
  onPoint,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** Omit for whole numbers: the key is left blank. */
  onPoint?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="keypad">
      {DIGITS.map((d) => (
        <button key={d} type="button" className="keypad__key" onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      {onPoint ? (
        <button
          type="button"
          className="keypad__key"
          aria-label={t('keypadDecimal')}
          onClick={onPoint}
        >
          .
        </button>
      ) : (
        <span className="keypad__key keypad__key--blank" aria-hidden="true" />
      )}
      <button type="button" className="keypad__key" onClick={() => onDigit('0')}>
        0
      </button>
      <button
        type="button"
        className="keypad__key"
        aria-label={t('keypadDelete')}
        onClick={onBackspace}
      >
        <Icon name="backspace" size={30} />
      </button>
    </div>
  );
}

/** The typed amount shown big above the keypad, and the keypad itself. */
export function AmountKeypad({
  value,
  onChange,
  label,
}: {
  /** The typed text (see amount-input.ts). */
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const { language, t } = useI18n();
  const santim = inputSantim(value);
  return (
    <div className="stack">
      <div className="amount-display" aria-live="polite">
        <span className="small muted">{label}</span>
        <div className="amount amount--balance" aria-label={spokenAmount(t, santim)} role="img">
          {formatAmount(santim, language)}
        </div>
      </div>
      <NumberPad
        onDigit={(d) => onChange(pressKey(value, d))}
        onPoint={() => onChange(pressKey(value, '.'))}
        onBackspace={() => onChange(backspace(value))}
      />
    </div>
  );
}
