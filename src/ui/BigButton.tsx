import type { ReactNode } from 'react';
import { Link } from '../app/router';
import { Icon, type IconName } from './Icon';

export type BigButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

interface Common {
  label: string;
  icon?: IconName;
  variant?: BigButtonVariant;
}

interface AsButton extends Common {
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Shows a spinner with `busyLabel` and blocks double taps. */
  busy?: boolean;
  busyLabel?: string;
  to?: never;
  href?: never;
}

interface AsLink extends Common {
  /** In-app route. */
  to?: string;
  /** External link (tel:, intent:, https:), or a file with `download`. */
  href?: string;
  /** Save `href` as a file with this name. */
  download?: string;
  onClick?: () => void;
}

/**
 * The one primary action of a screen, full width at the bottom (MOB-002 §1). At least 56px
 * tall; the label is always visible text, never an icon alone.
 */
export function BigButton(props: AsButton | AsLink) {
  const { label, icon, variant = 'primary' } = props;
  const className = `big-button big-button--${variant}`;
  const content = (text: string, busy = false): ReactNode => (
    <>
      {busy ? <span className="spinner" aria-hidden="true" /> : icon && <Icon name={icon} />}
      <span>{text}</span>
    </>
  );
  if ('to' in props && props.to) {
    return (
      <Link className={className} to={props.to} onClick={props.onClick}>
        {content(label)}
      </Link>
    );
  }
  if ('href' in props && props.href) {
    return (
      <a className={className} href={props.href} download={props.download} onClick={props.onClick}>
        {content(label)}
      </a>
    );
  }
  const b = props as AsButton;
  return (
    <button
      className={className}
      type={b.type ?? 'button'}
      onClick={b.busy ? undefined : b.onClick}
      disabled={b.disabled}
      aria-busy={b.busy || undefined}
    >
      {content(b.busy && b.busyLabel ? b.busyLabel : label, b.busy)}
    </button>
  );
}
