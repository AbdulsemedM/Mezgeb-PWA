import { type ReactNode, useEffect, useId, useRef } from 'react';

/**
 * A bottom sheet on the native <dialog> (focus trap; Back and Escape close it). Closed with a
 * labelled button, never a drag handle alone (MOB-002 §1).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        // A tap on the backdrop closes the sheet.
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet__content">
          <h2 id={titleId} className="title">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
