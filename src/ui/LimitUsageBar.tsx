import { Icon } from './Icon';

/** At or above this share of a limit the bar turns to "near" (the 80% notice, ADR-015). */
export const NEAR_LIMIT = 0.8;

/**
 * Limit usage with colour AND an icon AND words (MOB-002 §2): colour never carries meaning
 * alone. `words` is the sentence for the current state, e.g. "75% of the limit used".
 */
export function LimitUsageBar({
  used,
  words,
  label,
}: {
  used: number;
  words: string;
  /** What the bar measures, for screen readers ("Limits"). */
  label: string;
}) {
  const state = used >= 1 ? 'over' : used >= NEAR_LIMIT ? 'near' : 'ok';
  const percent = Math.max(0, Math.min(100, Math.round(used * 100)));
  return (
    <div className={`usage usage--${state}`}>
      <div
        className="usage__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={words}
      >
        <div className="usage__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="usage__words">
        <Icon name={state === 'ok' ? 'check' : state === 'near' ? 'warning' : 'error'} />
        <span>{words}</span>
      </p>
    </div>
  );
}
