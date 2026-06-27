# THE BOX — a game that teaches code

Learn to program by rebuilding one square. Every line you write is real code that
stays on screen forever; new code has to work with everything you've already written.
That constraint — code you can read and build on but never take back — is the whole point.

## Run it

No build step. Open `index.html` in any modern browser (or open any page directly).
`engine.js` is a plain `<script src>` shared by every page, so a double-click works —
just keep the folder structure intact so the relative paths resolve.

## File tree

```
box-game/
├─ index.html        — launch menu (dev level-select; see “Onboarding” below)
├─ engine.js         — the shared foundation
├─ README.md
├─ DESIGN.md         — the reps-over-gates reveal mechanic, as built
├─ scenes/
│  ├─ opening.html   — the Tier-10 spectacle: the finished game playing itself
│  └─ shell.html     — name the box → references orphan → the world collapses → blank slate
└─ tiers/
   ├─ tier0.html     — Variables & Values (color ladder: named → hex → rgb → gradient)
   ├─ tier1.html     — Properties (numbers, booleans, dot-notation)
   ├─ tier2.html     — Functions (define vs. call, parameters, return)
   ├─ tier3.html     — Events (click/hover handlers on the live box)
   ├─ tier4.html     — Arrays & loops (a list of squares, for…of, forEach + index)
   ├─ tier5.html     — Conditionals & state (if/else on live state, a click toggle)
   ├─ tier6.html     — Time & the loop (setTimeout, setInterval, a rAF frame loop)
   ├─ tier7.html     — Objects & this (object literal, methods, this on live state)
   ├─ tier8.html     — Classes (class/constructor, new instances, extends + super)
   └─ tier9.html     — Modules (import named values/fns from a sibling, export your own)
```

## Onboarding (intended entry flow)

The real first run is a sequence, not the menu: **`opening.html`** (the finished
game playing itself — all values, gradients, parallax) → **`shell.html`** (you name
the box, which orphans every reference and collapses the world to one blank square)
→ **`tier0.html`**. `index.html` is currently a dev **level-select** so any tier can
be opened directly for testing; wiring the sequence back as the default is a known,
deliberate step (and carries one open seam — see Status).

## Architecture

- **engine.js** owns everything reusable, exported as `window.BoxGame`:
  `Box` (canonical state), `Stage` (renders it), `Ledger` (the accumulating read-only
  pane), `Console`, `CosmicField` (the spectacle + collapse), plus `highlight`,
  `isColor`, `parseAssignment`, `mountTier`, the box-property registry `props`, the
  validator factory `assignCheck`, and the naming helpers `varName` / `setVarName`.
- **tiers/** are thin config: `BoxGame.mountTier({ ledger, steps, hints, ... })`.
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
| 10 | The opening screen | everything, composed | ✅ reference built |

## Status

The full spine is built — Tiers 0–9, plus the Tier-10 reference opening and both scenes.
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

**Variable naming is wired (the old open seam, now closed).** The shell persists the
player's chosen name; every tier reads in that name automatically, and the engine owns
the box-property registry + an `assignCheck` factory so tiers stop re-deriving validation.
Net effect: a new tier that manipulates the box is mostly lessons + a few factory calls.
The intro *sequence* still isn't the default entry (`index.html` is the dev level-select),
but the continuity it needs — name in, name everywhere — is done. Tiers 2+ that introduce
genuinely new grammar (functions, events, loops) still bring their own parser per tier.
