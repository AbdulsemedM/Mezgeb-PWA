import { uuidv7 } from '@shared/uuid';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { type CatalogueItem, fetchCatalogue } from '../../data/book';
import { enqueue, savedText } from '../../data/queue';
import { useCached } from '../../data/use-cached';
import { type MessageKey, useI18n } from '../../i18n';
import { BigButton, Chips, Icon, QuantityStepper, Screen, TextField, useSuccess } from '../../ui';
import { useBook } from '../book/BookScreen';
import { Freshness } from '../book/common';

export const ORDER_KINDS = ['order.create', 'order.receipt'];

interface Line {
  key: string;
  name: string;
  unit: string | null;
  itemId: string | null;
  qty: number;
}

const WHEN: { value: string; key: MessageKey }[] = [
  { value: 'soon', key: 'orderWhenSoon' },
  { value: 'evening', key: 'orderWhenEvening' },
  { value: 'tomorrow', key: 'orderWhenTomorrow' },
  { value: 'any', key: 'orderWhenAny' },
];

/**
 * ORD-1 (US-12): pick items as tiles with − / + (no typing), add anything else as free text,
 * say where and when. Saved on the phone with the order's client id and sent when online.
 */
export function NewOrderScreen() {
  const { accountId = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const success = useSuccess();
  const book = useBook(accountId).data;
  const catalogue = useCached<CatalogueItem[]>(`catalogue:${accountId}`, () =>
    fetchCatalogue(accountId),
  );
  const [lines, setLines] = useState<Line[]>([]);
  const [other, setOther] = useState('');
  const [address, setAddress] = useState('');
  const [when, setWhen] = useState('any');
  const [problem, setProblem] = useState<string | null>(null);
  const shop = book?.account.shop.name ?? '';

  const qtyOf = (key: string) => lines.find((l) => l.key === key)?.qty ?? 0;
  function setQty(line: Omit<Line, 'qty'>, qty: number) {
    setProblem(null);
    setLines((ls) => {
      const rest = ls.filter((l) => l.key !== line.key);
      if (qty <= 0) return rest;
      const at = ls.findIndex((l) => l.key === line.key);
      const next = { ...line, qty };
      return at < 0 ? [...ls, next] : ls.map((l) => (l.key === line.key ? next : l));
    });
  }

  function addOther() {
    const name = other.trim();
    if (!name) return;
    setQty(
      { key: `free:${name.toLowerCase()}`, name, unit: null, itemId: null },
      qtyOf(`free:${name.toLowerCase()}`) + 1,
    );
    setOther('');
  }

  async function send() {
    if (lines.length === 0) return setProblem(t('orderNeedsLines'));
    const whenText = WHEN.find((w) => w.value === when);
    await enqueue({
      kind: 'order.create',
      method: 'POST',
      path: `/v1/accounts/${accountId}/orders`,
      body: {
        id: uuidv7(),
        lines: lines.map((l) => ({
          name: l.name,
          qty: String(l.qty),
          ...(l.unit && { unit: l.unit }),
          ...(l.itemId && { item_id: l.itemId }),
        })),
        ...(address.trim() && { address_note: address.trim() }),
        ...(when !== 'any' && whenText && { preferred_time: t(whenText.key) }),
      },
      refresh: [`book:${accountId}`],
    });
    success(savedText(t, t('orderSent', { shop })));
    navigate(`/shops/${accountId}/orders`, { replace: true });
  }

  return (
    <Screen
      title={t('newOrderTitle')}
      back={`/shops/${accountId}/orders`}
      help={{ title: t('newOrderTitle'), body: t('ordersHelpBody') }}
      banner={<Freshness cached={catalogue} />}
      actions={<BigButton label={t('orderSend')} icon="delivery" onClick={() => void send()} />}
    >
      <p>{t('orderPickHelp')}</p>
      {catalogue.data && catalogue.data.length > 0 && (
        <div className="item-tiles">
          {catalogue.data.map((item) => {
            const key = `item:${item.id}`;
            const qty = qtyOf(key);
            const line = { key, name: item.name, unit: item.unit, itemId: item.id };
            return (
              <div key={item.id} className="stack" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className="item-tile"
                  aria-pressed={qty > 0}
                  onClick={() => setQty(line, qty + 1)}
                >
                  <span className="item-tile__letter" aria-hidden="true">
                    {[...item.name][0]?.toUpperCase()}
                  </span>
                  <span>{item.name}</span>
                  {item.unit && <span className="small muted">{item.unit}</span>}
                </button>
                {qty > 0 && (
                  <QuantityStepper
                    label={item.name}
                    value={qty}
                    onChange={(q) => setQty(line, q)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <section className="stack">
        <TextField
          label={t('orderSomethingElse')}
          hint={t('orderSomethingElseHint')}
          value={other}
          maxLength={80}
          autoComplete="off"
          onInput={(e) => setOther((e.target as HTMLInputElement).value)}
        />
        <BigButton
          label={t('orderAddLine')}
          icon="add"
          variant="secondary"
          disabled={!other.trim()}
          onClick={addOther}
        />
      </section>

      <section className="stack" aria-labelledby="order-list">
        <h2 id="order-list" className="title">
          {t('orderYourList')}
        </h2>
        {lines.length === 0 ? (
          <p className="muted">{t('orderListEmpty')}</p>
        ) : (
          <ul className="list card">
            {lines.map((l) => (
              <li key={l.key} className="row row--between">
                <span>
                  {l.name}
                  {l.unit && <span className="small muted"> ({l.unit})</span>}
                </span>
                <QuantityStepper label={l.name} value={l.qty} onChange={(q) => setQty(l, q)} />
              </li>
            ))}
          </ul>
        )}
        {problem && (
          <p className="inline-error" role="alert">
            <Icon name="error" />
            <span>{problem}</span>
          </p>
        )}
      </section>

      <TextField
        label={t('orderAddress')}
        hint={t('orderAddressHint')}
        value={address}
        maxLength={200}
        autoComplete="street-address"
        onInput={(e) => setAddress((e.target as HTMLInputElement).value)}
      />
      <section className="stack">
        <h2 className="field__label">{t('orderWhen')}</h2>
        <Chips
          label={t('orderWhen')}
          value={when}
          onChange={setWhen}
          options={WHEN.map((w) => ({ value: w.value, label: t(w.key) }))}
        />
      </section>
    </Screen>
  );
}
