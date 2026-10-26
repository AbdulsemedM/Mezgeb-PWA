import { useState } from 'react';
import { useParams } from 'react-router';
import type { Representative } from '../../data/book';
import { enqueue, savedText, useQueued } from '../../data/queue';
import { type MessageKey, useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import type { QueuedWrite } from '../../storage/db';
import { BigButton, ConfirmSheet, EmptyState, Screen, StatusPill, useSuccess } from '../../ui';
import { useBook } from '../book/BookScreen';
import { Freshness } from '../book/common';
import { QueueNotice } from '../book/QueueNotice';

export const REP_KINDS = ['rep.create', 'rep.status', 'rep.update'];

export const RELATIONSHIP_KEYS: Record<Representative['relationship'], MessageKey> = {
  household: 'relHousehold',
  maid: 'relMaid',
  guard: 'relGuard',
  driver: 'relDriver',
  other: 'relOther',
};

type Shown = Representative & { notSent: boolean };

/** The server's list with this phone's waiting changes on top, so nothing seems lost. */
export function mergeQueued(
  accountId: string,
  reps: Representative[],
  queued: QueuedWrite[],
): Shown[] {
  const out = new Map<string, Shown>(reps.map((r) => [r.id, { ...r, notSent: false }]));
  for (const w of queued) {
    if (w.failed) continue;
    const body = w.body as Record<string, unknown>;
    if (w.kind === 'rep.create' && w.path === `/v1/accounts/${accountId}/representatives`) {
      const id = body.id as string;
      if (!out.has(id)) {
        out.set(id, {
          id,
          account_id: accountId,
          name: body.name as string,
          relationship: body.relationship as Representative['relationship'],
          status: 'active',
          may_order: Boolean(body.may_order),
          has_pin: Boolean(body.pin),
          limit: (body.limit as Representative['limit']) ?? null,
          phone: (body.phone as string | null) ?? null,
          sms_receipt: Boolean(body.sms_receipt),
          notSent: true,
        });
      }
    }
    const id = /\/v1\/representatives\/([^/]+)/.exec(w.path)?.[1];
    const rep = id ? out.get(id) : undefined;
    if (rep && w.kind === 'rep.status') {
      out.set(rep.id, { ...rep, status: body.status as Representative['status'], notSent: true });
    }
  }
  return [...out.values()].filter((r) => r.status !== 'revoked');
}

/** REP-1..6 (W5): people who may take goods on this dube book, with pause and remove. */
export function PeopleScreen() {
  const { accountId = '' } = useParams();
  const { t, language } = useI18n();
  const success = useSuccess();
  const cached = useBook(accountId);
  const queued = useQueued(REP_KINDS);
  const people = mergeQueued(accountId, cached.data?.representatives ?? [], queued);
  const [removing, setRemoving] = useState<Shown | null>(null);
  const refresh = [`book:${accountId}`];

  async function setStatus(rep: Shown, status: 'active' | 'paused' | 'revoked') {
    await enqueue({
      kind: 'rep.status',
      method: 'POST',
      path: `/v1/representatives/${rep.id}/status`,
      body: { status },
      refresh,
    });
    const done =
      status === 'revoked'
        ? 'personRemoved'
        : status === 'paused'
          ? 'personPaused'
          : 'personResumed';
    success(savedText(t, t(done, { name: rep.name })));
  }

  return (
    <Screen
      title={t('peopleTitle')}
      back={`/shops/${accountId}`}
      help={{ title: t('peopleTitle'), body: t('peopleHelpBody') }}
      banner={
        <>
          <Freshness cached={cached} />
          <QueueNotice kinds={REP_KINDS} />
        </>
      }
      actions={
        <BigButton label={t('addPerson')} icon="add" to={`/shops/${accountId}/people/new`} />
      }
    >
      {people.length === 0 && cached.data && <EmptyState icon="people" message={t('peopleNone')} />}
      <ul className="list">
        {people.map((p) => (
          <li key={p.id} className="card">
            <div className="row row--between">
              <span className="title">{p.name}</span>
              {p.status === 'active' ? (
                <StatusPill label={t('statusActive')} tone="good" icon="check" />
              ) : (
                <StatusPill label={t('repPaused')} tone="warn" icon="pause" />
              )}
            </div>
            <p className="small muted">
              {[t(RELATIONSHIP_KEYS[p.relationship]), p.has_pin ? t('hasPin') : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {p.limit && (
              <p className="small">
                {t('repOwnLimit', { amount: formatAmount(p.limit.value, language) })}
              </p>
            )}
            {p.notSent && <StatusPill label={t('notSentYet')} tone="warn" icon="clock" />}
            <div className="stack">
              {p.status === 'active' ? (
                <BigButton
                  label={t('pausePerson')}
                  icon="pause"
                  variant="secondary"
                  onClick={() => void setStatus(p, 'paused')}
                />
              ) : (
                <BigButton
                  label={t('resumePerson')}
                  icon="play"
                  variant="secondary"
                  onClick={() => void setStatus(p, 'active')}
                />
              )}
              <BigButton
                label={t('removePerson')}
                icon="remove"
                variant="secondary"
                onClick={() => setRemoving(p)}
              />
            </div>
          </li>
        ))}
      </ul>
      <ConfirmSheet
        open={removing !== null}
        question={removing ? t('removePersonConfirm', { name: removing.name }) : ''}
        confirmLabel={t('removePerson')}
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing!;
          setRemoving(null);
          void setStatus(r, 'revoked');
        }}
      />
    </Screen>
  );
}
