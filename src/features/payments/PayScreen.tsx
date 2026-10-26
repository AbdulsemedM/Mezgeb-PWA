import { uuidv7 } from '@shared/uuid';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { PaymentMethod, PaymentReport } from '../../data/book';
import { enqueue, savedText } from '../../data/queue';
import { useI18n } from '../../i18n';
import { compressReceipt } from '../../lib/compress-image';
import { formatAmount } from '../../lib/money';
import { AmountKeypad, BigButton, ChoiceTile, Icon, Screen, TextField, useSuccess } from '../../ui';
import { inputSantim, santimToInput } from '../../ui/amount-input';
import { useBook } from '../book/BookScreen';
import { Freshness, methodLabel } from '../book/common';
import { QueueNotice } from '../book/QueueNotice';
import { OPEN_PAYME } from '../home/HomeScreen';
import { ReportsList } from './ReportsList';

export const PAY_KINDS = ['report.create', 'report.receipt'];
const METHODS: PaymentMethod[] = [
  'telebirr',
  'cbe_birr',
  'mpesa',
  'bank_transfer',
  'cash',
  'other',
];

/**
 * PAY-2 (US-10): "I paid". The customer pays the usual way, then tells the shop: amount,
 * method, an optional transaction number and receipt photo (shrunk on the phone). Saved on the
 * phone and sent when online; the balance changes only when the shop confirms (ADR-013).
 */
export function PayScreen() {
  const { accountId = '' } = useParams();
  const [params] = useSearchParams();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const success = useSuccess();
  const cached = useBook(accountId);
  const book = cached.data;
  const again: PaymentReport | undefined = book?.reports.find((r) => r.id === params.get('again'));
  const payme =
    book?.payme.find((p) => p.id === params.get('payme')) ??
    book?.payme.find((p) => OPEN_PAYME.includes(p.status));

  const [typed, setTyped] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  // Start from what the person is answering: a rejected report, a pay-me request, the balance.
  const suggested =
    again?.amount ?? payme?.amount ?? Math.max(0, book?.account.balance_santim ?? 0);
  const amountText = typed ?? (suggested > 0 ? santimToInput(suggested) : '');
  const shownMethod = method ?? again?.method ?? null;

  // A preview of the shrunk photo; the URL is let go when the photo changes.
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    const small = await compressReceipt(file);
    setPhotoBusy(false);
    if (small) {
      setPhoto(small);
      setErrors((e) => ({ ...e, photo: '' }));
    } else {
      setErrors((e) => ({ ...e, photo: t('payPhotoFailed') }));
    }
  }

  async function send() {
    const amount = inputSantim(amountText);
    const e: Record<string, string> = {};
    if (amount <= 0) e.amount = t('payAmountMissing');
    if (!shownMethod) e.method = t('payMethodMissing');
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const id = uuidv7();
    const refresh = [`book:${accountId}`, 'home'];
    await enqueue({
      kind: 'report.create',
      method: 'POST',
      path: `/v1/accounts/${accountId}/payment-reports`,
      body: {
        id,
        amount,
        method: shownMethod,
        ...(reference.trim() && shownMethod !== 'cash' && { reference: reference.trim() }),
        ...(again?.status === 'rejected' && { resubmitted_from_id: again.id }),
      },
      refresh,
    });
    // Queued after the report, so it is sent after the report exists (the queue keeps order).
    if (photo) {
      await enqueue({
        kind: 'report.receipt',
        method: 'PUT',
        path: `/v1/payment-reports/${id}/receipt`,
        raw: { blob: photo, type: 'image/jpeg' },
        refresh,
      });
    }
    success(savedText(t, t('paySent', { shop: book?.account.shop.name ?? '' })));
    navigate(`/shops/${accountId}`, { replace: true });
  }

  const shop = book?.account.shop.name ?? '';
  return (
    <Screen
      title={t('payTitle')}
      back={`/shops/${accountId}`}
      help={{ title: t('payTitle'), body: t('payHelpBody') }}
      banner={
        <>
          <Freshness cached={cached} />
          <QueueNotice kinds={PAY_KINDS} />
        </>
      }
      actions={<BigButton label={t('paySend')} onClick={() => void send()} />}
    >
      {again && (
        <p className="muted">
          {t('payAgainOf', {
            amount: formatAmount(again.amount, language),
            method: methodLabel(t, again.method),
          })}
        </p>
      )}
      {payme?.payment_details && (
        <section className="card">
          <p className="small muted">{t('payDetailsTitle', { shop })}</p>
          <p className="title">{payme.payment_details}</p>
          {payme.message && <p>{payme.message}</p>}
        </section>
      )}

      <AmountKeypad value={amountText} onChange={setTyped} label={t('payAmountLabel')} />
      {errors.amount && <InlineError text={errors.amount} />}

      <section className="stack">
        <h2 className="field__label">{t('payMethodLabel')}</h2>
        <div className="list" role="radiogroup" aria-label={t('payMethodLabel')}>
          {METHODS.map((m) => (
            <ChoiceTile
              key={m}
              title={methodLabel(t, m)}
              selected={shownMethod === m}
              onClick={() => setMethod(m)}
            />
          ))}
        </div>
        {errors.method && <InlineError text={errors.method} />}
      </section>

      {shownMethod && shownMethod !== 'cash' && (
        <TextField
          label={t('payReferenceLabel')}
          hint={t('payReferenceHint')}
          value={reference}
          maxLength={64}
          autoComplete="off"
          onInput={(e) => setReference((e.target as HTMLInputElement).value)}
        />
      )}

      <section className="stack">
        {photoUrl && <img className="guide-picture" src={photoUrl} alt={t('payPhotoAlt')} />}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          data-testid="receipt-input"
          onChange={(e) => void pickPhoto(e.currentTarget.files?.[0])}
        />
        <BigButton
          label={photo ? t('payPhotoChange') : t('payPhotoAdd')}
          icon="camera"
          variant="secondary"
          busy={photoBusy}
          busyLabel={t('loading')}
          onClick={() => fileInput.current?.click()}
        />
        {photo && (
          <BigButton label={t('payPhotoRemove')} variant="quiet" onClick={() => setPhoto(null)} />
        )}
        {errors.photo && <InlineError text={errors.photo} />}
      </section>

      {book && <ReportsList accountId={accountId} reports={book.reports} />}
    </Screen>
  );
}

function InlineError({ text }: { text: string }) {
  return (
    <p className="inline-error" role="alert">
      <Icon name="error" />
      <span>{text}</span>
    </p>
  );
}
