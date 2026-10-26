import { dismiss, useQueued } from '../../data/queue';
import { useT } from '../../i18n';
import { CalmBanner } from '../../ui';

/**
 * Writes of these kinds still on this phone: calm "will send when internet returns"
 * (MOB-002 §6). A write the server refused says so once, with support, and can be dismissed.
 */
export function QueueNotice({ kinds }: { kinds: string[] }) {
  const t = useT();
  const items = useQueued(kinds);
  const waiting = items.filter((w) => !w.failed);
  const refused = items.filter((w) => w.failed);
  return (
    <>
      {waiting.length > 0 && <CalmBanner message={t('offlineSaved')} />}
      {refused.map((w) => (
        <CalmBanner
          key={w.id}
          tone="warn"
          icon="warning"
          message={t('writeRefused')}
          action={{ label: t('helpClose'), onClick: () => void dismiss(w.id) }}
        />
      ))}
    </>
  );
}
