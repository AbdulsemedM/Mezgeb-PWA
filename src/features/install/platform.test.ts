import { describe, expect, it } from 'vitest';
import { chromeIntentUrl, installPath } from './platform';

const UA = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  telegramAndroid:
    'Mozilla/5.0 (Linux; Android 12; TECNO KG5p Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Telegram-Android/11.2.3',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 11; itel A571W; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
  webviewAndroid:
    'Mozilla/5.0 (Linux; Android 9; Infinix X650 Build/PPR1.180610.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  iphoneTelegram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

describe('installPath', () => {
  it.each([
    ['chromeAndroid', 'android-chromium'],
    ['samsung', 'android-chromium'],
    ['telegramAndroid', 'android-in-app'],
    ['facebookAndroid', 'android-in-app'],
    ['webviewAndroid', 'android-in-app'],
    ['firefoxAndroid', 'other'],
    ['iphoneSafari', 'ios-safari'],
    ['iphoneChrome', 'ios-other'],
    ['iphoneTelegram', 'ios-other'],
    ['desktopChrome', 'other'],
  ] as const)('%s → %s', (name, path) => {
    expect(installPath(UA[name])).toBe(path);
  });

  it('treats an iPad asking for the desktop site as iOS Safari', () => {
    expect(installPath(UA.ipadDesktopMode, 5)).toBe('ios-safari');
    expect(installPath(UA.ipadDesktopMode, 0)).toBe('other');
  });
});

describe('chromeIntentUrl', () => {
  it('opens the same page in Chrome, falling back to the default browser', () => {
    expect(chromeIntentUrl('https://mezgeb.et/install?from=i')).toBe(
      'intent://mezgeb.et/install?from=i#Intent;scheme=https;package=com.android.chrome;' +
        'S.browser_fallback_url=https%3A%2F%2Fmezgeb.et%2Finstall%3Ffrom%3Di;end',
    );
  });
});
