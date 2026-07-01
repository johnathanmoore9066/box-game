/* Tier 4 — registered as a config factory; the host (game.js) mounts it.
   Ported from tier4.html; factory body runs fresh on every (re)mount. */
BoxGame.registerTier(4, function () {
    // New grammar this tier: an array literal, for…of, and forEach with an index.
    // One box becomes many. The reuse that keeps it small: a loop body  s.prop = value
    // is validated and applied by BoxGame.assignCheck with the loop variable standing in
    // as the "name", applied to each square through a one-method fake box.
    let ARR = null;                                   // { name } of the player's list
    const esc = (s) => String(s).replace(/[$]/g, '\\$&');
    const applyToItem = (res, item) => res.apply({ set: (k, v) => { item[k] = v; } });

    // a tiny arithmetic evaluator over the index and numbers, with proper precedence,
    // so "i * 15" and "40 + i * 20" both behave. Terms are the loop index or a number.
    const tokenize = (e) => e.match(/[A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?|[+\-*/()]/g);
    const evalIdxExpr = (e, idx, i) => {
      const t = tokenize(e) || []; let pos = 0;
      const peek = () => t[pos], eat = () => t[pos++];
      const prim = () => { const x = eat(); if (x === '(') { const v = sum(); eat(); return v; } return x === idx ? i : parseFloat(x); };
      const term = () => { let v = prim(); while (peek() === '*' || peek() === '/') { const o = eat(), r = prim(); v = o === '*' ? v * r : (r ? v / r : NaN); } return v; };
      const sum = () => { let v = term(); while (peek() === '+' || peek() === '-') { const o = eat(), r = term(); v = o === '+' ? v + r : v - r; } return v; };
      const out = sum();
      return pos === t.length ? out : NaN;        // leftover tokens ⇒ malformed
    };
    const validIdxExpr = (e, idx) => {
      const t = tokenize(e);
      if (!t || !t.some(tok => tok === idx || /^-?\d+(\.\d+)?$/.test(tok))) return false;
      for (const tok of t) { if (/^[+\-*/()]$/.test(tok) || tok === idx || /^-?\d+(\.\d+)?$/.test(tok)) continue; return false; }
      const v = evalIdxExpr(e, idx, 1);
      return typeof v === 'number' && !isNaN(v);
    };

    // ---- step 1: make an array of squares ----
    function makeArray(p, ctx, raw) {
      const line = String(raw).trim();
      const m = line.match(/^(?:const\s+|let\s+|var\s+)?([A-Za-z_$][\w$]*)\s*=\s*\[\s*([\s\S]*?)\s*\]$/);
      if (!m) return { error: 'An array is a list in square brackets:  row = ["tomato", "gold", "teal"]' };
      if (m[1] === ctx.name) return { error: 'That name is your box. Give the list its own name, like  row = [ … ]' };
      const parts = m[2].trim() === '' ? [] : m[2].split(',').map(s => s.trim());
      if (parts.length < 2) return { error: 'Put a few colors in the list, comma-separated:  row = ["tomato", "gold", "teal"]' };
      const colors = [];
      for (const part of parts) {
        const a = BoxGame.parseAssignment('_ = ' + part);
        if (a.error || a.type !== 'string' || !BoxGame.isColor(a.value)) return { error: '“' + part + '” isn’t a color — use quoted colors:  ["tomato", "gold", "teal"]' };
        colors.push(a.value);
      }
      ARR = { name: m[1] };
      ctx.squares.set(colors);
      return { commit: line, parsed: { value: colors.join(',') }, message: colors.length + ' squares drawn from your list.' };
    }

    // ---- step 2: for…of — change every square ----
    function loopAll(p, ctx, raw) {
      const line = String(raw).trim();
      if (!ARR) return { error: 'Make a list first:  row = ["tomato", "gold", "teal"]' };
      const m = line.match(/^for\s*\(\s*([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*)\s*\)\s*\{\s*([\s\S]*?)\s*\}$/);
      if (!m) return { error: 'A loop looks like:  for (s of ' + ARR.name + ') { s.size = 70 }' };
      const v = m[1], arrName = m[2], body = m[3].trim();
      if (arrName !== ARR.name) return { error: 'Loop over your list,  ' + ARR.name + ':  for (s of ' + ARR.name + ') { … }' };
      const parsed = BoxGame.parseAssignment(body);
      if (parsed.error || parsed.target !== v || !parsed.prop) return { error: 'In the body, restyle each square with the loop name and a dot:  ' + v + '.size = 70' };
      const res = BoxGame.assignCheck()(parsed, { name: v });
      if (res.error) return { error: res.error };
      ctx.squares.each(item => applyToItem(res, item));
      return { commit: line, parsed: { value: body }, message: 'looped — every square got it.' };
    }

    // ---- step 3: forEach with an index — vary each square by position ----
    function loopIndex(p, ctx, raw) {
      const line = String(raw).trim();
      if (!ARR) return { error: 'Make a list first.' };
      const m = line.match(/^([A-Za-z_$][\w$]*)\.forEach\(\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*([\s\S]+?)\s*\)$/);
      if (!m) return { error: 'forEach hands you each item and its position:  ' + ARR.name + '.forEach((s, i) => s.rotation = i * 15)' };
      const arrName = m[1], v = m[2], idx = m[3], body = m[4].trim();
      if (arrName !== ARR.name) return { error: 'Call forEach on your list:  ' + ARR.name + '.forEach((s, i) => …)' };
      const bm = body.match(new RegExp('^' + esc(v) + '\\.([A-Za-z_$][\\w$]*)\\s*=\\s*([\\s\\S]+)$'));
      if (!bm) return { error: 'Set a property using the position  ' + idx + ':  ' + v + '.rotation = ' + idx + ' * 15' };
      const propName = bm[1], expr = bm[2].trim();
      const spec = BoxGame.props[propName];
      if (!spec) return { error: 'No property  ' + v + '.' + propName + '. Try size, rotation, or opacity.' };
      if (spec.type !== 'number') return { error: 'For a per-position effect use a number property — rotation, size, opacity:  ' + v + '.rotation = ' + idx + ' * 15' };
      if (!validIdxExpr(expr, idx)) return { error: 'Use the position and a number:  ' + idx + ' * 15  (or  ' + idx + ' * 25)' };
      ctx.squares.each((item, i) => {
        let val = evalIdxExpr(expr, idx, i);
        if (spec.min != null) val = Math.max(spec.min, Math.min(spec.max, val));   // clamp to the property's range
        spec.apply({ set: (k, vv) => { item[k] = vv; } }, val);
      });
      return { commit: line, parsed: { value: body }, message: 'each square shaped by its position — that’s the field taking form.' };
    }

    return {
      mount: '#app', file: 'box.js', tier: 4,
      collection: [],
      ledger: ['// tier 4 — arrays & loops', '// one box was lonely. let’s make many.'],
      caption: 'row = [ … ]',
      placeholder: 'row = ["tomato", "gold", "teal"]',
      hints: [ { label: 'row = ["tomato", "gold", "teal"]', insert: 'row = ["tomato", "gold", "teal"]' } ],
      teaser: { done: 'Tier 4 complete — arrays &amp; loops &#10003;', next: 'next up &rarr; <b>Tier 5: Conditionals &amp; state</b>' },
      steps: [
        { check: makeArray,
          until: (ctx) => ctx.distinct('value') >= 2,
          reveals: [
            { when: 1,
              hints: [ { label: 'row = ["tomato", "gold", "teal", "violet", "skyblue"]', insert: 'row = ["tomato", "gold", "teal", "violet", "skyblue"]' } ],
              lesson: () =>
                '<h4>&#128161; A list is any length.</h4>Add more colors and more squares appear — the stage draws one per item. Remove some and they vanish. Try a longer (or shorter) list.' }
          ],
          lesson: () =>
          '<h4>From one square to many.</h4>You’ve perfected a single box. Now hold <i>several</i> at once. An <b>array</b> is an ordered list, written in square brackets:' +
          '<div style="margin:7px 0 2px"><span class="ex">row = ["tomato", "gold", "teal"]</span></div>' +
          'Each item is a square; the stage draws the whole list. Make one (give it its own name) — then commit a <b>second, different</b> list and watch the stage redraw.' },
        { check: loopAll,
          until: (ctx) => ctx.distinct('value') >= 2,
          reveals: [
            { when: 1,
              hints: [ { label: 'for (s of row) { s.rounded = true }', insert: 'for (s of row) { s.rounded = true }' }, { label: 'for (s of row) { s.opacity = 0.6 }', insert: 'for (s of row) { s.opacity = 0.6 }' } ],
              lesson: () =>
                '<h4>&#128161; One loop, every square.</h4>The loop ran your body once for <i>each</i> square. Change the <b>body</b> — round them, fade them — and it still hits them all. The list could be 3 or 300; the loop doesn’t care. Run another.' }
          ],
          lesson: () =>
          '<h4>Do one thing to all of them.</h4>Writing a line per square doesn’t scale. A <b>loop</b> runs the same body for every item. <code>for (s of row)</code> hands you each square in turn as <code>s</code>:' +
          '<div style="margin:7px 0 2px"><span class="ex">for (s of row) { s.size = 70 }</span></div>' +
          'Resize the whole row in one line — then loop again with a <b>different body</b>.' },
        { check: loopIndex,
          until: (ctx) => ctx.distinct('value') >= 2,
          reveals: [
            { when: 1,
              hints: [ { label: 'row.forEach((s, i) => s.size = 40 + i * 20)', insert: 'row.forEach((s, i) => s.size = 40 + i * 20)' }, { label: 'row.forEach((s, i) => s.opacity = i * 0.2)', insert: 'row.forEach((s, i) => s.opacity = i * 0.2)' } ],
              lesson: () =>
                '<h4>&#128161; The position is the secret.</h4><code>i</code> is what makes each square <i>different</i> — 0, 1, 2, 3… Multiply it, offset it, point it at another property. This is exactly how the opening’s field is built. Try another.' }
          ],
          lesson: () =>
          '<h4>Make each one its own.</h4>So far every square got the <i>same</i> value. <b>forEach</b> also hands you each square’s <b>position</b> — <code>i</code> (0, 1, 2…) — so you can vary them:' +
          '<div style="margin:7px 0 2px"><span class="ex">row.forEach((s, i) => s.rotation = i * 15)</span></div>' +
          'Fan them out — each turned a little more than the last. <b>Two different effects</b> and the tier resolves.' }
      ],
      outro: (ctx) =>
        '<h4>That’s arrays &amp; loops.</h4>One name held <b>many</b> squares; one <b>loop</b> styled them all; one <b>index</b> made each its own. You went from a single box to a whole field — the shape the opening screen is made of — in a handful of lines that all still stand. Keep playing, or climb to <b>Tier 5: Conditionals &amp; state</b>.'
    };
});
