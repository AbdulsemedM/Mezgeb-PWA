import { p1363ToDer } from '@shared/ecdsa';
import { kvDelete, kvGet, kvSet } from '../storage/db';

/**
 * The PWA's device (ADR-005, ADR-016): an ECDSA P-256 key made with WebCrypto as
 * non-extractable, kept in IndexedDB as a CryptoKey. Script on the page can use it but nobody
 * can copy it out, so a stolen refresh cookie is useless elsewhere.
 */
export interface Device {
  id: string;
  /** SPKI DER, base64 (what the API registers). */
  publicKey: string;
  privateKey: CryptoKey;
}

const KEY = 'device';
let pending: Promise<Device> | undefined;

export function getDevice(): Promise<Device> {
  pending ??= load().catch((err: unknown) => {
    pending = undefined;
    throw err;
  });
  return pending;
}

/**
 * A new key and id: the old device was revoked (from another phone, or after a sign-out
 * elsewhere) or belongs to another person on this shared phone (ADR-005 `device_conflict`).
 */
export async function replaceDevice(): Promise<Device> {
  await kvDelete(KEY);
  pending = undefined;
  return getDevice();
}

async function load(): Promise<Device> {
  const saved = await kvGet<Device>(KEY);
  if (saved) return saved;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const device: Device = {
    id: crypto.randomUUID(),
    publicKey: toBase64(spki),
    privateKey: pair.privateKey,
  };
  await kvSet(KEY, device);
  return device;
}

/** DER (the wire format, ADR-001) base64 signature over the UTF-8 bytes of `text`. */
export async function signText(device: Device, text: string): Promise<string> {
  const raw = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      device.privateKey,
      new TextEncoder().encode(text),
    ),
  );
  return toBase64(p1363ToDer(raw));
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Tests only. */
export function forgetDeviceForTests(): void {
  pending = undefined;
}
