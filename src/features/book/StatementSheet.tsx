import { useEffect, useMemo, useState } from 'react';
import { apiBlob, OfflineError } from '../../api/client';
import { useI18n } from '../../i18n';
import { localDate, type StatementPeriod, statementRange } from '../../lib/dates';
import { BigButton, CalmBanner, ChoiceTile, Sheet } from '../../ui';
import { useCalendar } from './common';

/**
 * LED-7 / US-14: a PDF statement (every purchase and payment, who took what, the balance) in
 * the person's language and calendar, shared or saved. Online only: the server makes it.
 */
export function StatementSheet({
  open,
  onClose,
  accountId,
  shop,
  since,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  shop: string;
  /** When the dube book started (the account's creation), for "Everything". */
  since: string;
}) {
  const { t } = useI18n();
  const calendar = useCalendar();
  const [state, setState] = useState<'choose' | 'making' | 'ready' | 'offline' | 'failed'>(
    'choose',
  );
  const [file, setFile] = useState<File | null>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function make(period: StatementPeriod) {
    setState('making');
    const today = localDate(new Date());
    const { from, to } = statementRange(period, calendar, today, localDate(new Date(since)));
    try {
      const blob = await apiBlob(`/v1/accounts/${accountId}/statement.pdf?from=${from}&to=${to}`);
      const name = `${shop.replace(/[^\p{L}\p{N}]+/gu, '-')}-${from}-${to}.pdf`;
      setFile(new File([blob], name, { type: 'application/pdf' }));
      setState('ready');
    } catch (err) {
      setState(err instanceof OfflineError ? 'offline' : 'failed');
    }
  }

  const canShare =
    file !== null &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  function close() {
    setState('choose');
    setFile(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={t('statementTitle')}>
      {state === 'choose' && (
        <>
          <p>{t('statementHelp')}</p>
          <div className="list">
            {(
              [
                ['this_month', 'statementThisMonth'],
                ['last_month', 'statementLastMonth'],
                ['everything', 'statementEverything'],
              ] as const
            ).map(([period, key]) => (
              <ChoiceTile
                key={period}
                title={t(key)}
                icon="download"
                onClick={() => void make(period)}
              />
            ))}
          </div>
        </>
      )}
      {state === 'making' && (
        <p role="status" className="row">
          <span className="spinner" aria-hidden="true" />
          {t('makingStatement')}
        </p>
      )}
      {state === 'offline' && <CalmBanner message={t('statementOffline')} />}
      {state === 'failed' && (
        <CalmBanner tone="warn" icon="warning" message={t('statementFailed')} />
      )}
      {state === 'ready' && file && url && (
        <div className="sheet__actions">
          <p role="status">{t('statementReady')}</p>
          {canShare && (
            <BigButton
              label={t('shareStatement')}
              icon="share"
              onClick={() =>
                void navigator.share({ files: [file], title: file.name }).catch(() => undefined)
              }
            />
          )}
          <BigButton
            label={t('saveStatement')}
            icon="download"
            variant={canShare ? 'secondary' : 'primary'}
            href={url}
            download={file.name}
          />
        </div>
      )}
      <div className="sheet__actions">
        {(state === 'offline' || state === 'failed') && (
          <BigButton label={t('tryAgain')} icon="refresh" onClick={() => setState('choose')} />
        )}
        <BigButton label={t('helpClose')} variant="secondary" onClick={close} />
      </div>
    </Sheet>
  );
}
