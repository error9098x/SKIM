/**
 * EV charger illustration: a DC post with a screen and a cable whose dashes stream toward the plug
 * while `charging` is on. Pure SVG + CSS; colours come from the semantic tokens.
 */
export function ChargerArt({ charging = true, className = '' }: { charging?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="EV charger">
      <defs>
        <linearGradient id="post" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--paper-2))" />
          <stop offset="1" stopColor="rgb(var(--paper))" />
        </linearGradient>
      </defs>
      {/* ground shadow */}
      <ellipse cx="40" cy="88" rx="26" ry="3" fill="rgb(var(--ink) / 0.08)" />
      {/* post */}
      <rect x="22" y="10" width="36" height="76" rx="8" fill="url(#post)" stroke="rgb(var(--rule))" />
      <rect x="22" y="10" width="36" height="6" rx="3" fill="rgb(var(--skim))" opacity="0.9" />
      {/* screen */}
      <rect x="28" y="22" width="24" height="18" rx="3" fill="rgb(var(--paper))" stroke="rgb(var(--rule))" />
      <path d="M38 26l-4 7h5l-2 5 6-8h-5l2-4z" fill={charging ? 'rgb(var(--repaid))' : 'rgb(var(--ink-3))'} />
      {/* status leds */}
      <circle cx="33" cy="48" r="1.6" fill={charging ? 'rgb(var(--repaid))' : 'rgb(var(--rule))'} className={charging ? 'charger-blink' : ''} />
      <circle cx="40" cy="48" r="1.6" fill="rgb(var(--rule))" />
      <circle cx="47" cy="48" r="1.6" fill="rgb(var(--rule))" />
      {/* holster */}
      <rect x="54" y="52" width="8" height="12" rx="2" fill="rgb(var(--paper-2))" stroke="rgb(var(--rule))" />
      {/* cable */}
      <path d="M58 64 C 70 72, 82 66, 84 52 S 80 30, 74 28" fill="none" stroke="rgb(var(--rule))" strokeWidth="3" strokeLinecap="round" />
      {charging && (
        <path
          d="M58 64 C 70 72, 82 66, 84 52 S 80 30, 74 28"
          fill="none"
          stroke="rgb(var(--repaid))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="2 6"
          className="charger-flow"
        />
      )}
      {/* plug */}
      <rect x="68" y="22" width="10" height="9" rx="2" fill="rgb(var(--paper-2))" stroke="rgb(var(--ink-3))" />
    </svg>
  );
}
