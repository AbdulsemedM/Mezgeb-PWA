import { useState } from 'react';
import { config } from '../app/config';
import { useT } from '../i18n';
import { BigButton } from './BigButton';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface HelpContent {
  title: string;
  body: string;
  /** Optional picture (MOB-002 §7). */
  picture?: { src: string; alt: string };
}

/** The "?" on every screen: a short help sheet with a "Call Mezgeb support" button. */
export function HelpButton({ help }: { help: HelpContent }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={t('helpButton')}
        onClick={() => setOpen(true)}
      >
        <Icon name="help" size={28} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={help.title}>
        {help.picture && (
          <img className="guide-picture" src={help.picture.src} alt={help.picture.alt} />
        )}
        <p>{help.body}</p>
        <div className="sheet__actions">
          <SupportButton />
          <BigButton label={t('helpClose')} variant="secondary" onClick={() => setOpen(false)} />
        </div>
      </Sheet>
    </>
  );
}

export function SupportButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const t = useT();
  return (
    <BigButton
      label={t('callSupport')}
      icon="phone"
      variant={variant}
      href={`tel:${config.supportPhone}`}
    />
  );
}
