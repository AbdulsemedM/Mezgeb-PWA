import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDeviceForTests } from '../auth/device-key';
import { resetSessionForTests, restoreSession } from '../auth/session';
import { resetDbForTests } from '../storage/db';
import { signedIn, TOKENS } from '../test/fixtures';
import { fakeFetch, json } from '../test/render';
import { enqueue, flush, onInvalidate, queuedWrites, resetQueueForTests } from './queue';

describe('write queue (CLAUDE.md rule 5)', () => {
  beforeEach(async () => {
    await resetDbForTests();
    forgetDeviceForTests();
    resetSessionForTests();
    resetQueueForTests();
    await signedIn();
    await restoreSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const write = (n: number) => ({
    kind: 'rep.create',
    method: 'POST' as const,
    path: '/v1/accounts/acc-1/representatives',
    body: { id: `rep-${n}`, name: `P${n}` },
    refresh: ['book:acc-1'],
  });

  it('offline: kept on the phone; sent in order when the internet returns', async () => {
    fakeFetch({});
    await enqueue(write(1));
    await enqueue(write(2));
    await flush();
    expect(await queuedWrites()).toHaveLength(2);

    const api = fakeFetch({
      'POST /v1/auth/web/refresh': () => json(200, TOKENS),
      'POST /v1/accounts/:id/representatives': () => json(201, {}),
    });
    const refreshed: string[] = [];
    onInvalidate((k) => refreshed.push(k));
    await flush();
    expect(await queuedWrites()).toEqual([]);
    expect(
      api.calls
        .filter((c) => c.method === 'POST' && c.path.includes('representatives'))
        .map((c) => c.body.id),
    ).toEqual(['rep-1', 'rep-2']);
    expect(refreshed).toEqual(['book:acc-1', 'book:acc-1']);
  });

  it('a lost answer is safe: the same client id is sent again and answered with the original', async () => {
    let n = 0;
    const api = fakeFetch({
      'POST /v1/auth/web/refresh': () => json(200, TOKENS),
      'POST /v1/accounts/:id/representatives': () => {
        n += 1;
        if (n === 1) throw new TypeError('connection reset');
        return json(200, {});
      },
    });
    await enqueue(write(1));
    await flush();
    await flush();
    const ids = api.calls.filter((c) => c.path.includes('representatives')).map((c) => c.body.id);
    expect(ids).toEqual(['rep-1', 'rep-1']);
    expect(await queuedWrites()).toEqual([]);
  });

  it('a refusal is kept and marked, and does not block later writes', async () => {
    fakeFetch({
      'POST /v1/auth/web/refresh': () => json(200, TOKENS),
      'POST /v1/accounts/:id/representatives': ({ body }) =>
        body.id === 'rep-1' ? json(400, { code: 'validation_failed' }) : json(201, {}),
    });
    await enqueue(write(1));
    await enqueue(write(2));
    await flush();
    const left = await queuedWrites();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({
      body: { id: 'rep-1' },
      failed: { code: 'validation_failed', status: 400 },
    });
  });

  it('a server error keeps the write for later, in order', async () => {
    fakeFetch({
      'POST /v1/auth/web/refresh': () => json(200, TOKENS),
      'POST /v1/accounts/:id/representatives': () => json(503, {}),
    });
    await enqueue(write(1));
    await enqueue(write(2));
    await flush();
    expect((await queuedWrites()).map((w) => w.failed)).toEqual([undefined, undefined]);
  });
});
