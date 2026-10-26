import { useEffect } from 'react';
import type { PaymeRequest } from '../../data/book';
import { enqueue } from '../../data/queue';

const marked = new Set<string>();

/**
 * ADR-013 `seen`: once the customer has the pay-me request on screen, the shop sees it was
 * seen. Queued like any write (it is idempotent), once per request per app run.
 */
export function useMarkSeen(requests: PaymeRequest[]): void {
  const ids = requests
    .filter((p) => p.status === 'sent')
    .map((p) => p.id)
    .join(',');
  useEffect(() => {
    for (const id of ids.split(',').filter(Boolean)) {
      if (marked.has(id)) continue;
      marked.add(id);
      void enqueue({ kind: 'payme.seen', method: 'POST', path: `/v1/payme-requests/${id}/seen` });
    }
  }, [ids]);
}

/** Tests only. */
export function resetMarkSeenForTests(): void {
  marked.clear();
}
