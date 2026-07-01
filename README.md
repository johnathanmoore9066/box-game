# THE BOX — a game that teaches code

Learn to program by rebuilding one square. Every line you write is real code that
stays on screen forever; new code has to work with everything you've already written.
That constraint — code you can read and build on but never take back — is the whole point.

## Run it

No build step. Open `index.html` — it's the whole game (a single-page host). On a
first visit it drops you into the opening spectacle, asks you to name your box, then
collapses into Tier 0; returning visits resume where you left off. Everything is
classic `<script src>`, so a double-click or any static host (it's deployed on Vercel)
works — just keep the folder structure intact so the relative paths resolve. The script
tags carry a `?v=N` query; bump it when you change `engine.js`/a tier/`game.js` so
returning players don't get a stale cached copy.

## File tree

```
box-game/
├─ index.html        — the single-page game host: chrome (Menu · Discoveries), #app mount, overlays
├─ game.js           — host controller: progress (localStorage), navigation + Continue, onboarding, panels
├─ engine.js         — the shared foundation (Box/Stage/Ledger/Console/CosmicField + mountTier + registry)
├─ README.md
├─ DESIGN.md         — the reps-over-gates reveal mechanic, as built
├─ scenes/           — original standalone set-pieces (logic now ported into game.js onboarding)
│  ├─ opening.html   — the spectacle: the finished game playing itself
│  └─ shell.html     — name the box → references orphan → the world collapses → blank slate
└─ tiers/            — each tier registers a config factory with BoxGame.registerTier(N, …)
   ├─ tier0.js       — Variables & Values (color ladder: named → hex → rgb → gradient)
   ├─ tier1.js       — Properties (numbers, booleans, dot-notation)
   ├─ tier2.js       — Functions (define vs. call, parameters, return)
   ├─ tier3.js       — Events (click/hover handlers on the live box)
   ├─ tier4.js       — Arrays & loops (a list of squares, for…of, forEach + index)
   ├─ tier5.js       — Conditionals & state (if/else on live state, a click toggle)
   ├─ tier6.js       — Time & the loop (setTimeout, setInterval, a rAF frame loop)
   ├─ tier7.js       — Objects & this (object literal, methods, this on live state)
   ├─ tier8.js       — Classes (class/constructor, new instances, extends + super)
   └─ tier9.js       — Modules (import named values/fns from a sibling, export your own)
```

## Onboarding & flow (the default entry, as built)

`index.html` IS the sequence now. **First launch** → the opening spectacle (the finished
game playing itself) with a *name your box* prompt → the field collapses → **Tier 0**.
The box's name is saved and threaded through every tier. Each tier ends with a
**Continue →** button; finishing a tier marks it complete and **unlocks** the next.
**Returning players** resume at their current tier — the old level-select is now a
**Menu** panel (jump to any tier you've reached; replay intro; reset progress), never the
landing. A **Discoveries** panel collects each concept as you meet it (tiers completed and
reveals fired). Progress lives in `localStorage` under `boxgame.progress` (+ `boxgame.name`).

## Architecture

- **index.html + game.js** are the single-page host. `game.js` owns progress
  (`localStorage`), tier navigation (mounting a registered tier, wiring its **Continue**
  button), the first-launch onboarding (opening spectacle → name → collapse, composed from
  `CosmicField`), and the **Menu** + **Discoveries** panels. It mounts tiers into `#app`.
- **engine.js** owns everything reusable, exported as `window.BoxGame`:
  `Box` (canonical state), `Stage` (renders it), `Ledger` (the accumulating read-only
  pane), `Console`, `CosmicField` (the spectacle + collapse), plus `highlight`,
  `isColor`, `parseAssignment`, `mountTier`, the box-property registry `props`, the
  validator factory `assignCheck`, the naming helpers `varName` / `setVarName`, the
  carried-state helpers **`boxState` / `saveBoxState` / `ledgerLines` / `saveLedgerLines` /
  `clearCarry`** (the box + ledger that follow the player across tiers), and the
  host hooks **`registerTier` / `tiers`** (the registry) and **`discover` / `onDiscover`**.
  `mountTier` additionally accepts optional `onComplete(ctx)` / `onAdvance(ctx)` (the
  latter renders the Continue button) — all backward compatible.
- **tiers/** are thin config, now registered as factories:
  `BoxGame.registerTier(N, () => ({ ledger, steps, hints, ... }))`. The factory runs fresh
  on every (re)mount, so a tier's local parser state resets cleanly when revisited.
  A tier is data, not plumbing — adding one is a config block, not new infrastructure.
  Each `step` validates with `check`, and **optionally** controls its own pacing:
  `goal` (commits before advancing, default `1`), `until(ctx, parsed)` (a predicate
  that overrides `goal`), and `reveals: [{ when, lesson, hints }]` (lightbulbs fired
  mid-step). Omitting all three = advance on any valid commit (the original behavior).
  `check` may also return a `tag` the engine records per commit. Steps reason over reps
  via `ctx.history`, `ctx.stepCommits`, and `ctx.distinct(field)`.
- **A step rarely hand-writes a validator.** `BoxGame.assignCheck(...)` generates one
  from the canonical property registry, with teachable errors: `assignCheck({ bare:
  'color' })` for `box = "blue"`, `assignCheck({ require: 'size' })` to pin a step to one
  property, `assignCheck()` for any `box.prop = value`. Color values are auto-tagged by
  form (named/hex/rgb/gradient). Tier 1's ~50 lines of registry + checks are now three
  factory calls; a future tier that pokes box state is a few lines, not infrastructure.
- **The variable is named once and everything follows.** The box's identifier (`box`,
  or whatever the player named it in the shell) is resolved by the engine and threaded
  through highlighting, captions, ledger lines, hints, generated errors, and lesson code
  spans (prose nouns like "the box" stay put). Tier authors just write `box`; the engine
  renders it in the player's name. So nothing in a tier hardcodes the identity.
- **scenes/** are bespoke set-pieces that compose engine parts (the shell wires a
  `Ledger` + `CosmicField` + the rename / orphan / collapse / reveal sequence).

## Curriculum (the spine)

Each tier is one new thing you can do to the square; the top tier is the opening screen.
The early tiers grow by **repetition, not gates**: you ride easy mode (`box = "blue"`)
and after a few reps a *reveal* unlocks a richer way to say the same thing — colors are
really numbers (hex → rgb → gradient), numbers run negative, and so on. Depth is
optional; the critical path stays completable for the impatient player. See `DESIGN.md`.

| # | Tier | Teaches | Status |
|---|------|---------|--------|
| 0 | Variables & values | names, values, assignment, reassignment | ✅ built |
| 1 | Properties | numbers, booleans, dot-notation | ✅ built |
| 2 | Functions | parameters, return, reuse | ✅ built |
| 3 | Events | listeners, interaction | ✅ built |
| 4 | Arrays & loops | many squares, iteration | ✅ built |
| 5 | Conditionals & state | branching, boolean logic | ✅ built |
| 6 | Time & the loop | timers, requestAnimationFrame, physics | ✅ built |
| 7 | Objects & `this` | objects, methods, `this` | ✅ built |
| 8 | Classes | constructors, inheritance | ✅ built |
| 9 | Modules | export / import | ✅ built |
| 10 | The opening (free build) | everything, unlocked — keep building | ✅ built (finale) |

## Status

The full spine is built — Tiers 0–9, plus the Tier-10 free-build finale.
The engine unfuses *valid?* from *advance?* — `goal` / `until` / `reveals` and the `ctx` reps
helpers — backward compatibly (omit them and a tier behaves exactly as before). **Tier 0**
is the color ladder (named → hex → rgb → gradient, advancing on distinct colors, reveals
that entice but never gate). **Tier 1** deepens properties (free-play reps + a negatives
reveal). **Tier 2 (Functions)** and **Tier 3 (Events)** introduce real new grammar —
function `define`/`call`/`return`, and `on("click", () => …)` handlers wired to the live
box. **Tier 4 (Arrays & loops)** adds a `Squares` renderer to the engine — one box becomes
a list, restyled by `for…of` and varied by a `forEach` index. **Tier 5 (Conditionals &
state)** branches on the box's live state (`if/else`, comparisons) and ends on a stateful
click toggle. **Tier 6 (Time & the loop)** makes the box move on its own — `setTimeout`,
`setInterval`, and a `requestAnimationFrame` frame loop whose body re-reads live state and
nudges it (motion = one assignment, repeated). **Tier 7 (Objects & `this`)** reveals the box
has *been* an object all along: a literal, a method stored on it, and `this` reading the
object's own live state. **Tier 8 (Classes)** is a blueprint for boxes — `class`/`constructor`,
`new` instances drawn into the `Squares` collection, and real `extends`/`super` inheritance.
**Tier 9 (Modules)** turns the ledger into a module that `import`s named values/functions
from a sibling `palette` and `export`s its own. The pattern they all set: a tier brings a tiny
parser for its one new idea, but **reuses `parseAssignment` + `assignCheck`** to actually run
the box — a bound function body, an event handler body, a loop body (`assignCheck` with the
loop variable as the "name"), an if-branch, a timer/frame body, a method body, a class
constructor (validated against the same `props` registry), or an imported value, is underneath
just an assignment the engine already validates and applies. A `check` may return its own
`parsed` so reps/`distinct` work for grammars with no `=`. Both scenes (opening + shell) still
run on the shared engine.

**Variable naming is wired.** Onboarding persists the player's chosen name; every tier
reads it automatically, and the engine owns the box-property registry + an `assignCheck`
factory so tiers stop re-deriving validation. A new tier that manipulates the box is
mostly lessons + a few factory calls.

**Continuous-game restructure — Phase 1 (done).** The game is now one single-page app
(`index.html` + `game.js`) instead of standalone tier pages. First launch runs the
opening spectacle → name the box → collapse → Tier 0; the old level-select is now the
**Menu** panel and never the landing. Progress + tier locking + a **Continue** button +
a **Discoveries** panel are wired, all saved to `localStorage`. Tiers were converted from
standalone `.html` pages into config factories registered via `BoxGame.registerTier`.

**Phase 2 — the box follows the player (done).** This is the game's whole premise made
literal: the square you shape and the code you write *persist across tiers*. The engine
saves the box's visual state (`boxgame.box`) and the **accumulating ledger** (`boxgame.ledger`)
on every commit, and `mountTier` seeds the next tier from them — the carried state wins over
the tier's defaults, so your color/size/shape/rotation/glow carry over exactly as you left
them, and each new tier opens with the *full* record of everything you've written so far,
then appends its own banner comment (no more re-seeding `box = "grey"`). State is written
on commit, not on every render, so Tier 6's 60fps loop doesn't hammer storage. A Menu
**Reset** clears the carried state alongside name + progress (`BoxGame.clearCarry()`).

**Phase 3 — every error teaches (error-explainer done).** A mistake is now a discovery,
not a dead end. `parseAssignment` + `assignCheck` tag each genuine syntax/type error with a
reusable `code` (`compare-vs-assign`, `needs-quotes`, `out-of-range`, …); `mountTier` keeps
showing the terse inline message but also fires `discover({ tier, errorCode })` once per code.
The host (`game.js`) carries an `ERRORS` catalog of plain-language explanations and renders a
**Tracebacks** section in the Discoveries panel — only the errors you've actually hit, a
collection that grows as you stumble (a wall of ways-to-fail would spoil more than it teaches).
Records persist in `boxgame.progress.discovered` under `e.<code>` keys, alongside the concept
discoveries. Pacing-only nudges ("this step wants `box.size`") stay uncoded, so they never
file a traceback.

**Roadblock fixes (Phase A of the polish pass, done).** Progress now survives a remount:
the host saves the step reached per tier (`progress.steps`) and passes `startStep` /
`completed` into `mountTier`, so a refresh resumes mid-tier and a completed tier lands
on its done state — teaser + **Continue** visible immediately, never a re-walk. On a
completed tier the input stays live and *any* step's grammar is accepted (first check
that takes the line wins), so free play works without the tier's local parser state.
Trailing semicolons are stripped engine-wide (plus inside Tier 2 function bodies and
Tier 7 method bodies); `let`/`const`/`var` on an existing name gets a teaching error
(`redeclare`, catalogued in Tracebacks); Tier 4 accepts `const row = […]` where a new
name is legitimately born. Revisited tiers no longer duplicate their ledger banner.
Every step gated by an `until` predicate now *says* its bar in the lesson ("five
different colors opens the next tier") — reveals entice, and the gates are visible.

**Phase 3 — the finale (Tier 10 done).** The spine ends on an open canvas. `tiers/tier10.js`
registers like any tier but is `freeplay: true` — a single step that accepts everything the
game taught (the Tier-0 bare form `box = "blue"` *and* any `box.prop = value`, routed by
whether the line has a dot) and never advances (`until: () => false`). The engine seeds it from
the carried box + the full accumulating ledger, so the player walks in with everything they
built and just keeps shaping it; `mountTier` shows a `tier 10 · free build` label in place of
step dots. Reaching it *is* the finish: the host marks a `freeplay` tier complete on entry
(it has no step to complete). The error-explainer works here too — a bad line still files its
traceback. *Remaining Phase 3:* the `scenes/*.html` files are orphaned prototypes (the live
onboarding lives in `game.js`); a cleanup is possible later, but the site is deployed, so
confirm before removing anything.
