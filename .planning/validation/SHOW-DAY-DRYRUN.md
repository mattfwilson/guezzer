# Show-Day Dry-Run & Live-Poll Checklist (VALID-02 / SYNC-01)

The critical-path code is built + verified and the model is signed off. The one thing
unproven is **the whole system exercised live on real hardware**. Phase 4 UAT tested the
manual loop on an iPhone; the **live `latest` sync** and the **end-to-end loop *with*
sync** have only been tested in unit/mock form. This closes that.

Do **Part A at home first** (any day — no show needed), then **Part B at show #1**.
Check boxes as you go; note anything that surprises you.

Device matrix: iOS 16 Pro is covered by prior UAT. **If you have an Android phone in the
crew, run Part A on it too** — Android has never been tested (only iOS).

---

## Part A — Home mock rehearsal (no live show required)

Load the app over the HTTPS tunnel and **install it to the home screen** (the real
offline surface). Then walk the full loop. Live sync is simulated with the
`?mockLatest=1` URL flag (feeds the suggestion strip without a real show).

### A1. Install & offline (PWA)
- [ ] Install to home screen (Add to Home Screen); launch from the icon, not the tab.
- [ ] Put the phone in **airplane mode**, cold-launch the app → it fully loads and is usable offline. *(Proves offline-complete-on-first-load.)*
- [ ] Screen **stays awake** during a show (Wake Lock) — start a show, leave it untouched 60s, screen doesn't dim.

### A2. Full show loop (the core value)
- [ ] LiveGizz → **Start Show**.
- [ ] Pre-opener: tap the center **"Search for the opener"** orb → search → pick the opener.
- [ ] Prediction fan appears (5 orbs) around the current-song center node.
- [ ] **Log a hit**: tap a predicted orb → it logs and the fan advances to the new song.
- [ ] **Log a miss (in catalog)**: search a song that *wasn't* predicted → logs, trail updates.
- [ ] **Log an unknown**: use the **???** placeholder for a song you can't name → trail shows a placeholder.
- [ ] **Long-press** an orb → the "why" info sheet opens (quick tap still logs — confirm both).
- [ ] **Set break** and **encore** snapshots record correctly (SHOW-06).
- [ ] **Undo** a log; **edit / delete / rename** a trail node (TrailNodeSheet).
- [ ] Running **tally** + comet trail look right as the set grows.
- [ ] **End Show** → confirm dialog → **recap** appears; the show becomes read-only.
- [ ] **Dex credit**: the songs you logged now show as caught in GizzDex.

### A3. Live sync — mock (`?mockLatest=1`)
- [ ] Relaunch with `?mockLatest=1`, start a show → the **suggestion strip** surfaces mock "just played" rows.
- [ ] **Adopt** a suggestion → it logs with no confirm (fast path), and the suggestion clears.
- [ ] Suggestions are **advisory only** — nothing auto-merges into your setlist without you adopting it.

### A4. Backup / restore — the phone-loss recovery flow (WARNING-1)
- [ ] Settings → **Export** your data (JSON backup). Confirm the file downloads.
- [ ] **Force-quit and relaunch** → your active show + dex are still there (persistence).
- [ ] **Restore test:** simulate a fresh device — clear site data / use a private window (empty DB), then **Import your OWN backup**. It should **restore your data**, NOT open a read-only "compare with a friend" view. ⚠️ *This is the known WARNING-1 fork (evicted-DB owner-name-null misroute; a related fix landed in quick task `260716-vw2`). If it opens compare instead of restoring, tell me — that's the bug to close.*

---

## Part B — At show #1 (live)

Only these need a real show; everything else is proven by Part A.

- [ ] **Real live poll:** with a show active and phone online, the app is picking up
      the *actual* kglw.net `latest` rows into the suggestion strip (≤1 request/60s —
      it never hammers the volunteer API).
- [ ] **Offline flap:** lose signal (venues are bad) → the app stays calm, keeps
      working from cache, and **silently resumes** polling when signal returns (no error spam, no reload).
- [ ] **One-thumb-in-the-dark:** you can log the whole set with one thumb, screen at low
      brightness, without mis-taps — the actual reason this app exists.
- [ ] **Wake Lock holds** through a full set on the real device.
- [ ] After the show: **End Show → recap → export** the night's data before you leave.

---

## What each part proves (maps to the open gaps)

| Part | Closes |
|---|---|
| A2 full loop on real hardware | VALID-02 (integrated loop, esp. if run on Android too) |
| A3 + B live poll | SYNC-01 (the `latest` sync, mock then real) |
| A4 restore | WARNING-1 (phone-loss recovery across tour nights) |
| B one-thumb / offline / wake lock | the core "dark venue" value under real conditions |

Report back anything that fails or feels wrong and I'll turn it into a fix. The tuning-tag
review ([[TUNING-TAG-REVIEW.md]], DATA-04) is the separate 5-min desk task — no show needed.
