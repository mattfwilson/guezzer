# Research Questions

Open questions surfaced during exploration that need deeper investigation before planning.

---

## Gizz Bingo — card calibration (planted 2026-07-19, from /gsd-explore)

Context: `.planning/notes/gizz-bingo-design-vetting.md`. Card is DECIDED as 4×4 (15 fillable +
free center). These two calibration questions remain open before a plan.

1. **Final event/song square mix + fill-rate calibration.**
   With consume-once marking over a median 15-song show, what mix of the 15 fillable squares
   (event types + 2–3 base-rate song squares) yields the target feel: a line *likely*, a blackout
   *rare*? Run a Monte-Carlo over the recent-era corpus (deal plausible cards, replay real shows,
   measure P(line), P(blackout), avg squares lit) to set the calibration constants. Confirm no
   configuration produces dark-all-night cards or trivial instant lines.

2. **Canonical curated lists.**
   - **Jam-vehicle songs** for the "a marathon jam" square (verified ~95% fire with a ~20-song
     list — finalize the exact roster; no duration data exists so this is a hand-curated tag).
   - **Which albums** become album-membership squares (measured fire-rates: Infest the Rats' Nest
     80%, Omnium Gatherum 80%, PetroDragonic 60%, Ice/Death/Planets 59%, Flying Microtonal Banana
     53%, I'm in Your Mind Fuzz 53%). Decide the album roster + how many album squares per card so
     they supply variety without dominating.

   Both lists live in core config (no scattered magic numbers). Rerun the corpus scripts before
   locking values.
