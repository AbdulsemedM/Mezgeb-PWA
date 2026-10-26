import { type InputHTMLAttributes, useId } from 'react';
import { Icon } from './Icon';

/** A labelled input with its error under it. Free text only where unavoidable (MOB-002 §3). */
export function TextField({
  label,
  hint,
  error,
  variant,
  ...input
}: {
  label: string;
  hint?: string;
  error?: string | null;
  variant?: 'code';
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="small muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        className={`field__input${variant === 'code' ? ' field__input--code' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {error && (
        <p id={errorId} className="inline-error" role="alert">
          <Icon name="error" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
