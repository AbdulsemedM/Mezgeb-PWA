import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../i18n';
import { type HelpContent, HelpButton } from './HelpSheet';
import { Icon } from './Icon';

/**
 * Every screen's frame (MOB-002 §1, §7): a title, a "?" help button, an optional calm banner,
 * the scrolling body, and the primary action pinned at the bottom in the thumb zone.
 */
export function Screen({
  title,
  help,
  banner,
  back,
  actions,
  footer,
  children,
}: {
  title: string;
  help?: HelpContent;
  /** Usually a CalmBanner (offline, sending). */
  banner?: ReactNode;
  /** A back button: `true` goes back in history, a string goes to that route. */
  back?: boolean | string;
  /** The primary action (one BigButton), plus at most a quieter secondary one. */
  actions?: ReactNode;
  /** Bottom tabs. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="screen">
      <header className={`screen__bar${back ? ' screen__bar--back' : ''}`}>
        {back && (
          <button
            type="button"
            className="icon-button"
            aria-label={t('goBack')}
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          >
            <Icon name="back" size={28} />
          </button>
        )}
        <h1 className="screen__title">{title}</h1>
        {help && <HelpButton help={help} />}
      </header>
      <main className="screen__body">
        {banner}
        {children}
      </main>
      {actions && <div className="screen__actions">{actions}</div>}
      {footer}
    </div>
  );
}
