import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon = 'book',
  message,
  detail,
  action,
}: {
  icon?: IconName;
  message: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={56} />
      </span>
      <p className="title">{message}</p>
      {detail && <p className="muted">{detail}</p>}
      {action}
    </div>
  );
}
