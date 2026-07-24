# Phase 20: Presence & Interactions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 20-presence-interactions
**Areas discussed:** Coarse activity vocab, Wave & reaction UX, Spam/coalescing, Presence↔Friends fusion, Offline/dead-signal venue, Channel architecture, Self-presence/privacy, Wave persistence, Exact emoji palette, Global online indicator, Haptics, Wave from FriendDetail

---

## Coarse activity vocabulary — status set (PRES-04)

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 tabs + idle | Report the real active tab (LiveGizz/GizzVerse/GizzMap/GizzDex/GizzGames) + idle. Most honest. | ✓ |
| Requirement's 4 values | Collapse to LiveGizz/GizzDex/GizzVerse/idle as PRES-04 literally lists. | |
| Just 'At a show' vs online | Only distinguish Show Mode from generic online. | |

**User's choice:** All 5 tabs + idle → **D-01**
**Notes:** The requirement's 4-value list predated GizzMap/GizzGames; report the real tab.

## Coarse activity vocabulary — idle rule (PRES-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Tab hidden (visibilitychange) | Idle = document.visibilityState === 'hidden'. Event-driven, zero timers, reuses Wake Lock's signal. | ✓ |
| Hidden OR no-interaction timeout | Also idle after N min no interaction while foreground. Adds a timer + activity tracking. | |
| Never idle while connected | Presence = online + current tab; no idle state. | |

**User's choice:** Tab hidden via visibilitychange → **D-02**

## Coarse activity vocabulary — LiveGizz "At a show" (PRES-04, scope line)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 'At a show' when active | Distinct 'At a show 🎸' when a tracked show is live (boolean flag, no per-song). | ✓ |
| No — just 'LiveGizz' | Report the tab name only. | |

**User's choice:** Yes — 'At a show 🎸' → **D-03**
**Notes:** Boolean flag only (active tracked show exists), never per-song — stays clear of SOCL-V2-01.

---

## Wave & reaction — send UX (PRES-02, PRES-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Row = targeted, header = broadcast | Row action = targeted; a top control = broadcast. | |
| One palette, pick target after | Single 'React' button → emoji palette → then pick everyone or a friend. | ✓ |
| Long-press row / tap = detail | Long-press = quick targeted palette; broadcast elsewhere. | |

**User's choice:** One palette, pick target after → **D-04**

## Wave & reaction — wave vs palette (PRES-02, PRES-06)

| Option | Description | Selected |
|--------|-------------|----------|
| One palette, wave is first | Single fixed palette; 👋 wave is the first/default chip. PRES-02 + PRES-06 collapse into one surface. | ✓ |
| Wave primary, palette secondary | Wave is a prominent one-tap primary; fuller palette is a secondary reveal. | |

**User's choice:** One palette, wave is first → **D-05**

## Wave & reaction — received toast content (PRES-02, PRES-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Name + emoji + targeted mark | 'Matt 👋' broadcast vs 'Matt waved at you 👋' when targeted. Uses identity glyph. | ✓ |
| Name + emoji only | Always 'Matt 👋'; can't tell targeted vs broadcast. | |
| Emoji only, no name | Anonymous floating emoji. | |

**User's choice:** Name + emoji + targeted mark → **D-09**

## Wave & reaction — toast reach

| Option | Description | Selected |
|--------|-------------|----------|
| App-wide (any tab) | Host mounted once in App.tsx; wave reaches you in Show Mode, anywhere. Non-blocking. | ✓ |
| Friends screen only | Waves only surface on the Friends screen. | |

**User's choice:** App-wide → **D-11**

---

## Spam/coalescing — incoming burst (PRES-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Brief queue, one at a time | Short duration + small backlog (~3–5); flurry reads as distinct pops. | ✓ |
| Coalesce same emoji | Merge burst into one toast ('3 friends 🔥'). | |
| Latest-wins (like Bingo) | New wave replaces current; zero new logic but rapid waves stomp. | |

**User's choice:** Brief queue, one at a time → **D-10**
**Notes:** Deliberate departure from BingoCelebration's single latest-wins toast.

## Spam/coalescing — send rate-limit

| Option | Description | Selected |
|--------|-------------|----------|
| Short cooldown per target | ~1–2s client-side cooldown per target, disabling the button. | |
| No limit — trust the group | 5 friends who know each other; a spammer is a social problem. | ✓ |

**User's choice:** No limit — trust the group → **D-08**
**Notes:** The receive-side queue cap (D-10) already bounds on-screen flooding.

---

## Presence↔Friends fusion — membership rule (PRES-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Decorate existing rows only | Presence adds dot + activity to PROG-synced friends only; online-no-progress friends not shown. | ✓ |
| Surface online-only friends too | Online friend with no progress row appears with '—' stats. | |

**User's choice:** Decorate existing rows only → **D-13**
**Notes:** Matches how FriendRow already reserved its slots.

## Presence↔Friends fusion — dot + self (PRES-01, PRES-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Binary dot + You shows own status | Green = present now (dropped on disconnect); 'You' row shows own live dot + activity. No 'recently seen'. | ✓ |
| Binary dot, no self status | Friends get a dot; 'You' row unchanged. | |
| Add 'recently seen' | 'active 5m ago'; needs persisted timestamps (against ephemeral rule). | |

**User's choice:** Binary dot + You shows own status → **D-14, D-15**

---

## Offline/dead-signal venue — friend dots when you're offline

