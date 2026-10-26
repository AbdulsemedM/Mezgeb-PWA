import { uuidv7 } from '@shared/uuid';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { enqueue, savedText } from '../../data/queue';
import { type MessageKey, useI18n } from '../../i18n';
import { BigButton, ChoiceTile, Icon, Screen, TextField, useSuccess } from '../../ui';
import { useBook } from '../book/BookScreen';
import { Freshness } from '../book/common';

export const DISPUTE_KINDS = ['dispute.create'];

const REASONS: MessageKey[] = [
  'disputeNotTaken',
  'disputeWrongAmount',
  'disputeWrongPrice',
  'disputeUnknownPerson',
  'disputeOther',
];

/**
 * LED-5/6 (US-13): the customer says what is wrong with a purchase: a reason chip and an
 * optional note, sent as one sentence. The entry stays; the shop answers with a correction both
 * see, or a note. Saved on the phone with its client id and sent when online.
 */
export function DisputeScreen() {
  const { accountId = '', entryId = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const success = useSuccess();
  const cached = useBook(accountId);
  const [reason, setReason] = useState<MessageKey | null>(null);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState(false);
  const shop = cached.data?.account.shop.name ?? '';

  async function send() {
    if (!reason) return setProblem(true);
    const text = note.trim() ? `${t(reason)}: ${note.trim()}` : t(reason);
    await enqueue({
      kind: 'dispute.create',
      method: 'POST',
      path: `/v1/entries/${entryId}/disputes`,
      body: { id: uuidv7(), reason: text.slice(0, 280) },
      refresh: [`book:${accountId}`],
    });
    success(savedText(t, t('disputeSent', { shop })));
    navigate(`/shops/${accountId}/entries/${entryId}`, { replace: true });
  }

  return (
    <Screen
      title={t('disputeTitle')}
      back={`/shops/${accountId}/entries/${entryId}`}
      help={{ title: t('disputeTitle'), body: t('disputeHelpBody') }}
      banner={<Freshness cached={cached} />}
      actions={<BigButton label={t('disputeSend')} onClick={() => void send()} />}
    >
      <div className="list" role="radiogroup" aria-label={t('disputeTitle')}>
        {REASONS.map((r) => (
          <ChoiceTile
            key={r}
            title={t(r)}
            selected={reason === r}
            onClick={() => {
              setReason(r);
              setProblem(false);
            }}
          />
        ))}
      </div>
      {problem && (
        <p className="inline-error" role="alert">
          <Icon name="error" />
          <span>{t('disputeNeedsReason')}</span>
        </p>
      )}
      <TextField
        label={t('disputeNoteLabel')}
        value={note}
        maxLength={200}
        onInput={(e) => setNote((e.target as HTMLInputElement).value)}
      />
    </Screen>
  );
}
