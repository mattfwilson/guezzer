---
created: 2026-07-19T04:48:04.422Z
title: "Feature: Know-Before-You-Go primer + predicted-setlist playlist"
area: feature
files:
  - packages/core/src/model/predict.ts
  - packages/app/src/show/PreShowLauncher.tsx
---

## Problem

**Feature idea #10 from 2026-07-19 research session. Pre-show onboarding for the +1 facing 27 albums and 264 live songs.**

"Beginner's guide to King Gizzard" articles are a cottage industry (Treble, NME, HeadStuff, Levitation) because the discography is genuinely intimidating — the standard structure is entry-points-by-genre-lane (thrash → Rats' Nest; jammy → Ice, Death…; accessible → Fishing for Fishies). Separately, setlist→playlist converters (Soundiiz, setlistfm.selbi.club) are a popular third-party tool category with no first-party equivalent — fans clearly want "listen to what they'll probably play". Guezzer's model can do one better than copying a past setlist: generate a *predicted* one.

## Solution

Concept — a "New to Gizz?" flow, entry from the pre-show launcher and the app menu:

1. **10-song crash course**: curated picks organized by genre lane with one-line "why this matters live" notes ("this one turns into a 15-minute jam"). Static curated content in core data; small authoring cost.
2. **Tonight's homework playlist**: the model's top-N most-likely songs for the upcoming show (given no current song = opener-context predictions + high base-rate songs, rotation-aware once Residency Mode lands), exported as Spotify/Apple Music **search deep-links** (`https://open.spotify.com/search/...` — no API, no auth, works from a PWA). One tap per song or a copyable list for the group chat.
3. **During-show casual card**: the current-song display gains a casual-friendly line — album, year, one-sentence context, and a teaser from the matrix ("this segues into Rattlesnake 40% of the time — watch for it"). Overlaps with Song Dossiers todo — the casual card is the dossier's lightweight face.
4. Frame all copy for someone who knows zero songs; this is the feature the owner hands to a +1 in the car to the venue.

Architecture fit: prediction reuse + static curated JSON + link generation (pure core, testable) + one view. Small-to-mid size.