| Option | Description | Selected |
|--------|-------------|----------|
| Hide dots, keep cached stats | Drop all dots (never a stale green lie); Phase-19 dimmed 'offline · as of {time}' rows stay. | ✓ |
| Freeze last-known dots | Keep dots as they were at disconnect — risks a lying green dot. | |
| Whole screen 'offline' banner | Replace presence with a single offline state over the cached list. | |

**User's choice:** Hide dots, keep cached stats → **D-16**

## Offline/dead-signal venue — self offline state

| Option | Description | Selected |
|--------|-------------|----------|
| You row shows 'offline' | 'You' row reads offline via useOnlineStatus; honest you're not broadcasting. | ✓ |
| You row stays neutral | Keep showing live local activity with no offline marker. | |

**User's choice:** You row shows 'offline' → **D-17**

---

## Channel architecture — channel relationship (PRES-01…03)

| Option | Description | Selected |
|--------|-------------|----------|
| One new dedicated presence channel | New 'gizz-room' channel (presence keyed by userId) for presence + waves; separate from 'progress-feed'. | ✓ |
| Merge onto progress channel | Add presence + broadcast onto the existing progress channel. | |

**User's choice:** One new dedicated presence channel → **D-18**
**Notes:** Matches the validated spike blueprint exactly; keeps ephemeral vs durable cleanly separated.

## Channel architecture — engine placement

| Option | Description | Selected |
|--------|-------------|----------|
| New usePresence() mounted once in App.tsx | App-layer sync-fence hook + shared external store, mounted once, gated internally on identity + online. Mirrors Phase-19 D-16. | ✓ |
| You decide the module layout | Leave file split/store shape/hook names to discretion, singleton pattern in the sync fence. | |

**User's choice:** New usePresence() mounted once in App.tsx → **D-19**

---

## Self-presence/privacy — invisible mode (PRES-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Always-on while signed in | No opt-out; signed in = present + broadcasting coarse tab status. | ✓ |
| Add an invisible toggle | Settings toggle to appear offline while using the app. | |

**User's choice:** Always-on while signed in → **D-20**

## Wave persistence — missed waves (PRES-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Gone — no delivery, no history | Offline/closed = not received; no queue, badge, replay, or history table. | ✓ |
| Note it as a possible future | Ship gone-if-missed now, capture 'missed-wave nudge' as deferred. | |

**User's choice:** Gone — no delivery, no history → **D-21**

---

## Exact emoji palette (PRES-06)

| Option | Description | Selected |
|--------|-------------|----------|
| 👋 🔥 🦎 🎯(caught it!) | Four chips; 🎯 labeled 'caught it!'. | ✓ |
| 👋 🔥 🦎 ✅(caught it!) | Same four with ✅ for 'caught it!'. | |
| You decide the exact glyphs | Fixed ~4 palette led by 👋; exact glyphs to discretion. | |

**User's choice:** 👋 🔥 🦎 🎯 (caught it!) → **D-06**

## Global online indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Friends screen only | Presence lives only on the Friends screen + app-wide wave toasts. No tab badges/counts. | ✓ |
| Subtle count on GizzDex tab | Small 'N online' badge on the GizzDex tab. | |
| You decide | Leave a subtle global indicator to discretion, default to Friends-screen-only. | |

**User's choice:** Friends screen only → captured in `<domain>` Explicitly-NOT + D-11 scope

## Haptics on received wave

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — light buzz, motion-gated | navigator.vibrate on received wave; suppressed under reduced-motion, no-op where unsupported. | |
| No — visual only | Toasts only; iOS Safari lacks vibrate anyway. | ✓ |

**User's choice:** No — visual only → **D-12**

## Wave from FriendDetail

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — wave button in FriendDetail | FriendDetail gets a wave affordance pre-targeted at that friend; shares one send path. | ✓ |
| List palette only | Sending only from the list-level palette; FriendDetail stays read-only. | |

**User's choice:** Yes — wave button in FriendDetail → **D-07**

---

## Claude's Discretion

- Exact toast durations, queue cap value, and drain cadence (D-10).
- Palette chip styling/layout and the "React/Wave" entry-point affordance placement (D-04/D-07).
- Presence payload TS shape (`{ tab, atShow? }`), broadcast event shape (`{ from, to, emoji }`), config constant names/location (`config.presence` / `config.copy.presence`), shared-store shape, channel name, and the `.track()`/subscribe/reconnect/teardown wiring (D-18/D-19).
- How Settings/dev routes + the `#/dev/orb-fit` harness map into the activity vocabulary (default nearest tab or idle).
- Exact copy strings (`At a show 🎸`, `{name} waved at you 👋`, `{name} 👋`, `offline`, online-dot color/size) and the dot + activity visual treatment in the reserved FriendRow slots.
- Reduced-motion treatment of the wave toast (opacity-only vs gentle float), consistent with the celebration layer.

## Deferred Ideas

- Per-song / setlist-position presence → SOCL-V2-01 (the hard scope line).
- Missed-wave nudge / recent-waves peek / wave history → against PRES-03.
- "Recently seen" / last-active timestamps → needs persisted state; against ephemeral rule.
- Invisible / ghost mode → always-on for this opt-in ~5-friend tool.
- Send rate-limit / per-target cooldown → trust the group; revisit if spam becomes real.
- Global app-wide online indicator (tab badge / header count) → Friends-screen-only.
- Haptics on received waves → visual only.
- Surfacing online-only friends (no synced progress row) → decorate PROG rows only.
