/**
 * Picture guides for installing (WEB-001 step 3): two or three simple drawings per browser.
 * Labels inside the drawings copy the browser's own menu text (usually English on Ethiopian
 * phones); the steps under them carry the app's translated words.
 */
const INK = 'var(--ink)';
const RULE = 'var(--rule)';
const PAPER = 'var(--surface)';
const MARK = 'var(--ledger)';

function Phone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg className="guide-picture" viewBox="0 0 200 150" role="img" aria-label={label}>
      <rect
        x="1"
        y="1"
        width="198"
        height="148"
        rx="14"
        fill={PAPER}
        stroke={RULE}
        strokeWidth="2"
      />
      {children}
    </svg>
  );
}

/** Chrome: the ⋮ button at the top right, circled. */
export function ChromeMenuButtonPicture({ label }: { label: string }) {
  return (
    <Phone label={label}>
      <rect x="12" y="14" width="140" height="26" rx="13" fill={RULE} />
      <text x="24" y="32" fontSize="12" fill={INK}>
        mezgeb.et
      </text>
      <circle cx="176" cy="27" r="16" fill="none" stroke={MARK} strokeWidth="4" />
      {[20, 27, 34].map((y) => (
        <circle key={y} cx="176" cy={y} r="2.6" fill={INK} />
      ))}
      <rect x="12" y="56" width="176" height="10" rx="5" fill={RULE} />
      <rect x="12" y="76" width="130" height="10" rx="5" fill={RULE} />
      <rect x="12" y="96" width="150" height="10" rx="5" fill={RULE} />
    </Phone>
  );
}

/** Chrome: the menu open, "Install app" highlighted. */
export function ChromeMenuItemPicture({ label }: { label: string }) {
  const rows = ['New tab', 'Bookmarks', 'Install app', 'Settings'];
  return (
    <Phone label={label}>
      <rect
        x="70"
        y="10"
        width="120"
        height="130"
        rx="8"
        fill={PAPER}
        stroke={RULE}
        strokeWidth="2"
      />
      {rows.map((row, i) => {
        const y = 22 + i * 30;
        const hot = row === 'Install app';
        return (
          <g key={row}>
            {hot && (
              <rect
                x="74"
                y={y - 4}
                width="112"
                height="26"
                rx="6"
                fill="var(--ledger-soft)"
                stroke={MARK}
                strokeWidth="3"
              />
            )}
            <text x="84" y={y + 13} fontSize="12" fontWeight={hot ? 700 : 400} fill={INK}>
              {row}
            </text>
          </g>
        );
      })}
    </Phone>
  );
}

/** iPhone Safari: the Share button in the bottom bar, circled. */
export function IphoneShareButtonPicture({ label }: { label: string }) {
  return (
    <Phone label={label}>
      <rect x="12" y="14" width="176" height="80" rx="8" fill={RULE} opacity="0.5" />
      <rect x="1" y="108" width="198" height="41" fill={RULE} opacity="0.6" />
      <circle cx="100" cy="128" r="16" fill="none" stroke={MARK} strokeWidth="4" />
      <path d="M100 118 v14 M94 124 l6 -6 6 6" stroke={INK} strokeWidth="2.5" fill="none" />
      <rect x="92" y="126" width="16" height="12" rx="2" fill="none" stroke={INK} strokeWidth="2" />
    </Phone>
  );
}

/** iPhone Safari: the share sheet, "Add to Home Screen" highlighted. */
export function IphoneAddToHomePicture({ label }: { label: string }) {
  const rows = ['Copy', 'Add to Reading List', 'Add to Home Screen', 'Find on Page'];
  return (
    <Phone label={label}>
      {rows.map((row, i) => {
        const y = 14 + i * 32;
        const hot = row === 'Add to Home Screen';
        return (
          <g key={row}>
            <rect
              x="12"
              y={y}
              width="176"
              height="26"
              rx="6"
              fill={hot ? 'var(--ledger-soft)' : PAPER}
              stroke={hot ? MARK : RULE}
              strokeWidth={hot ? 3 : 1.5}
            />
            <text x="22" y={y + 17} fontSize="12" fontWeight={hot ? 700 : 400} fill={INK}>
              {row}
            </text>
          </g>
        );
      })}
    </Phone>
  );
}

/** After installing: the Nota icon among other apps on the home screen. */
export function HomeScreenIconPicture({ label }: { label: string }) {
  return (
    <svg className="guide-picture" viewBox="0 0 200 120" role="img" aria-label={label}>
      <rect
        x="1"
        y="1"
        width="198"
        height="118"
        rx="14"
        fill="var(--chip)"
        stroke={RULE}
        strokeWidth="2"
      />
      {[0, 1, 2, 3].map((i) =>
        i === 2 ? (
          <g key={i}>
            <circle cx={30 + i * 47} cy="50" r="24" fill="none" stroke={MARK} strokeWidth="4" />
            <image href="/icons/icon-192.png" x={30 + i * 47 - 18} y="32" width="36" height="36" />
            <text
              x={30 + i * 47}
              y="92"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              fill={INK}
            >
              Nota
            </text>
          </g>
        ) : (
          <rect key={i} x={30 + i * 47 - 18} y="32" width="36" height="36" rx="9" fill={RULE} />
        ),
      )}
    </svg>
  );
}
