import { useT } from '../i18n';
import { Icon } from './Icon';

/** − 1 + for whole quantities (MOB-002 §3: choosing over typing). Zero removes the line. */
export function QuantityStepper({
  label,
  value,
  onChange,
  max = 99,
}: {
  /** What is counted, read with the buttons ("Less Bread"). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  const t = useT();
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="icon-button stepper__button"
        aria-label={`${t('stepperLess')} ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <Icon name="minus" />
      </button>
      <span className="stepper__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="icon-button stepper__button"
        aria-label={`${t('stepperMore')} ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="add" />
      </button>
    </div>
  );
}
