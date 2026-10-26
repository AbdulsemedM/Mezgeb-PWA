/** Build-time settings (Vite env). */
export const config = {
  /** API origin; empty means same origin (the dev server proxies /v1). */
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, ''),
  // TODO(W9): the real Nota support line (same placeholder as the Flutter app).
  supportPhone: import.meta.env.VITE_SUPPORT_PHONE ?? '+251900000000',
};
