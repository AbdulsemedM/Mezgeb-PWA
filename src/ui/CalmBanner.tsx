import { Icon, type IconName } from './Icon';

/**
 * Offline and "sending" states (MOB-002 §6): calm, never shown as an error. `role="status"`,
 * so screen readers announce it without interrupting.
 */
export function CalmBanner({
  message,
  detail,
  icon = 'offline',
  tone = 'calm',
  action,
}: {
  message: string;
  detail?: string;
  icon?: IconName;
  tone?: 'calm' | 'warn';
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`calm-banner${tone === 'warn' ? ' calm-banner--warn' : ''}`} role="status">
      <Icon name={icon} />
      <div className="calm-banner__text">
        <p>{message}</p>
        {detail && <p className="small muted">{detail}</p>}
        {action && (
          <button type="button" className="calm-banner__action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
