import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from '../app/router';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { backspace, inputSantim, pressKey, santimToInput } from './amount-input';
import {
  AmountKeypad,
  AmountText,
  BigButton,
  CalmBanner,
  ConfirmSheet,
  ErrorPanel,
  LimitUsageBar,
  Screen,
} from './index';

function wrap(ui: React.ReactNode, language: 'en' | 'am' = 'en') {
  return render(
    <I18nProvider language={language}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  );
}

describe('amount input', () => {
  const type = (keys: string) => [...keys].reduce(pressKey, '');

  it('types birr and up to two santim digits', () => {
    expect(type('1250')).toBe('1250');
    expect(type('12.505')).toBe('12.50');
    expect(type('.5')).toBe('0.5');
    expect(type('0.5.')).toBe('0.5');
    expect(type('007')).toBe('7');
    expect(type('1234567890')).toBe('123456789');
  });

  it('converts to integer santim', () => {
    expect(inputSantim('')).toBe(0);
    expect(inputSantim('12')).toBe(1200);
    expect(inputSantim('12.5')).toBe(1250);
    expect(inputSantim('12.05')).toBe(1205);
    expect(backspace('12.5')).toBe('12.');
    expect(santimToInput(1250)).toBe('12.5');
    expect(santimToInput(1205)).toBe('12.05');
    expect(santimToInput(1200)).toBe('12');
  });
});

describe('UI kit', () => {
  it('AmountText shows ETB and is read as words', () => {
    wrap(<AmountText santim={234050} />);
    expect(screen.getByRole('img', { name: '2340 birr 50 santim' })).toHaveTextContent(
      'ETB 2,340.50',
    );
  });

  it('AmountKeypad types an amount with on-screen keys only', async () => {
    function Harness() {
      const [v, setV] = useState('');
      return <AmountKeypad value={v} onChange={setV} label="Amount" />;
    }
    wrap(<Harness />);
    const user = userEvent.setup();
    for (const k of ['1', '2', '5']) await user.click(screen.getByRole('button', { name: k }));
    await user.click(screen.getByRole('button', { name: 'Point' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByRole('img', { name: '125 birr 50 santim' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete last number' }));
    expect(screen.getByRole('img', { name: '125 birr' })).toBeInTheDocument();
  });

  it('BigButton busy shows its busy label and ignores taps', async () => {
    const onClick = vi.fn();
    wrap(<BigButton label="Send code" busy busyLabel="Sending…" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Sending…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Screen has a title, a help button and the primary action', async () => {
    wrap(
      <Screen
        title="Your phone number"
        help={{ title: 'Help', body: 'Type your own number.' }}
        actions={<BigButton label="Send code" />}
      >
        <p>Body</p>
      </Screen>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Your phone number' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByText('Type your own number.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call Nota support' })).toHaveAttribute(
      'href',
      'tel:+251900000000',
    );
  });

  it('ConfirmSheet states the question with Yes, confirm / No', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    wrap(<ConfirmSheet open question="Remove Selam?" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('heading', { name: 'Remove Selam?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('ErrorPanel says what happened, what to do, and offers a retry and support', async () => {
    const onRetry = vi.fn();
    wrap(<ErrorPanel onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
    expect(alert).toHaveTextContent('Check your internet, then try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Call Nota support' })).toBeInTheDocument();
  });

  it('CalmBanner is a status, not an alert', () => {
    wrap(<CalmBanner message="Saved on this phone. Will send when internet returns." />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved on this phone');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('LimitUsageBar uses words and an icon, not only colour', () => {
    const { container } = wrap(
      <LimitUsageBar label="Limits" used={0.85} words="85% of the limit used" />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '85% of the limit used',
    );
    expect(screen.getByText('85% of the limit used')).toBeVisible();
    expect(container.querySelector('.usage--near svg')).not.toBeNull();
  });

  it('switches to Ethiopic text and sets the page language', () => {
    wrap(<ErrorPanel />, 'am');
    expect(screen.getByRole('alert')).toHaveTextContent('ችግር ተፈጥሯል።');
    expect(document.documentElement.lang).toBe('am');
  });
});
