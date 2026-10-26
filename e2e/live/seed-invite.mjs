// Live check against a local API (not run in CI): creates a shop owner, a shop and an
// invite for a new customer, and prints { customerPhone, inviteCode } as JSON.
//   API=http://localhost:8000 OTP=654321 node e2e/live/seed-invite.mjs
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';

const API = process.env.API ?? 'http://localhost:8000';
const OTP = process.env.OTP ?? '654321';
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}

const ownerPhone = `09${rnd()}`;
const customerPhone = `09${rnd()}`;
const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
await call('POST', '/v1/auth/otp', { phone: ownerPhone });
const owner = await call('POST', '/v1/auth/verify', {
  phone: ownerPhone,
  code: OTP,
  device: {
    id: randomUUID(),
    public_key: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  },
});
const merchantId = randomUUID();
await call(
  'POST',
  '/v1/merchants',
  {
    id: merchantId,
    shop_name: `Live Test Shop ${rnd().slice(0, 4)}`,
    terms_version: 'dube-2026-10',
  },
  owner.access_token,
);
const accountId = randomUUID();
await call(
  'POST',
  '/v1/accounts',
  { id: accountId, merchant_id: merchantId, phone: customerPhone, language: 'en' },
  owner.access_token,
);
const inviteCode = execFileSync(
  'docker',
  [
    'exec',
    'backend-postgres-1',
    'psql',
    '-U',
    process.env.PGUSER ?? 'mezgeb',
    '-d',
    process.env.PGDATABASE ?? 'mezgeb',
    '-tAc',
    `select code from account_invite where account_id = '${accountId}'`,
  ],
  { encoding: 'utf8' },
).trim();
console.log(JSON.stringify({ customerPhone, inviteCode, accountId }));
