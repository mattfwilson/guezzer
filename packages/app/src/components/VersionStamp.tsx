/**
 * Build-time version stamp (D-07): `v{pkgVersion} · {shortSha} · built
 * {YYYY-MM-DD}`. The values are build-time `define` constants injected by
 * vite.config.ts (declared in vite-env.d.ts) — never a runtime fetch, so
 * this works fully offline. Rendered as plain text only, never innerHTML.
 */
export function VersionStamp() {
  return (
    <p className="text-[14px] font-semibold leading-tight text-text-muted">
      {`v${__APP_VERSION__} · `}
      <span className="tabular-nums">{__GIT_SHA__}</span>
      {` · built ${__BUILD_DATE__}`}
    </p>
  );
}
