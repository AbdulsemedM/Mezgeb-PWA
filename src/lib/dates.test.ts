import { describe, expect, it } from 'vitest';
import { displayDate, displayTime, displayWhen } from './dates';

describe('dates', () => {
  it('formats like the API statements', () => {
    expect(displayDate('2026-10-22', 'en', 'gregorian')).toBe('22 Oct 2026');
    expect(displayDate('2026-10-22', 'om', 'gregorian')).toBe('22/10/2026');
    expect(displayDate('2026-10-22', 'en', 'ethiopian')).toBe('12 Tikimt 2019');
    expect(displayDate('2026-10-22', 'am', 'ethiopian')).toBe('ጥቅምት 12 2019 ዓ.ም.');
  });

  it('shows Addis Ababa clock time', () => {
    expect(displayTime('2026-10-22T07:42:00.000Z')).toBe('10:42');
  });

  it('shows only the time for today, and the date otherwise', () => {
    const now = new Date('2026-10-22T12:00:00.000Z');
    expect(displayWhen('2026-10-22T07:42:00.000Z', 'en', 'gregorian', now)).toBe('10:42');
    expect(displayWhen('2026-10-20T07:42:00.000Z', 'en', 'gregorian', now)).toBe(
      '20 Oct 2026 10:42',
    );
  });
});
