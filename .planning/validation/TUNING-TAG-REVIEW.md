# Tuning-Tag Review (VALID-01 / DATA-04)

**Owner musical spot-check** of the 52 songs flagged `needsReview` in
`data/tuning-tags.json`. Tuning family is **binary**: `standard` or `microtonal`.
Every flagged song is an `album-default` best-guess (no album match, a cover, or an
ambiguous multi-album track). Getting these right sharpens the prediction `tuning`
signal AND fixes the node **colors** in GizzVerse (tuning family drives `tuningColor`).

**Est. time: ~5 min.** Most of the 52 are covers that are correctly `standard` — the
real work is the ~15 rows on microtonal-tuning albums below.

---

## 1. High-priority: standard-guesses on a microtonal album (confirm → likely flip)

King Gizzard's microtonal records are *Flying Microtonal Banana* (fully microtonal),
and *K.G.* / *L.W.* (**mixed** — some tracks microtonal, some standard). So:

**Flying Microtonal Banana — the whole album is microtonal, so these 3 are almost certainly wrong as `standard`:**

| songId | Song | Current | Likely correct |
|---|---|---|---|
| 146 | Nuclear Fusion | standard | **microtonal** |
| 168 | Rattlesnake | standard | **microtonal** |
| 187 | Sleep Drifter | standard | **microtonal** |

**K.G. / L.W. — mixed albums, so your ear decides (album is only a hint):**

| songId | Song | Album | Current | Your call |
|---|---|---|---|---|
| 26 | Automation | K.G. | standard |  |
| 100 | Honey | K.G. | standard |  |
| 135 | Minimum Brain Size | K.G. | standard |  |
| 197 | Straws In The Wind | K.G. | standard |  |
| 220 | The Hungry Wolf of Fate | K.G. | standard |  |
| 147 | O.N.E. | L.W. | standard |  |
| 162 | Pleura | L.W. | standard |  |

## 2. Confirm these really ARE microtonal (currently guessed microtonal)

| songId | Song | Album | Current | Keep? |
|---|---|---|---|---|
| 151 | Open Water | Flying Microtonal Banana | microtonal | (FMB → yes) |
| 116 | Intrasport | K.G. | microtonal |  |
| 148 | Oddlife | K.G. | microtonal |  |
| 193 | Some of Us | K.G. | microtonal |  |
| 106 | If Not Now, Then When? | L.W. | microtonal |  |

## 3. The rest (37) — covers, almost certainly correct as `standard`

Flagged only because they're covers (a cover trips `needsReview`), and King Gizzard
plays them in standard tuning. **Skim for anything surprising, otherwise leave as-is:**

(You Gotta) Fight for Your Right, All My Loving, Boogie, Dirty Deeds Done Dirt Cheap,
Dueling Drums, Every 1's a Winner, Fury, Ghost, Gypsy, Happy Birthday To You, High
School, I Gotta Rock 'n' Roll, I Wanna Be Your Dog, I Was Made for Lovin' You,
Jailbreak, Jam, JOJAM, La Grange, Let There Be Rock, Love For Me, LUSEQ, Moby Dick,
Oh God, On the Road Again, Open My Eyes, Other Side, Police Truck, Proud Mary, Pushin'
Too Hard, Rock N' Roll, Silver Machine, Stoned, T.V. Eye, Talk Talk Talk, These Boots
Are Made for Walkin', Treaty, Whole Lotta Love.

---

## How to apply a correction (append-only — safe)

For each song you want to change, edit its entry in `data/tuning-tags.json`:

```jsonc
{ "songId": 146, "name": "Nuclear Fusion",
  "family": "microtonal",   // <- the fix
  "needsReview": false,      // <- you've reviewed it
  "source": "hand-tagged" }  // <- protects it from re-derivation
```

`mergeTuningTags` is **append-only**: it never rewrites existing entries, so a
regenerate (`node packages/core/src/cli/generate-tuning-tags.ts`) will keep your
hand-edits and only append genuinely-new songs. After edits, the tuning family flows
into scoring + GizzVerse colors on the next build — no other step needed.

**Tell me your calls (e.g. "146,168,187,26,220 → microtonal") and I'll apply them for you.**
