import { useT } from '../i18n';
import { BigButton } from './BigButton';
import { SupportButton } from './HelpSheet';
import { Icon } from './Icon';

/** What happened, what to do, and a button that does it (MOB-002 §6). Never a raw message. */
export function ErrorPanel({
  what,
  whatToDo,
  onRetry,
  retryLabel,
}: {
  what?: string;
  whatToDo?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const t = useT();
  return (
    <div className="error-panel" role="alert">
      <span className="error-panel__icon">
        <Icon name="error" size={48} />
      </span>
      <p className="title">{what ?? t('errorGenericWhat')}</p>
      <p>{whatToDo ?? t('errorGenericWhatToDo')}</p>
      <div className="stack" style={{ width: '100%' }}>
        {onRetry && (
          <BigButton label={retryLabel ?? t('tryAgain')} icon="refresh" onClick={onRetry} />
        )}
        <SupportButton />
      </div>
    </div>
  );
}
