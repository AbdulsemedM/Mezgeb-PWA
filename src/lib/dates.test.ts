import { describe, expect, it } from 'vitest';
import { displayDate, displayTime, displayWhen, statementRange } from './dates';

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

describe('statement periods (LED-7)', () => {
  it('Gregorian months', () => {
    expect(statementRange('this_month', 'gregorian', '2026-10-26', '2026-01-05')).toEqual({
      from: '2026-10-01',
      to: '2026-10-26',
    });
    expect(statementRange('last_month', 'gregorian', '2026-10-26', '2026-01-05')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(statementRange('last_month', 'gregorian', '2027-01-10', '2026-01-05')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('Ethiopian months: 1 Tikimt 2019 is 11 Oct 2026', () => {
    expect(statementRange('this_month', 'ethiopian', '2026-10-26', '2026-01-05')).toEqual({
      from: '2026-10-11',
      to: '2026-10-26',
    });
    // Meskerem 2019: 11 Sep to 10 Oct 2026.
    expect(statementRange('last_month', 'ethiopian', '2026-10-26', '2026-01-05')).toEqual({
      from: '2026-09-11',
      to: '2026-10-10',
    });
    // In Meskerem, last month is Pagume of the year before (6 Sep to 10 Sep 2026).
    expect(statementRange('last_month', 'ethiopian', '2026-09-20', '2026-01-05')).toEqual({
      from: '2026-09-06',
      to: '2026-09-10',
    });
  });

  it('everything: from the start of the dube book to today', () => {
    expect(statementRange('everything', 'ethiopian', '2026-10-26', '2026-03-02')).toEqual({
      from: '2026-03-02',
      to: '2026-10-26',
    });
  });
});
