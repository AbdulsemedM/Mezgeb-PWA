/** A number typed on the NumberPad, large; screen readers hear `spoken`. */
export function PhoneDisplay({
  text,
  placeholder,
  spoken,
}: {
  text: string;
  placeholder: boolean;
  spoken: string;
}) {
  return (
    <div
      className={`digit-display${placeholder ? ' digit-display--placeholder' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={spoken}
    >
      <span aria-hidden="true">{text}</span>
    </div>
  );
}

/** Six boxes for an SMS code, filled as digits are typed. */
export function CodeBoxes({
  code,
  length = 6,
  spoken,
}: {
  code: string;
  length?: number;
  spoken: string;
}) {
  return (
    <div className="code-boxes" role="status" aria-live="polite" aria-label={spoken}>
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`code-boxes__box${i === code.length ? ' code-boxes__box--next' : ''}`}
        >
          {code[i] ?? ''}
        </span>
      ))}
    </div>
  );
}
