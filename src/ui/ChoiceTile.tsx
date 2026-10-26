import type { ReactNode } from 'react';
import { Link } from '../app/router';
import { Icon, type IconName } from './Icon';

/**
 * A large tappable row: a radio choice (`selected` set), a navigation row (`to`), or a plain
 * action. At least 56px tall, with visible text (MOB-002 §1, §2).
 */
export function ChoiceTile({
  title,
  subtitle,
  icon,
  trailing,
  selected,
  to,
  onClick,
  lang,
  checkbox,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: IconName;
  trailing?: ReactNode;
  /** Makes it a radio choice (or a checkbox with `checkbox`). */
  selected?: boolean;
  /** An on/off option instead of one-of-many. */
  checkbox?: boolean;
  to?: string;
  onClick?: () => void;
  /** The language of the title, e.g. each language's own name. */
  lang?: string;
}) {
  const body = (
    <>
      {icon && <Icon name={icon} size={28} />}
      <span className="choice-tile__text">
        <span className="choice-tile__title" lang={lang}>
          {title}
        </span>
        {subtitle && <span className="small muted">{subtitle}</span>}
      </span>
      <span className="choice-tile__trailing">
        {trailing ??
          (selected ? <Icon name="check" size={28} /> : to ? <Icon name="chevron" /> : null)}
      </span>
    </>
  );
  if (to) {
    return (
      <Link className="choice-tile" to={to} onClick={onClick}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="choice-tile"
      role={selected === undefined ? undefined : checkbox ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
