/**
 * Wake-lock unsupported fallback (SHOW-12, 04-UI-SPEC §Copywriting). A muted,
 * dismissible, once-per-show notice shown ONLY when the Wake Lock API is absent,
 * denied, or a false-positive that never held (installed iOS PWA < 18.4,
 * 04-RESEARCH §Pitfall 1). The reacquire path is silent — this message is the
 * single visible signal that auto screen-wake is unavailable, so the screen
 * dimming mid-show is never a silent surprise.
 *
 * Presentational: visibility + once-per-show dedup are owned by ShowView.
 */
import { X } from "lucide-react";
import { config } from "../config.ts";

interface WakeLockNoticeProps {
  /** True when the wake lock is unsupported and the notice has not been dismissed. */
  visible: boolean;
  /** Dismiss for the rest of this show (once-per-show, D-09-calm). */
  onDismiss: () => void;
}

export function WakeLockNotice({ visible, onDismiss }: WakeLockNoticeProps) {
  if (!visible) return null;

  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-hairline bg-elevated px-4 py-2">
      <p className="flex-1 text-[14px] leading-tight text-text-muted">
        {config.copy.show.wakeLockFallback}
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex min-h-8 min-w-8 items-center justify-center text-text-muted touch-manipulation"
      >
        <X size={16} />
      </button>
    </div>
  );
}
