/**
 * GizzMap avatar picker — the shared <Sheet> over the config Gizz emoji set
 * (config.map.AVATARS; every entry a real KGLW reference). Selection persists
 * via setMyAvatar (meta) and rides the next beacon immediately (the sync
 * hook's avatar-change gate). "Use my initial" clears back to null.
 */
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";

export function AvatarSheet({
  open,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  current: string | null;
  onClose: () => void;
  onPick: (avatar: string | null) => void;
}) {
  const copy = config.copy.map;
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={copy.avatarHeading}>
      <h2 className="text-[17px] font-semibold">{copy.avatarHeading}</h2>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {config.map.AVATARS.map((option) => {
          const active = current === option.emoji;
          return (
            <button
              key={option.emoji}
              type="button"
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => onPick(option.emoji)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl border px-1 ${
                active ? "border-accent bg-accent/10" : "border-hairline"
              }`}
            >
              <span className="text-[26px] leading-none">{option.emoji}</span>
              <span className="mt-1 truncate text-[10px] leading-tight text-text-muted">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onPick(null)}
        className={`mt-3 min-h-11 w-full rounded-xl border ${
          current === null ? "border-accent" : "border-hairline"
        }`}
      >
        {copy.avatarUseInitial}
      </button>
    </Sheet>
  );
}
