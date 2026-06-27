/* Tier 9 — registered as a config factory; the host (game.js) mounts it.
   Ported from tier9.html; factory body runs fresh on every (re)mount. */
BoxGame.registerTier(9, function () {
    // New grammar this tier: import / export. The whole game has run as one classic script,
    // but engine.js already notes it *models* a module — so here the ledger you've written
    // becomes a module: it imports names from a sibling "palette" file and exports its own.
    // Reuse: an imported value is just a value, so once resolved it flows through the same
    // BoxGame.assignCheck that has validated every assignment since Tier 0.
    const SCOPE = {};        // imported name -> { kind, value, fn }
    const MYEXPORTS = {};    // names this file exports

    // the file next door. real exports, shown to the player in the lesson.
    const MODULES = {
      palette: {
        gold:   { kind: 'value', value: '#ffd700' },
        tomato: { kind: 'value', value: 'tomato' },
        teal:   { kind: 'value', value: '#1bb3a3' },
        night:  { kind: 'value', value: '#0b1020' },
        grow:   { kind: 'fn',    value: 'function grow(n)', fn: (n) => Number(n) + 80 }
      }
    };

    const valForCode = (v) => typeof v === 'string' ? '"' + v + '"' : String(v);

    // import { a, b } from "mod"  — validate against the real exports, add to SCOPE
    function tryImport(line, ctx) {
      const m = line.match(/^import\s*\{\s*([^}]*?)\s*\}\s*from\s*(["'])([A-Za-z_$][\w$]*)\2\s*;?$/);
      if (!m) { return /^import\b/.test(line) ? { error: 'An import looks like:  import { gold, tomato } from "palette"' } : null; }
      const names = m[1].split(',').map(s => s.trim()).filter(Boolean), mod = m[3];
      if (!MODULES[mod]) return { error: 'There’s no module  "' + mod + '". The one next door is  "palette".' };
      if (names.length === 0) return { error: 'Name what you want, inside the braces:  import { gold } from "palette"' };
      const exp = MODULES[mod];
      for (const n of names) if (!exp[n]) return { error: '"' + mod + '" doesn’t export  ' + n + '. It has: ' + Object.keys(exp).join(', ') + '.' };
      for (const n of names) SCOPE[n] = exp[n];
      return { commit: line, parsed: {}, message: 'imported ' + names.join(', ') + ' — those names now work here, as if you’d written them.' };
    }

    // resolve the right-hand side of a use:  an imported value, an imported fn call, or a literal
    function resolveRhs(rhs, ctx) {
      rhs = rhs.trim();
      const fm = rhs.match(/^([A-Za-z_$][\w$]*)\s*\(\s*([\s\S]*?)\s*\)$/);
      if (fm) {
        const imp = SCOPE[fm[1]];
        if (!imp) return { error: 'No import named  ' + fm[1] + '. Bring it in first:  import { ' + fm[1] + ' } from "palette"' };
        if (imp.kind !== 'fn') return { error: fm[1] + ' is a value, not a function — use it directly:  ' + ctx.name + ' = ' + fm[1] };
        const argTok = fm[2].trim(), lit = BoxGame.parseAssignment('_ = ' + argTok);
        let argVal;
        if (!lit.error && lit.type !== 'identifier') argVal = lit.value;
        else if (SCOPE[argTok] && SCOPE[argTok].kind === 'value') argVal = SCOPE[argTok].value;
        else return { error: 'Give  ' + fm[1] + '  a value:  ' + fm[1] + '(120)' };
        return { value: imp.fn(argVal), used: fm[1] };
      }
      if (/^[A-Za-z_$][\w$]*$/.test(rhs)) {
        const imp = SCOPE[rhs];
        if (!imp) return { error: 'Nothing named  ' + rhs + '  here yet. Import it — you have: ' + (Object.keys(SCOPE).join(', ') || '(nothing — try  import { gold } from "palette")') };
        if (imp.kind !== 'value') return { error: rhs + ' is a function — call it:  ' + rhs + '(120)' };
        return { value: imp.value, used: rhs };
      }
      return { literal: true };
    }

    // ---- step 1: import names from another file ----
    function importStep(p, ctx, raw) {
      const r = tryImport(String(raw).trim(), ctx);
      return r || { error: 'Pull names in from another file:  import { gold, tomato } from "palette"' };
    }

    // ---- step 2: use what you imported (also accepts more imports) ----
    function useStep(p, ctx, raw) {
      const nm = ctx.name, line = String(raw).trim();
      const imp = tryImport(line, ctx);
      if (imp) return imp;                              // imported more — fine, but doesn't advance
      const parsed = BoxGame.parseAssignment(line);
      if (parsed.error) return { error: parsed.error };
      if (parsed.target !== nm) return { error: 'Set the box using an import:  ' + nm + ' = gold' };
      const r = resolveRhs(parsed.rawValue, ctx);
      if (r.error) return r;
      if (r.literal) return { error: 'Use one of your imports — ' + (Object.keys(SCOPE).join(', ') || 'import some first') + ' — like  ' + nm + ' = gold' };
      const concrete = parsed.prop ? (nm + '.' + parsed.prop + ' = ' + valForCode(r.value)) : (nm + ' = ' + valForCode(r.value));
      const cp = BoxGame.parseAssignment(concrete);
      const res = (cp.prop ? BoxGame.assignCheck() : BoxGame.assignCheck({ bare: 'color' }))(cp, ctx);
      if (res.error) return { error: res.error };
      return { commit: line, apply: res.apply, tag: res.tag, parsed: { value: r.used }, message: 'used  ' + r.used + '  from palette — imported, not copy-pasted.' };
    }

    // ---- step 3: export your own work ----
    function exportStep(p, ctx, raw) {
      const line = String(raw).trim();
      let m = line.match(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+?)\s*;?$/);
      if (m) {
        const lit = BoxGame.parseAssignment('_ = ' + m[2].trim());
        if (lit.error || lit.type === 'identifier') return { error: 'Export a real value:  export const sky = "#4dd0ff"' };
        MYEXPORTS[m[1]] = { kind: 'value' };
        return { commit: line, parsed: { value: m[1] }, message: 'exported  ' + m[1] + ' — another file could now  import { ' + m[1] + ' } from "box".' };
      }
      m = line.match(/^export\s+function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)?\s*\)\s*\{\s*([\s\S]*?)\s*\}\s*;?$/);
      if (m) {
        MYEXPORTS[m[1]] = { kind: 'fn' };
        return { commit: line, parsed: { value: m[1] }, message: 'exported the function  ' + m[1] + ' — importable from "box" now.' };
      }
      return { error: /^export\b/.test(line)
        ? 'Export a value or a function:  export const sky = "#4dd0ff"  (or  export function paint(c) { box = c })'
        : 'Mark something to share with other files:  export const sky = "#4dd0ff"' };
    }

    return {
      mount: '#app', file: 'box.js', tier: 9,
      box: { color: 'grey', size: 150 },
      ledger: ['// tier 9 — modules', 'box = "grey"'],
      placeholder: 'import { gold, tomato } from "palette"',
      hints: [ { label: 'import { gold, tomato } from "palette"', insert: 'import { gold, tomato } from "palette"' } ],
      teaser: { done: 'Tier 9 complete — modules &#10003;', next: 'the whole spine, climbed &rarr; <b>Tier 10: The Opening</b>' },
      steps: [
        { check: importStep, lesson: () =>
          '<h4>Code lives in many files.</h4>Real programs are split across <b>files</b>, and one file uses another’s code by <b>importing</b> it. Next door is <code>palette.js</code>, which <b>exports</b> a few things:' +
          '<div style="margin:6px 0;padding:8px 11px;background:rgba(255,255,255,.03);border-radius:7px;line-height:1.8">' +
            '<span class="ex">// palette.js</span><br>' +
            '<span class="ex">export const gold = "#ffd700"</span><br>' +
            '<span class="ex">export const tomato = "tomato"</span><br>' +
            '<span class="ex">export const teal = "#1bb3a3"</span><br>' +
            '<span class="ex">export function grow(n) { return n + 80 }</span></div>' +
          'Pull a couple of those names into <i>your</i> file:' +
          '<div style="margin:7px 0 2px"><span class="ex">import { gold, tomato } from "palette"</span></div>' },
        { check: useStep,
          until: (ctx) => ctx.distinct('value') >= 2,
          reveals: [
            { when: () => true,
              hints: [ { label: 'box = tomato', insert: 'box = tomato' },
                       { label: 'import { grow } from "palette"', insert: 'import { grow } from "palette"' },
                       { label: 'box.size = grow(120)', insert: 'box.size = grow(120)' } ],
              lesson: () =>
                '<h4>&#128161; You imported a name, not a copy.</h4>It works exactly as if you’d written it here — and you can import a <b>function</b> too. Bring in <code>grow</code> and use what it returns:' +
                '<div style="margin:7px 0 2px"><span class="ex">import { grow } from "palette"</span> &nbsp; then &nbsp; <span class="ex">box.size = grow(120)</span></div>' +
                'Use another import.' }
          ],
          lesson: () =>
          '<h4>Now use it.</h4>An imported name behaves just like one you defined — drop it straight into a line:' +
          '<div style="margin:7px 0 2px"><span class="ex">box = gold</span></div>' +
          'No quotes, no copy-pasted hex — <code>gold</code> <i>is</i> the value, borrowed from palette. Paint the box with an import (try a couple).' },
        { check: exportStep,
          until: (ctx) => ctx.distinct('value') >= 2,
          reveals: [
            { when: 1,
              hints: [ { label: 'export function paint(c) { box = c }', insert: 'export function paint(c) { box = c }' },
                       { label: 'export const ocean = "#1bb3a3"', insert: 'export const ocean = "#1bb3a3"' } ],
              lesson: () =>
                '<h4>&#128161; This whole file is a module.</h4>Everything you’ve written lives in one — <code>export</code> marks what other files may use; the rest stays private to you. Export a <b>function</b> too, so another file could run your box recipe.' }
          ],
          lesson: () =>
          '<h4>Share your own work.</h4>The other side of the deal: mark something in <i>your</i> file with <b>export</b>, and another file can import it — the way you just imported from palette:' +
          '<div style="margin:7px 0 2px"><span class="ex">export const sky = "#4dd0ff"</span></div>' +
          'Export a couple of things (a value, then a function).' }
      ],
      outro: (ctx) =>
        '<h4>That’s modules — and the whole climb.</h4>You <b>imported</b> names from another file and used them as your own, then <b>exported</b> yours for the next file to use. That’s how a program grows past one file without becoming a tangle — and it’s the seam the very <code>engine.js</code> under this game is built to cross. From <code>box = "blue"</code> to a box that has values, properties, functions, events, loops, conditionals, time, objects, classes, and now modules — every line you wrote (<b>' + ctx.ledger.count() + '</b>) still stands. Go watch it all compose in <b>Tier 10: The Opening</b>.'
    };
});
