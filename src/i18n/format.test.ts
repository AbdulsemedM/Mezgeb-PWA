import { describe, expect, it } from 'vitest';
import { formatMessage } from './format';

describe('formatMessage', () => {
  it('fills placeholders', () => {
    expect(formatMessage('We sent a code to {phone}.', { phone: '0911' })).toBe(
      'We sent a code to 0911.',
    );
  });

  it('leaves unknown placeholders visible', () => {
    expect(formatMessage('Hi {name}')).toBe('Hi {name}');
  });

  const wrong =
    '{count, plural, =0{Ask for a new code.} =1{1 try left.} other{{count} tries left.}}';

  it('chooses exact plural cases first', () => {
    expect(formatMessage(wrong, { count: 0 })).toBe('Ask for a new code.');
    expect(formatMessage(wrong, { count: 1 })).toBe('1 try left.');
    expect(formatMessage(wrong, { count: 4 })).toBe('4 tries left.');
  });

  it('keeps text around a plural', () => {
    expect(formatMessage('A {n, plural, one{# day} other{# days}} B', { n: 2 })).toBe('A 2 days B');
    expect(formatMessage('A {n, plural, one{# day} other{# days}} B', { n: 1 })).toBe('A 1 day B');
  });

  it('works with Ethiopic text', () => {
    expect(formatMessage('ዛሬ፦ {date}', { date: 'ጥቅምት 16' })).toBe('ዛሬ፦ ጥቅምት 16');
  });
});
