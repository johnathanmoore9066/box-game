# DESIGN — Progressive reveal (reps over gates)

Status: **built** (engine + Tiers 0–1). Companion to `README.md`. Describes how the
early tiers teach by repetition, plus the backward-compatible extension to `mountTier`
that makes it work. See "Resolved during build" at the bottom for where the shipped
mechanic refined this proposal.

## The shift

The README frames the curriculum as a linear **spine**: ten discrete tiers, each
one new thing, completed once and left behind. This doc proposes that the early
game grow **by repetition** instead — you ride out easy mode (`box = "blue"`),
and after a few reps the game pays off your engagement with a *lightbulb*: a new,
richer way to say the same thing. Concepts are **discovered in place**, not gated.

Two models were considered:

- **Reps at the beginning (progressive reveal).** Repetition unlocks depth. The
  player who keeps painting the box is rewarded with "psst — colors are really
  numbers; try `#4dd0ff`." **Chosen.** It's the mechanic the game's premise
  ("every line stays; build on what's there") already implied.
- **Notify-and-backtrack at tier 2+.** Reaching a later tier retroactively adds
  required tasks to earlier ones. **Rejected.** Backtracking reframes progress as
  chores and breaks flow. Same content as discovery-in-place, opposite feeling.

## Principle: depth is optional, the path is not

Reveals **unlock** possibilities and entice toward them; they do not wall off
progress. The critical path stays completable for the impatient player. Curiosity
is rewarded; impatience is not punished. A reveal that *forces* N more reps before
letting you continue is just a grind-gate wearing a lightbulb — avoid it. Prefer
"a new door opened" over "do five more of these first."

## Why this fits the engine we already have

Every rung of the first ladder is still `key = value`, so the existing
`parseAssignment` grammar covers it untouched:

```
box = "blue"                  ← named
box = "#4dd0ff"               ← hex
box = "rgb(124, 77, 255)"     ← channels
box = "linear-gradient(...)"  ← gradient
```

`Stage` already does `el.style.background = s.color`, so a gradient even renders
for free; `isColor()` is what has to wave the richer forms through (a real fix for
gradients, not a one-liner — see "Resolved during build" #1). The same trick deepens
Tier 1's numbers (integers → decimals → ranges → negatives).

Consequence for sequencing: the reps model extracts far more teaching from the
parser we already have, and **defers genuinely new grammar** (function calls,
event listeners, loops) to Tier 2, where it's unavoidable anyway. Build the reveal
mechanic and deepen Tiers 0–1 now; tackle new-grammar parsing when Tier 2 lands.

## Engine extension (additive, backward-compatible)

Today `mountTier` fuses two questions: *is this input valid?* (`step.check`) and
*should we advance?* (any valid commit → `step++`). The reveal mechanic unfuses
them. New, all-optional step fields — omitting them reproduces today's behavior,
so Tier 0/1 as currently written keep running verbatim:

- `goal` (default `1`) — number of qualifying commits before the step completes.
- `until(ctx, parsed)` — predicate alternative to `goal` (e.g. "3 *distinct*
  colors"). Takes precedence over `goal` when present.
- `reveals: [{ when, lesson, hints }]` — lightbulbs fired once, mid-step, when
  `when` is met. `when` is either a **rep count** (number) or a **predicate**
  `(ctx, parsed) => bool` — the latter is what lets "reveal rgb *once they've
  actually used a hex*" be expressed. Firing injects new lesson HTML and appends
  new hint swatches. (Shipped as `when`, not `at`; see "Resolved during build".)

New on `ctx`, to let steps reason about reps:

- `ctx.history` — every committed line, in order.
- `ctx.stepCommits` — qualifying commits in the current step.
- `ctx.distinct(field)` — count of distinct values seen for a parsed field
  (e.g. `distinct('value')` for "how many different colors").

## Worked example — Tier 0, the color ladder

One conceptual step ("give the box a color") with reveals stacked on reps. As built:

1. reps 1–2: any named CSS color. Easy mode.
2. reveal `when: 2` — *"Colors are really numbers."* Adds hex hints; `#rrggbb` was
   always accepted, the reveal just *names* the capability (discovered in place).
3. reveal `when: used hex` — *"Three channels: red, green, blue."* Adds `rgb()` hints.
4. reveal `when: used rgb` — *"A color can even be many colors."* Adds gradient hints.

Advance with `until: ctx => ctx.distinct('value') >= 5` — **distinct colors, not
distinct forms**. The bar is set so a curious player naturally walks the whole ladder
(2 names, then hex, rgb, gradient = 5), while an impatient one clicks five name chips
and is out. Crucially, advancement never depends on having used the richer forms — the
reveals entice, they never gate (see "Resolved during build", point 4).

## Plan

1. ✅ Extend `engine.js` `mountTier` with `goal` / `until` / `reveals` + the `ctx`
   additions above. Backward compatible.
2. ✅ Rebuild Tier 0 as the color-ladder proof of concept.
3. ✅ Deepen Tier 1 (free-play reps + a negatives reveal) and update `README.md`
   (curriculum framing, the new step fields, `tier1.html` in the tree).

Tier 2+ (new grammar) is out of scope here and tracked separately. The reps primitives
(`goal` / `until` / `reveals` / `distinct`) are general, though — a later tier wanting
"write three functions before advancing" reuses them as-is.

## Resolved during build

Five things this proposal didn't account for, and how the shipped mechanic handles them:

1. **`isColor()` couldn't validate gradients.** It probes `style.color`, but a gradient
   is a CSS `<image>`, not a `<color>`, so the probe rejected it — the gradient rung
   would never have committed. `isColor` now falls back to probing `backgroundImage`
   for `gradient(...)` values. ("Renders for free" via `Stage`'s `background` was true;
   *validating* it was not.)
2. **`reveals.at` as a plain number couldn't express the ladder.** "Reveal rgb once
   they've used a hex" isn't a fixed rep count. Shipped as `when`, which accepts a
   number *or* a predicate `(ctx, parsed) => bool`.
3. **"Distinct forms" isn't a parsed field.** `parseAssignment` classifies every quoted
   color identically as a string, so the *form* (named/hex/rgb/gradient) is only known
   inside `check`. `check` now returns a `tag` the engine records per commit; predicates
   read it via `ctx.history` / `ctx.distinct('tag')`.
4. **The proposal contradicted its own principle.** Advancing on "distinct forms used"
   forces the player to try hex/rgb to proceed — the exact grind-gate "depth is optional"
   forbids. Resolved by advancing on distinct **colors** (any form); reveals entice but
   never gate. Verified: the impatient path completes on five names with no richer form
   touched; one color repeated never completes; the curious path walks the full ladder.
5. **The highlighter split decimals/negatives.** `\b(\d+)\b` rendered `0.5` and `-180`
   as multiple tokens — visible once Tier 1's numbers deepen. Widened to
   `-?\b\d+(?:\.\d+)?\b`, keeping the `\b` that protects the `pN` placeholders.
