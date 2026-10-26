import { describe, expect, it } from 'vitest';
import { translator } from '../i18n';
import { formatAmount, spokenAmount } from './money';

describe('money', () => {
  it('formats with ETB or ብር and separators', () => {
    expect(formatAmount(234050, 'en')).toBe('ETB 2,340.50');
    expect(formatAmount(234050, 'am')).toBe('2,340.50 ብር');
  });

  it('speaks amounts in words', () => {
    const t = translator('en');
    expect(spokenAmount(t, 234000)).toBe('2340 birr');
    expect(spokenAmount(t, 234050)).toBe('2340 birr 50 santim');
    expect(spokenAmount(t, -500)).toBe('minus 5 birr');
  });
});
