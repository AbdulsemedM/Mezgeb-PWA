import { Icon, type IconName } from './Icon';

/** A short status word with an icon (never colour alone). */
export function StatusPill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'crit';
  icon?: IconName;
}) {
  return (
    <span className={`pill${tone === 'neutral' ? '' : ` pill--${tone}`}`}>
      {icon && <Icon name={icon} size={18} />}
      {label}
    </span>
  );
}
