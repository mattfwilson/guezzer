/**
 * The "Whose dex is this?" typed-name → "it's mine, restore it" decision, as a
 * pure function (PWA-05 / D-03). Extracted VERBATIM from
 * `SettingsView.resolveNamePrompt` (commit e08ceee) so the routing behavior is
 * byte-equivalent — this module adds NO behavior, only a directly-testable seam.
 * Mirrors `classifyImport`'s style: exported, zero DB/DOM touch, trimmed +
 * case-insensitive nullable-string handling.
 *
 * The decision has TWO legs:
 *   - local-owner leg — the typed name matches the device's own `ownerName`.
 *   - file-owner  leg — the typed name matches the BACKUP FILE's own owner. This
 *     is the PWA-05 / WARNING-1 hardening: on an evicted-DB reinstall the local
 *     owner is unknown (""), so without this leg, typing your own name here would
 *     dead-end in read-only compare instead of restoring the backup it's named
 *     after. Matching the file's owner is the intentional recovery path
 *     (threat T-09-04, accepted: a personal offline tool for <10 friends).
 *
 * The `answer !== ""` guard is load-bearing: `envelope.owner` of `""` trims to
 * `""`, and the guard is what prevents an empty typed answer from matching an
 * empty file owner. Do NOT drop it.
 */
export function isTypedNameMine(
  typedName: string,
  localOwnerName: string | null,
  fileOwner: string | null | undefined,
): boolean {
  const answer = typedName.trim();
  const a = answer.toLowerCase();
  const localOwner = (localOwnerName ?? "").trim().toLowerCase();
  const file = fileOwner?.trim().toLowerCase();
  return (
    answer !== "" &&
    ((localOwner !== "" && a === localOwner) || (file != null && a === file))
  );
}
