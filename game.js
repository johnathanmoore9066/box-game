/* ============================================================
   game.js — the host controller for THE BOX (single-page).
   Owns: progress (localStorage), tier navigation + Continue,
   the first-launch onboarding (opening spectacle → name → collapse),
   and the Settings + Discoveries panels. Tiers register configs with
   the engine (BoxGame.registerTier); this file mounts them in place.
   Classic script, no build — loaded after engine.js + every tier.
   ============================================================ */
(function () {
  'use strict';

  const LAST_TIER = 10;  // highest implemented tier — Tier 10 is the free-build finale.

  // level-select / settings rows (one per tier, plus the not-yet-built finale)
  const TIER_META = [
    { t: 'Variables & Values',   d: 'name a square, give it a color; the last line wins.' },
    { t: 'Properties',           d: 'size, shape, opacity — numbers & booleans, via a dot.' },
    { t: 'Functions',            d: 'bottle an action with a parameter, then call it.' },
    { t: 'Events',               d: 'wire the box to react — click & hover handlers.' },
    { t: 'Arrays & loops',       d: 'one box becomes many — a list, a loop, an index.' },
    { t: 'Conditionals & state', d: 'the box decides — if/else and a click toggle.' },
    { t: 'Time & the loop',      d: 'make it move — timers and a 60fps frame loop.' },
    { t: 'Objects & this',       d: 'bundle data and behavior — an object, a method, this.' },
    { t: 'Classes',              d: 'a blueprint for boxes — new instances, inheritance.' },
    { t: 'Modules',              d: 'code across files — import names, export your own.' },
    { t: 'The Opening (free build)', d: 'everything unlocked — keep building.' }
  ];

  // discoveries catalog — concepts recorded as the player meets them (tier complete + reveals)
  const DISCO = [
    { key: 't0',    t: 'Variables & values', d: 'A variable is a name pointing at a value; “=” assigns it, and the last assignment wins.' },
    { key: 't0.r0', t: 'Hex colors',         d: 'A color is really a number in hex — two digits each for red, green, blue: #4dd0ff.' },
    { key: 't0.r1', t: 'RGB channels',       d: 'The same color spelled out as red/green/blue, 0–255 each: rgb(124, 77, 255).' },
    { key: 't0.r2', t: 'Gradients',          d: 'A value need not be one thing — a gradient fades between colors.' },
    { key: 't1',    t: 'Properties',         d: 'Named parts of an object, reached with a dot; each has a type — number, boolean, or text.' },
    { key: 't1.r0', t: 'Negative numbers',   d: 'Numbers run below zero — box.rotation = -45 tilts the other way.' },
    { key: 't2',    t: 'Functions',          d: 'A named, reusable action with an input (parameter); defining ≠ running; some return a value.' },
    { key: 't2.r0', t: 'Parameters',         d: 'One recipe, many results — change the input, never the recipe.' },
    { key: 't3',    t: 'Events',             d: 'Listen for what the player does and hand over a function that runs on cue.' },
    { key: 't3.r0', t: 'The last handler wins', d: 'Re-wiring an event replaces the old handler — like the last line winning.' },
    { key: 't4',    t: 'Arrays & loops',     d: 'A list held under one name; a loop runs one body per item; an index varies each.' },
    { key: 't4.r2', t: 'The index',          d: 'The position i (0, 1, 2…) is what makes each looped item different.' },
    { key: 't5',    t: 'Conditionals & state', d: 'Branch on the box’s own state with if/else; inside a handler that becomes a toggle.' },
    { key: 't5.r0', t: 'A false test does nothing', d: 'An if runs its block only when the test is true — otherwise nothing happens.' },
    { key: 't6',    t: 'Time & the loop',    d: 'setTimeout runs once later; setInterval repeats; the frame loop runs every frame.' },
    { key: 't6.r0', t: 'Animation',          d: 'Motion is just a small change, repeated fast — read the value, nudge it, repeat.' },
    { key: 't7',    t: 'Objects & this',     d: 'Bundle data and behavior under one name; this means “the object this method runs on.”' },
    { key: 't7.r0', t: 'this is live state', d: 'this.size re-reads the object’s current value on every call.' },
    { key: 't8',    t: 'Classes',            d: 'A blueprint; new stamps out instances; extends/super lets one class build on another.' },
    { key: 't8.r1', t: 'Inheritance',        d: 'A subclass inherits its parent’s constructor, then specializes — no rewriting.' },
    { key: 't9',    t: 'Modules',            d: 'import names from another file and use them as your own; export marks what others may use.' },
    { key: 't9.r1', t: 'A file is a module', d: 'Everything in a file stays private to it until you export it.' }
  ];

  // tracebacks — an error teaches too. The engine tags genuine syntax/type mistakes
  // with a reusable `code`; the first time you hit one, its explanation lands here.
  // Keyed e.<code>; codes are emitted by engine.js (parseAssignment + assignCheck).
  const ERRORS = [
    { code: 'no-equals',         t: 'A statement with no “=”',     d: 'Assigning means name = value. With no “=”, there’s nothing to set — the line just names a thing and stops.' },
    { code: 'compare-vs-assign', t: '“==” is not “=”',             d: 'One “=” assigns (put this value in that name). Two or three (==, ===) ask a question — “are these equal?” — and answer true/false instead of changing anything.' },
    { code: 'empty-value',       t: 'Nothing after the “=”',       d: 'Every assignment needs a right-hand side — the value to store. An “=” with nothing after it has nothing to give the name.' },
    { code: 'unclosed-quote',    t: 'An unclosed quote',           d: 'Text starts and ends with a matching quote. Open one and never close it and the language keeps reading, waiting for the end of the string that never comes.' },
    { code: 'needs-quotes',      t: 'Text needs quotes',           d: 'Quotes mark a value as literal text. Without them a word is read as a name to look up, not the characters themselves — so a color or label has to be wrapped: "blue".' },
    { code: 'unwanted-quotes',   t: 'A number in quotes is text',  d: 'Quotes turn 240 into the text "240" — and text can’t be measured or compared as a number. Numbers and booleans are written bare, no quotes.' },
    { code: 'needs-number',      t: 'This property wants a number', d: 'Some properties hold a count or measure — a size, an angle. They expect a number like 240, not a word or text.' },
    { code: 'needs-boolean',     t: 'Yes-or-no is true / false',   d: 'A boolean property has exactly two values: true or false, written bare (no quotes). It’s the language’s on/off switch.' },
    { code: 'out-of-range',      t: 'A value out of range',        d: 'A property can carry limits — a size, an opacity — and a value past them can’t apply. Stay inside the range the property allows.' },
    { code: 'unknown-prop',      t: 'A property that doesn’t exist', d: 'You can only set properties the box actually has. Reach for one it doesn’t define and there’s nothing there to change.' },
    { code: 'unknown-color',     t: 'A color the browser doesn’t know', d: 'Named colors are a fixed vocabulary the browser ships with. Outside it, spell the color as a number — a hex like #4dd0ff, or rgb(…).' },
    { code: 'needs-dot',         t: 'Reaching a part with a dot',  d: 'The box is one thing made of named parts. A dot reaches inside to one of them — box.size — so you change that part, not the whole box.' }
  ];

  const $ = (s) => document.querySelector(s);
  const KEY = 'boxgame.progress';
  let progress = { onboarded: false, highestUnlocked: 0, current: 0, completed: {}, discovered: {} };

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) progress = Object.assign(progress, JSON.parse(raw)); } catch (e) {}
    progress.completed = progress.completed || {};
    progress.discovered = progress.discovered || {};
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} }
  function unlock(n) { if (n > progress.highestUnlocked) progress.highestUnlocked = n; }
  function complete(n) { progress.completed[n] = true; unlock(Math.min(n + 1, LAST_TIER + 1)); save(); }

  /* ---------- chrome ---------- */
  function showChrome() { $('#chrome').classList.remove('hidden'); }
  function hideChrome() { $('#chrome').classList.add('hidden'); }

  /* ---------- mount a tier + wire Continue ---------- */
  function goTo(n) {
    if (!BoxGame.tiers[n]) { openSettings(); return; }          // not built yet → offer the menu
    if (n > progress.highestUnlocked) n = progress.highestUnlocked;
    closePanel();
    const scene = $('#scene'); scene.classList.remove('show'); scene.innerHTML = '';
    progress.current = n; save();
    const cfg = BoxGame.tiers[n]();
    cfg.onComplete = () => complete(n);
    if (BoxGame.tiers[n + 1]) cfg.onAdvance = () => goTo(n + 1);   // Continue → only if there's a next
    BoxGame.mountTier(cfg);
    if (cfg.freeplay) complete(n);   // the finale never "advances" — reaching it is the finish
    showChrome();
  }

  /* ---------- discoveries recording ---------- */
  function onDiscover(info) {
    const key = info.errorCode ? ('e.' + info.errorCode)
              : info.complete ? ('t' + info.tier)
              : (info.reveal != null ? ('t' + info.tier + '.r' + info.reveal) : null);
    if (!key || progress.discovered[key]) return;
    progress.discovered[key] = true; save();
    const b = $('#btnDiscoveries'); if (b) { b.classList.add('ping'); setTimeout(() => b.classList.remove('ping'), 900); }
  }

  /* ---------- onboarding: spectacle → name → collapse → tier 0 ---------- */
  function runOnboarding() {
    hideChrome(); closePanel();
    const scene = $('#scene'); scene.classList.add('show');
    scene.innerHTML =
      '<div id="space"></div>' +
      '<div class="intro-ui" id="introUi">' +
        '<div class="intro-title">THE BOX</div>' +
        '<div class="intro-tag">Everything on this screen is one square, drawn entirely by code. Finish the game and you’ll have written all of it yourself.</div>' +
        '<div class="intro-name"><span class="caret">&#10095;</span><input id="nameInput" autocomplete="off" spellcheck="false" placeholder="name your box&hellip;" /><span class="enter">&#9166; name it</span></div>' +
        '<div class="intro-msg" id="introMsg"></div>' +
      '</div>' +
      '<div class="intro-after" id="introAfter"><div class="big">Everything’s gone &mdash; except the square you named.</div><div class="sub">that’s where we start building &darr;</div></div>';

    const field = new BoxGame.CosmicField($('#space')).start();
    const input = $('#nameInput'), msg = $('#introMsg');
    const RES = ['this', 'box', 'new', 'class', 'const', 'let', 'var', 'return', 'function', 'if', 'for', 'while', 'true', 'false', 'null', 'undefined'];
    let done = false;
    const shake = (m) => { const u = scene.querySelector('.intro-name'); u.classList.add('shake'); msg.textContent = m; setTimeout(() => u.classList.remove('shake'), 330); };

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const v = input.value.trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(v)) { shake('letters, digits, _ or $ — no leading digit'); return; }
      if (RES.includes(v)) { shake('“' + v + '” is taken — pick a name that’s truly yours'); return; }
      if (done) return; done = true;
      input.disabled = true; msg.textContent = '';
      BoxGame.setVarName(v);                 // every tier reads in this name from here on
      field.collapse();                      // the scene falls apart
      setTimeout(() => { $('#introUi').style.opacity = '0'; }, 200);
      setTimeout(() => $('#introAfter').classList.add('show'), 750);
      setTimeout(() => {
        progress.onboarded = true; unlock(0); progress.current = 0; save();
        scene.classList.remove('show'); scene.innerHTML = '';
        goTo(0);
      }, 2700);
    });
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 2400);
  }

  /* ---------- settings (the relocated level-select) ---------- */
  function openSettings() {
    const rows = TIER_META.map((m, i) => {
      const locked = i > progress.highestUnlocked || !BoxGame.tiers[i];
      const done = !!progress.completed[i];
      const tag = locked ? 'locked' : (done ? 'done' : (i === progress.current ? 'current' : ''));
      return '<div class="lvl' + (locked ? ' locked' : '') + (done ? ' done' : '') + '" data-n="' + i + '">' +
        '<span class="ix">' + (done ? '&#10003;' : i) + '</span>' +
        '<span><div class="t">' + m.t + '</div><div class="d">' + m.d + '</div></span>' +
        '<span class="tag">' + tag + '</span></div>';
    }).join('');
    showPanel(
      '<span class="x" data-close>&#10005;</span><h3>Menu</h3>' +
      '<div class="sub">Jump to any tier you’ve reached. Your box and progress are saved on this device.</div>' +
      rows +
      '<div class="sheetbtns"><button class="sheetbtn" data-replay>&#8635; Replay intro</button>' +
      '<button class="sheetbtn danger" data-reset>&#10227; Reset progress</button></div>'
    );
    $('#panel').querySelectorAll('.lvl:not(.locked)').forEach((el) => { el.onclick = () => goTo(+el.dataset.n); });
    $('#panel').querySelector('[data-replay]').onclick = () => { closePanel(); runOnboarding(); };
    const resetBtn = $('#panel').querySelector('[data-reset]');
    let armed = false;
    resetBtn.onclick = () => {
      if (!armed) { armed = true; resetBtn.textContent = 'click again to confirm'; return; }   // non-blocking confirm
      try { localStorage.removeItem(KEY); localStorage.removeItem('boxgame.name'); } catch (e) {}
      BoxGame.clearCarry();                          // drop the carried box state + accumulated ledger
      progress = { onboarded: false, highestUnlocked: 0, current: 0, completed: {}, discovered: {} };
      closePanel(); runOnboarding();
    };
  }

  /* ---------- discoveries panel ---------- */
  function openDiscoveries() {
    const got = (k) => !!progress.discovered[k];
    const items = DISCO.map((e) =>
      '<div class="disc' + (got(e.key) ? '' : ' locked') + '">' +
      '<div class="t">' + e.t + '</div>' +
      '<div class="d">' + (got(e.key) ? e.d : 'Reach this in the game to unlock its explanation.') + '</div></div>'
    ).join('');
    const n = DISCO.filter((e) => got(e.key)).length;
    // tracebacks: only the errors actually hit, a collection that grows as you stumble.
    // Unlike concepts we don't pre-list the locked ones — a wall of ways-to-fail spoils
    // more than it teaches; an error earns its explanation by happening.
    const errsHit = ERRORS.filter((e) => got('e.' + e.code));
    const errItems = errsHit.length
      ? errsHit.map((e) => '<div class="disc trace"><div class="t">' + e.t + '</div><div class="d">' + e.d + '</div></div>').join('')
      : '<div class="disc locked"><div class="d">No tracebacks yet — when a line errors, its explanation lands here.</div></div>';
    showPanel(
      '<span class="x" data-close>&#10005;</span><h3>Discoveries</h3>' +
      '<div class="sub">' + n + ' of ' + DISCO.length + ' uncovered — the ideas you’ve met on the climb.</div>' +
      items +
      '<h3 class="trace-h">Tracebacks</h3>' +
      '<div class="sub">' + errsHit.length + ' decoded — every error explains itself, then joins the record.</div>' +
      errItems
    );
  }

  /* ---------- panel plumbing ---------- */
  function showPanel(html) {
    const p = $('#panel');
    p.innerHTML = '<div class="sheet">' + html + '</div>';
    p.classList.add('show');
    p.onclick = (e) => { if (e.target === p || (e.target.hasAttribute && e.target.hasAttribute('data-close'))) closePanel(); };
  }
  function closePanel() { const p = $('#panel'); p.classList.remove('show'); p.innerHTML = ''; }

  /* ---------- boot ---------- */
  function boot() {
    BoxGame.injectStyles();
    BoxGame.onDiscover(onDiscover);
    $('#btnSettings').onclick = openSettings;
    $('#btnDiscoveries').onclick = openDiscoveries;
    load();
    if (!progress.onboarded) runOnboarding();        // first launch: spectacle, never the menu
    else { showChrome(); goTo(progress.current || 0); }   // returning: resume where they were
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
