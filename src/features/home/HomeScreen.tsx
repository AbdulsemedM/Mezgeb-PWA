import { listMyAccounts } from '../../data/accounts';
import { useT } from '../../i18n';
import { useLoad } from '../../lib/use-load';
import { CalmBanner, ChoiceTile, Screen } from '../../ui';

/** My shops. W4 replaces this with the full dube book (balances, limits, offline cache). */
export function HomeScreen() {
  const t = useT();
  const loaded = useLoad(listMyAccounts, []);
  return (
    <Screen title={t('homeTitle')}>
      {loaded.status === 'offline' && <CalmBanner message={t('needInternetAction')} />}
      {loaded.status === 'ready' && (
        <ul className="list">
          {loaded.data
            .filter((a) => a.status !== 'pending')
            .map((a) => (
              <li key={a.id}>
                <ChoiceTile title={a.shop.name} icon="store" />
              </li>
            ))}
        </ul>
      )}
    </Screen>
  );
}
