/**
 * Which install path a browser gets (WEB-001 step 3). Only Chromium on Android has an install
 * prompt; in-app browsers (Telegram, Facebook…) cannot install at all; iPhones need the Share
 * menu. Decided from the user agent, because that is all a page can see.
 */
export type InstallPath =
  /** Chromium on Android (Chrome, Edge, Opera, Samsung Internet): the prompt or the ⋮ menu. */
  | 'android-chromium'
  /** A browser inside another app on Android: open the page in Chrome instead. */
  | 'android-in-app'
  /** Safari on iPhone/iPad: Share → Add to Home Screen. */
  | 'ios-safari'
  /** Another browser or an in-app browser on iPhone: open in Safari first. */
  | 'ios-other'
  /** Anything else (desktop, Firefox on Android…): the browser's own menu. */
  | 'other';

const IN_APP =
  /FBAN|FBAV|FB_IAB|Instagram|Telegram|TelegramBot|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|GSA\//i;

export function installPath(ua: string, maxTouchPoints = 0): InstallPath {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/.test(ua);
    return otherBrowser || IN_APP.test(ua) || !/Safari\//.test(ua) ? 'ios-other' : 'ios-safari';
  }
  if (/Android/.test(ua)) {
    // Android WebViews carry "; wv)" and often no "Chrome/x Mobile Safari" pair.
    if (IN_APP.test(ua) || /; wv\)/.test(ua)) return 'android-in-app';
    if (/Firefox\//.test(ua)) return 'other';
    if (/Chrome\/\d/.test(ua)) return 'android-chromium';
    return 'other';
  }
  return 'other';
}

export function currentInstallPath(): InstallPath {
  return installPath(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

/**
 * An Android intent that opens `url` in Chrome (WEB-001 "Open in Chrome"). If Chrome is
 * missing, Android falls back to the browser_fallback_url in the default browser.
 */
export function chromeIntentUrl(url: string): string {
  const u = new URL(url);
  return (
    `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};` +
    `package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
  );
}
