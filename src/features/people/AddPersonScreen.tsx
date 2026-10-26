import { normalizeEthiopianPhone } from '@shared/phone';
import { uuidv7 } from '@shared/uuid';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Representative } from '../../data/book';
import { enqueue, savedText } from '../../data/queue';
import { useI18n } from '../../i18n';
import { formatAmount } from '../../lib/money';
import {
  AmountKeypad,
  BigButton,
  ChoiceTile,
  CodeBoxes,
  Icon,
  NumberPad,
  Screen,
  Sheet,
  TextField,
  useSuccess,
} from '../../ui';
import { inputSantim } from '../../ui/amount-input';
import { RELATIONSHIP_KEYS } from './PeopleScreen';

const RELATIONSHIPS = Object.keys(RELATIONSHIP_KEYS) as Representative['relationship'][];

/**
 * REP-1, 2, 5, 6: add a person who may take goods. Name and who they are; phone, SMS receipts,
 * ordering, their own monthly limit and a PIN are optional. Saved on the phone with its client
 * id and sent when online (CLAUDE.md rule 5).
 */
export function AddPersonScreen() {
  const { accountId = '' } = useParams();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const success = useSuccess();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<Representative['relationship'] | null>(null);
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState(false);
  const [mayOrder, setMayOrder] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [sheet, setSheet] = useState<'limit' | 'pin' | null>(null);
  const [typed, setTyped] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('personNameMissing');
    if (!relationship) e.relationship = t('relationshipLabel');
    const normalized = phone.trim() ? normalizeEthiopianPhone(phone) : null;
    if (phone.trim() && !normalized) e.phone = t('phoneInvalid');
    if (sms && !phone.trim()) e.phone = t('smsNeedsPhone');
    if (pin && pin.length !== 4) e.pin = t('pinInvalid');
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    await enqueue({
      kind: 'rep.create',
      method: 'POST',
      path: `/v1/accounts/${accountId}/representatives`,
      body: {
        id: uuidv7(),
        name: name.trim(),
        relationship,
        phone: normalized,
        may_order: mayOrder,
        limit: limit ? { value: limit, period: { type: 'monthly' } } : null,
        pin: pin || null,
        sms_receipt: sms,
      },
      refresh: [`book:${accountId}`],
    });
    success(savedText(t, t('personSaved', { name: name.trim() })));
    navigate(`/shops/${accountId}/people`, { replace: true });
  }

  return (
    <Screen
      title={t('addPerson')}
      back={`/shops/${accountId}/people`}
      help={{ title: t('peopleTitle'), body: t('peopleHelpBody') }}
      actions={<BigButton label={t('savePerson')} onClick={() => void save()} />}
    >
      <TextField
        label={t('personNameLabel')}
        hint={t('personNameHint')}
        value={name}
        maxLength={60}
        autoComplete="off"
        error={errors.name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />

      <section className="stack">
        <h2 className="field__label">{t('relationshipLabel')}</h2>
        <div className="list" role="radiogroup" aria-label={t('relationshipLabel')}>
          {RELATIONSHIPS.map((r) => (
            <ChoiceTile
              key={r}
              title={t(RELATIONSHIP_KEYS[r])}
              selected={relationship === r}
              onClick={() => setRelationship(r)}
            />
          ))}
        </div>
        {errors.relationship && (
          <p className="inline-error" role="alert">
            <Icon name="error" />
            <span>{errors.relationship}</span>
          </p>
        )}
      </section>

      <TextField
        label={t('personPhoneLabel')}
        hint={t('personPhoneHint')}
        value={phone}
        inputMode="tel"
        autoComplete="off"
        placeholder={t('phonePlaceholder')}
        error={errors.phone}
        onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
      />
      <ChoiceTile
        checkbox
        title={t('personSmsReceipt')}
        selected={sms}
        onClick={() => setSms(!sms)}
      />
      <ChoiceTile
        checkbox
        title={t('personMayOrder')}
        selected={mayOrder}
        onClick={() => setMayOrder(!mayOrder)}
      />

      <ChoiceTile
        title={t('personLimitLabel')}
        subtitle={limit ? formatAmount(limit, language) : t('noLimit')}
        trailing={<span className="small">{t('editAmount')}</span>}
        onClick={() => {
          setTyped('');
          setSheet('limit');
        }}
      />
      <ChoiceTile
        title={t('personPinLabel')}
        subtitle={pin ? '••••' : t('personPinHint')}
        trailing={<span className="small">{t('editAmount')}</span>}
        onClick={() => {
          setTyped('');
          setSheet('pin');
        }}
      />
      {errors.pin && (
        <p className="inline-error" role="alert">
          <Icon name="error" />
          <span>{errors.pin}</span>
        </p>
      )}

      <Sheet open={sheet === 'limit'} onClose={() => setSheet(null)} title={t('personLimitLabel')}>
        <AmountKeypad value={typed} onChange={setTyped} label={t('personLimitLabel')} />
        <div className="sheet__actions">
          <BigButton
            label={t('done')}
            onClick={() => {
              const v = inputSantim(typed);
              setLimit(v > 0 ? v : null);
              setSheet(null);
            }}
          />
          <BigButton
            label={t('limitAmountNone')}
            variant="secondary"
            onClick={() => {
              setLimit(null);
              setSheet(null);
            }}
          />
        </div>
      </Sheet>

      <Sheet open={sheet === 'pin'} onClose={() => setSheet(null)} title={t('personPinLabel')}>
        <p>{t('personPinHint')}</p>
        <CodeBoxes
          code={'•'.repeat(typed.length)}
          length={4}
          spoken={`${t('personPinLabel')}: ${typed.length}/4`}
        />
        <NumberPad
          onDigit={(k) => setTyped((v) => (v.length >= 4 ? v : v + k))}
          onBackspace={() => setTyped((v) => v.slice(0, -1))}
        />
        <div className="sheet__actions">
          <BigButton
            label={t('done')}
            disabled={typed.length !== 4}
            onClick={() => {
              setPin(typed);
              setErrors((e) => ({ ...e, pin: '' }));
              setSheet(null);
            }}
          />
          <BigButton
            label={t('confirmNo')}
            variant="secondary"
            onClick={() => {
              setPin('');
              setSheet(null);
            }}
          />
        </div>
      </Sheet>
    </Screen>
  );
}
