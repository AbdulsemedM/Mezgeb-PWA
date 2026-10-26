import { act, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { captureInstallPrompt, resetInstallPromptForTests } from './install-prompt';
import { PROMPT_WAIT_MS } from './InstallScreen';

const UA = {
  chrome:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  telegram:
    'Mozilla/5.0 (Linux; Android 12; TECNO; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Telegram-Android/11.2.3',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  iphoneTelegram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

function useUserAgent(ua: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

/** What Chrome fires when the page is installable. */
function firePrompt(outcome: 'accepted' | 'dismissed') {
  const e = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn(async () => undefined);
  e.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(e);
  });
  return e;
}

describe('W2: install screen (WEB-001 step 3)', () => {
  beforeAll(() => captureInstallPrompt(window));

  beforeEach(() => {
    resetInstallPromptForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('Chrome with a ready prompt: one tap installs, then the "open it from there" screen', async () => {
    useUserAgent(UA.chrome);
    const app = renderApp('/install');
    const e = firePrompt('accepted');
    await userEvent.click(screen.getByRole('button', { name: 'Put Nota on my home screen' }));
    expect(e.prompt).toHaveBeenCalledOnce();
    expect(await screen.findByText('Open it from there.')).toBeVisible();
    expect(app.path()).toBe('/installed');
    expect(screen.getByRole('img', { name: 'The Nota icon on the home screen' })).toBeVisible();
  });

  it('Chrome, prompt not ready yet: "Getting ready…", then the prompt when it comes', async () => {
    useUserAgent(UA.chrome);
    const app = renderApp('/install');
    await userEvent.click(screen.getByRole('button', { name: 'Put Nota on my home screen' }));
    expect(screen.getByRole('button', { name: 'Getting ready…' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    const e = firePrompt('accepted');
    await screen.findByText('Open it from there.');
    expect(e.prompt).toHaveBeenCalledOnce();
    expect(app.path()).toBe('/installed');
  });

  it('Chrome, no prompt within the wait: the picture guide for the ⋮ menu', async () => {
    useUserAgent(UA.chrome);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp('/install');
    await userEvent.click(screen.getByRole('button', { name: 'Put Nota on my home screen' }));
    act(() => {
      vi.advanceTimersByTime(PROMPT_WAIT_MS + 10);
    });
    expect(await screen.findByText('Use the browser menu')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Tap ⋮ at the top right.' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open in Chrome' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^intent:\/\/localhost.*package=com\.android\.chrome/),
    );
  });

  it('Chrome, "Not now" in the prompt: a calm note and the guide, never a dead end', async () => {
    useUserAgent(UA.chrome);
    renderApp('/install');
    firePrompt('dismissed');
    await userEvent.click(screen.getByRole('button', { name: 'Put Nota on my home screen' }));
    expect(
      await screen.findByText('Not now? You can put Nota on your home screen later.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Continue in the browser' })).toBeVisible();
  });

  it('installed from the browser menu: appinstalled moves on', async () => {
    useUserAgent(UA.chrome);
    const app = renderApp('/install');
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await screen.findByText('Open it from there.');
    expect(app.path()).toBe('/installed');
  });

  it('Telegram in-app browser: "Open in Chrome"', () => {
    useUserAgent(UA.telegram);
    renderApp('/install');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Open Nota in Chrome');
    expect(screen.getByRole('link', { name: 'Open in Chrome' }).getAttribute('href')).toMatch(
      /^intent:\/\/.*;package=com\.android\.chrome;S\.browser_fallback_url=/,
    );
  });

  it('iPhone Safari: Share → Add to Home Screen pictures', () => {
    useUserAgent(UA.iphone);
    renderApp('/install');
    expect(screen.getByText('On iPhone')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Tap the Share button at the bottom.' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Tap “Add to Home Screen”.' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull();
  });

  it('iPhone in-app browser: open in Safari first', () => {
    useUserAgent(UA.iphoneTelegram);
    renderApp('/install');
    expect(screen.getByText('Tap ⋯ or the Share button, then “Open in Safari”.')).toBeVisible();
  });

  it.each([UA.chrome, UA.telegram, UA.iphone])(
    'always offers a quiet "Continue in the browser" (%#)',
    (ua) => {
      useUserAgent(ua);
      renderApp('/install');
      expect(screen.getByRole('link', { name: 'Continue in the browser' })).toHaveAttribute(
        'href',
        '/signin',
      );
    },
  );
});
