import { describe, expect, it } from 'vitest';
import subsetText from '../../scripts/font-subset.txt?raw';
import { am } from './am';

describe('Ethiopic font subset', () => {
  it('has every Ethiopic character of the Amharic strings (run pnpm font:subset)', () => {
    const subset = new Set(subsetText);
    const missing = new Set<string>();
    for (const text of Object.values(am)) {
      for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        if (cp >= 0x1200 && cp <= 0x139f && !subset.has(ch)) missing.add(ch);
      }
    }
    expect([...missing].join('')).toBe('');
  });
});
