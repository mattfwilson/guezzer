/**
 * Accurate inline-SVG replica of Apple's Share icon (rounded-corner tray,
 * open at the top, with an arrow exiting straight up). Deliberately NOT a
 * lucide `Share`/`Share2` substitute — iOS users identify the button by its
 * exact shape, not its name (D-04, UI-SPEC §Design System exception,
 * 03-RESEARCH.md §Don't Hand-Roll).
 */
export function IosShareGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Arrow shaft + head, exiting the tray upward */}
      <path d="M12 2.5v11.5" />
      <path d="M8 6.5 12 2.5 16 6.5" />
      {/* Tray / box, open at the top, rounded bottom corners */}
      <path d="M6 10.5v8.25A2.25 2.25 0 0 0 8.25 21h7.5A2.25 2.25 0 0 0 18 18.75V10.5" />
    </svg>
  );
}
