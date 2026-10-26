// No imports: the service worker bundles this too.

/**
 * Where a tapped notification opens (the push data carries the event and, for entries, the
 * account). Shared with the service worker.
 */
export function pathForPush(data: { event?: string; account_id?: string } | undefined): string {
  const event = data?.event ?? '';
  const acc = data?.account_id;
  if (!acc) return '/';
  if (event.startsWith('order_')) return `/shops/${acc}/orders`;
  if (event.startsWith('payme') || event.startsWith('payment_')) return `/shops/${acc}/pay`;
  if (event.startsWith('representative_')) return `/shops/${acc}/people`;
  if (event.startsWith('limit_')) return `/shops/${acc}/limits`;
  return `/shops/${acc}`;
}
