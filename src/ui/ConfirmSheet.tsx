import { useT } from '../i18n';
import { BigButton } from './BigButton';
import { Sheet } from './Sheet';

/**
 * Only for money-changing or permanent actions (MOB-002 §5): one sentence with the amount and
 * the person, then "Yes, confirm" / "No".
 */
export function ConfirmSheet({
  open,
  question,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  question: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onCancel} title={question}>
      <div className="sheet__actions">
        <BigButton
          label={confirmLabel ?? t('confirmYes')}
          variant={danger ? 'danger' : 'primary'}
          busy={busy}
          onClick={onConfirm}
        />
        <BigButton label={t('confirmNo')} variant="secondary" onClick={onCancel} />
      </div>
    </Sheet>
  );
}
