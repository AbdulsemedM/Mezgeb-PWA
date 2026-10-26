import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { LimitSetting } from '../../data/book';
import { enqueue, savedText, useQueued } from '../../data/queue';
import { useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import {
  AmountKeypad,
  BigButton,
  ChoiceTile,
  ConfirmSheet,
  Icon,
  NumberPad,
  Screen,
  Sheet,
  StatusPill,
  useSuccess,
} from '../../ui';
import { inputSantim, santimToInput } from '../../ui/amount-input';
import { useBook } from '../book/BookScreen';
import { Freshness } from '../book/common';
import { QueueNotice } from '../book/QueueNotice';
import { describeLimit, type PeriodChoice, periodText } from './limit-text';

export const LIMIT_KINDS = ['limit.set', 'limit.remove'];

interface Draft {
  value: number | null;
  period: PeriodChoice;
  days: number | null;
  hardStop: boolean;
}

function draftFrom(l: LimitSetting | null): Draft {
  return {
    value: l?.value ?? null,
    period: l?.period?.type ?? 'none',
    days: l?.period?.days ?? null,
    hardStop: l?.mode === 'hard_stop',
  };
}

/**
 * US-07 / LIM-1, 2: the customer's own limit at this shop: an amount, a time to pay back, or
 * both, and "ask me before selling over my limit" (hard stop). Saved on the phone and sent when
 * online (CLAUDE.md rule 5); PUT is idempotent, so sending twice is harmless.
 */
export function LimitsScreen() {
  const { accountId = '' } = useParams();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const success = useSuccess();
  const cached = useBook(accountId);
  const book = cached.data;
  const queued = useQueued(LIMIT_KINDS).filter((w) => w.path.includes(accountId));
  const pending = queued.at(-1);

  const saved: LimitSetting | null =
    pending && !pending.failed
      ? pending.kind === 'limit.remove'
        ? null
        : { ...(pending.body as Omit<LimitSetting, 'updated_at'>), updated_at: '' }
      : (book?.limits.customer ?? null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const d = draft ?? draftFrom(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const [sheet, setSheet] = useState<'amount' | 'days' | null>(null);
  const [typed, setTyped] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shop = book?.account.shop.name ?? '';
  const path = `/v1/accounts/${accountId}/limits/customer`;
  const refresh = [`book:${accountId}`, 'home'];

  async function save() {
    if (d.value === null && d.period === 'none') return setProblem(t('limitNeedsSomething'));
    if (d.period === 'custom_days' && !d.days) return setProblem(t('limitNeedsSomething'));
    await enqueue({
      kind: 'limit.set',
      method: 'PUT',
      path,
      body: {
        value: d.value,
        period:
          d.period === 'none'
            ? null
            : { type: d.period, ...(d.period === 'custom_days' && { days: d.days }) },
        mode: d.hardStop && d.value !== null ? 'hard_stop' : 'alert',
      },
      refresh,
    });
    success(savedText(t, t('limitSaved', { shop })));
    navigate(`/shops/${accountId}`);
  }

  async function remove() {
    setConfirmRemove(false);
    await enqueue({ kind: 'limit.remove', method: 'DELETE', path, refresh });
    success(savedText(t, t('limitRemoved', { shop })));
    navigate(`/shops/${accountId}`);
  }

  return (
    <Screen
      title={t('limitsTitle')}
      back={`/shops/${accountId}`}
      help={{ title: t('limitsTitle'), body: t('limitsHelpBody') }}
      banner={
        <>
          <Freshness cached={cached} />
          <QueueNotice kinds={LIMIT_KINDS} />
        </>
      }
      actions={
        <>
          <BigButton label={t('saveLimit')} onClick={() => void save()} />
          {saved && (
            <BigButton
              label={t('removeLimit')}
              variant="secondary"
              onClick={() => setConfirmRemove(true)}
            />
          )}
        </>
      }
    >
      <section className="card">
        <p className="small muted">{t('limitsShopSide')}</p>
        <p className="title">{describeLimit(t, language, book?.limits.merchant ?? null)}</p>
        <p className="small muted">{t('stricterApplies')}</p>
      </section>

      <h2 className="title row">
        {t('limitsMySide')}
        {pending && !pending.failed && (
          <StatusPill label={t('notSentYet')} tone="warn" icon="clock" />
        )}
      </h2>

      <section className="stack">
        <h3 className="field__label">{t('limitAmountLabel')}</h3>
        <ChoiceTile
          title={d.value === null ? t('limitAmountNone') : formatAmount(d.value, language)}
          trailing={
            <span className="row small">
              <Icon name="money" /> {t('editAmount')}
            </span>
          }
          onClick={() => {
            setTyped(d.value === null ? '' : santimToInput(d.value));
            setSheet('amount');
          }}
        />
      </section>

      <section className="stack">
        <h3 className="field__label">{t('limitPeriodLabel')}</h3>
        <div className="list" role="radiogroup" aria-label={t('limitPeriodLabel')}>
          {(['none', 'weekly', 'biweekly', 'monthly'] as const).map((p) => (
            <ChoiceTile
              key={p}
              title={periodText(t, p, null)}
              selected={d.period === p}
              onClick={() => set({ period: p, days: null })}
            />
          ))}
          <ChoiceTile
            title={
              d.period === 'custom_days' && d.days
                ? periodText(t, 'custom_days', d.days)
                : t('periodCustom')
            }
            selected={d.period === 'custom_days'}
            onClick={() => {
              setTyped(d.days ? String(d.days) : '');
              setSheet('days');
            }}
          />
        </div>
      </section>

      <ChoiceTile
        checkbox
        title={t('hardStopLabel')}
        subtitle={d.value === null ? t('hardStopNeedsAmount') : t('hardStopBody')}
        selected={d.hardStop && d.value !== null}
        onClick={() => d.value !== null && set({ hardStop: !d.hardStop })}
      />

      {problem && (
        <p className="inline-error" role="alert">
          <Icon name="error" />
          <span>{problem}</span>
        </p>
      )}

      <Sheet open={sheet === 'amount'} onClose={() => setSheet(null)} title={t('amountSheetTitle')}>
        <AmountKeypad value={typed} onChange={setTyped} label={t('limitAmountLabel')} />
        <div className="sheet__actions">
          <BigButton
            label={t('done')}
            onClick={() => {
              const v = inputSantim(typed);
              set({ value: v > 0 ? v : null, hardStop: v > 0 && d.hardStop });
              setProblem(null);
              setSheet(null);
            }}
          />
          <BigButton
            label={t('limitAmountNone')}
            variant="secondary"
            onClick={() => {
              set({ value: null, hardStop: false });
              setSheet(null);
            }}
          />
        </div>
      </Sheet>

      <Sheet open={sheet === 'days'} onClose={() => setSheet(null)} title={t('limitDaysLabel')}>
        <div className="digit-display" aria-live="polite">
          {typed || '0'}
        </div>
        <NumberPad
          onDigit={(k) => setTyped((v) => (v.length >= 3 ? v : (v + k).replace(/^0+/, '')))}
          onBackspace={() => setTyped((v) => v.slice(0, -1))}
        />
        <div className="sheet__actions">
          <BigButton
            label={t('done')}
            disabled={!typed || Number(typed) < 1 || Number(typed) > 366}
            onClick={() => {
              set({ period: 'custom_days', days: Number(typed) });
              setProblem(null);
              setSheet(null);
            }}
          />
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmRemove}
        question={t('removeLimitConfirm', { shop })}
        confirmLabel={t('removeLimit')}
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmRemove(false)}
      />
    </Screen>
  );
}
