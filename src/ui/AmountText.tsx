import { useI18n } from '../i18n';
import { formatAmount, spokenAmount } from '../lib/money';

export type AmountSize = 'body' | 'large' | 'balance';

/** An amount in santim, formatted for the language and read as words by screen readers. */
export function AmountText({
  santim,
  size = 'body',
  className,
}: {
  santim: number;
  size?: AmountSize;
  className?: string;
}) {
  const { language, t } = useI18n();
  return (
    <span
      className={`amount amount--${size}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={spokenAmount(t, santim)}
    >
      {formatAmount(santim, language)}
    </span>
  );
}
