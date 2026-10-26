import { useEffect, useState } from 'react';
import { kvGet, kvSet } from '../../storage/db';
import { useI18n } from '../../i18n';
import { BigButton, useSuccess } from '../../ui';
import { enablePush, pushState, serverKey } from './push';

const DISMISSED = 'push.dismissed';

/**
 * WEB-001: permission is asked only after a meaningful moment, with a plain reason ("Get a
 * message when Abebe adds a purchase"), never on first load. Shown on home once the person
 * has a dube book, while the browser has not been asked; "Not now" hides it for good.
 */
export function PushCard({ shop }: { shop: string }) {
  const { t } = useI18n();
  const success = useSuccess();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (pushState() !== 'off') return;
    void Promise.all([kvGet<boolean>(DISMISSED), serverKey()]).then(([dismissed, key]) => {
      if (live) setShow(!dismissed && key !== null);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;
  return (
    <section className="card">
      <p className="title">{t('pushCardTitle', { shop })}</p>
      <p className="small">{t('pushCardBody')}</p>
      <BigButton
        label={t('pushTurnOn')}
        icon="bell"
        busy={busy}
        busyLabel={t('loading')}
        onClick={() => {
          setBusy(true);
          void enablePush()
            .then((state) => {
              if (state === 'on') success(t('pushOn'));
              setShow(false);
            })
            .catch(() => setShow(false))
            .finally(() => setBusy(false));
        }}
      />
      <BigButton
        label={t('pushNotNow')}
        variant="quiet"
        onClick={() => {
          setShow(false);
          void kvSet(DISMISSED, true);
        }}
      />
    </section>
  );
}
