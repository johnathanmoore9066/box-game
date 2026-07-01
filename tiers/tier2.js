/* Tier 2 — registered as a config factory; the host (game.js) mounts it.
   Ported from tier2.html; factory body runs fresh on every (re)mount. */
BoxGame.registerTier(2, function () {
    // New grammar this tier: function definitions and calls. The trick that keeps it
    // small — once a parameter is bound, a function body is just an assignment line the
    // engine already validates and applies. So this tier parses the shape and reuses
    // BoxGame.parseAssignment + BoxGame.assignCheck to actually run the box.
    const FN = {};                                  // name -> { param, kind, target | expr }
    const RESERVED = ['box','function','return','if','else','for','while','new','class','const','let','var','this','true','false','null','undefined'];
    const isIdent = (s) => /^[A-Za-z_$][\w$]*$/.test(s);
    const esc = (s) => String(s).replace(/[$]/g, '\\$&');
    const firstFn = () => Object.keys(FN)[0];

    // function name(param) { body }  — all on one line
    const parseDef = (line) => {
      const m = line.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)?\s*\)\s*\{\s*([\s\S]*?)\s*\}$/);
      return m ? { name: m[1], param: m[2] || null, body: m[3].trim().replace(/;+\s*$/, '') } : null;
    };
    const assignRe = (nm) => new RegExp('^(' + esc(nm) + '(?:\\.[A-Za-z_$][\\w$]*)?)\\s*=\\s*(.+)$');

    // run an assignment string through the engine (reused validation + apply)
    const runAssign = (line, ctx) => {
      const parsed = BoxGame.parseAssignment(line);
      if (parsed.error) return { error: parsed.error };
      return (parsed.prop ? BoxGame.assignCheck() : BoxGame.assignCheck({ bare: 'color' }))(parsed, ctx);
    };

    // evaluate a returning function's expr (number | param | side OP side) with param=arg
    const evalReturn = (fn, arg) => {
      const e = fn.expr;
      if (e === fn.param) return arg;
      if (/^-?\d+(\.\d+)?$/.test(e)) return parseFloat(e);
      const m = e.match(/^(\S+)\s*([+\-*/])\s*(\S+)$/);
      if (!m) return NaN;
      const side = (t) => t === fn.param ? arg : parseFloat(t);
      const L = side(m[1]), R = side(m[3]);
      if (isNaN(L) || isNaN(R)) return NaN;
      return m[2] === '+' ? L + R : m[2] === '-' ? L - R : m[2] === '*' ? L * R : (R ? L / R : NaN);
    };
    const validReturnExpr = (e, param) => {
      if (e === param || /^-?\d+(\.\d+)?$/.test(e)) return true;
      const m = e.match(/^(\S+)\s*[+\-*/]\s*(\S+)$/);
      const ok = (t) => t === param || /^-?\d+(\.\d+)?$/.test(t);
      return !!m && ok(m[1]) && ok(m[2]);
    };

    // ---- step 1: define a painter — function NAME(p) { box = p } ----
    function definePainter(p, ctx, raw) {
      const nm = ctx.name, line = String(raw).trim();
      const def = parseDef(line);
      if (!def) return { error: 'A function looks like:  function paint(c) { ' + nm + ' = c }' };
      if (!def.param) return { error: 'It needs a parameter — an input between the ( ):  function paint(c) { ' + nm + ' = c }' };
      if (!isIdent(def.name) || RESERVED.includes(def.name)) return { error: '“' + def.name + '” can’t be the name — pick a plain word like  paint' };
      const am = def.body.match(assignRe(nm));
      if (!am) return { error: 'For now the body should paint the box with the input:  { ' + nm + ' = ' + def.param + ' }' };
      if (am[1] !== nm) return { error: 'Paint the whole box for this one — just  ' + nm + ' = ' + def.param + '  (no dot yet).' };
      if (am[2].trim() !== def.param) return { error: 'Use the input you named — set the box to  ' + def.param + ':  { ' + nm + ' = ' + def.param + ' }' };
      FN[def.name] = { param: def.param, kind: 'paint', target: nm };
      return { commit: line, message: 'recipe saved — but nothing ran yet. Now call it.' };  // no apply: defining ≠ running
    }

    // ---- step 2: call it — NAME("color") ----
    function callIt(p, ctx, raw) {
      const nm = ctx.name, line = String(raw).trim();
      const m = line.match(/^([A-Za-z_$][\w$]*)\s*\(\s*([\s\S]*?)\s*\)$/);
      if (!m) return { error: 'Run a function by calling it — its name, then a value in ( ):  ' + (firstFn() || 'paint') + '("red")' };
      const fn = FN[m[1]];
      if (!fn) return { error: 'No function named  ' + m[1] + '  yet' + (firstFn() ? ' — you defined  ' + firstFn() + ', try  ' + firstFn() + '("red")' : '. Define one first.') };
      if (fn.kind !== 'paint') return { error: m[1] + ' returns a value — use it like  ' + nm + '.size = ' + m[1] + '(200)' };
      if (m[2].trim() === '') return { error: m[1] + ' needs a color in the ( ):  ' + m[1] + '("red")' };
      const res = runAssign(fn.target + ' = ' + m[2].trim(), ctx);
      if (res.error) return { error: res.error };
      const arg = BoxGame.parseAssignment('_ = ' + m[2].trim());
      return { commit: line, apply: res.apply, tag: res.tag, parsed: { value: arg.value, type: arg.type }, message: 'called — the box ran your recipe.' };
    }

    // ---- step 3: define a returning function — function NAME(n) { return n + 40 } ----
    function defineReturner(p, ctx, raw) {
      const line = String(raw).trim();
      const def = parseDef(line);
      if (!def) return { error: 'A returning function looks like:  function grow(n) { return n + 40 }' };
      if (!def.param) return { error: 'Give it a number to work with:  function grow(n) { return n + 40 }' };
      if (!isIdent(def.name) || RESERVED.includes(def.name)) return { error: '“' + def.name + '” can’t be the name — pick a plain word like  grow' };
      if (FN[def.name]) return { error: 'You already have a function named  ' + def.name + ' — pick a new name.' };
      const rm = def.body.match(/^return\s+([\s\S]+)$/);
      if (!rm) return { error: 'This one should return a value:  { return ' + def.param + ' + 40 }' };
      if (!validReturnExpr(rm[1].trim(), def.param)) return { error: 'Keep it to the input and a number:  return ' + def.param + ' + 40  (or  ' + def.param + ' * 2)' };
      FN[def.name] = { param: def.param, kind: 'return', expr: rm[1].trim() };
      return { commit: line, message: 'recipe saved — it returns a number. Now use what it gives back.' };
    }

    // ---- step 4: use a returned value — box.size = NAME(200) ----
    function useReturn(p, ctx, raw) {
      const nm = ctx.name, line = String(raw).trim();
      const m = line.match(new RegExp('^(' + esc(nm) + '(?:\\.[A-Za-z_$][\\w$]*)?)\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*\\(\\s*([\\s\\S]*?)\\s*\\)$'));
      if (!m) return { error: 'Use a function’s answer in an assignment:  ' + nm + '.size = grow(200)' };
      const target = m[1], fn = FN[m[2]], argCode = m[3].trim();
      if (!fn) return { error: 'No function named  ' + m[2] + '  yet.' };
      if (fn.kind !== 'return') return { error: m[2] + ' doesn’t return a value — call it on its own:  ' + m[2] + '("red")' };
      const arg = BoxGame.parseAssignment('_ = ' + argCode);
      if (arg.error || arg.type !== 'number') return { error: m[2] + ' takes a number:  ' + m[2] + '(200)' };
      const out = evalReturn(fn, arg.value);
      if (typeof out !== 'number' || isNaN(out)) return { error: 'That didn’t resolve to a number — try  ' + m[2] + '(200)' };
      const res = runAssign(target + ' = ' + out, ctx);
      if (res.error) return { error: res.error };
      return { commit: line, apply: res.apply, parsed: { value: out, type: 'number' }, message: 'used the returned value — the box updated.' };
    }

    return {
      mount: '#app', file: 'box.js', tier: 2,
      box: { color: 'grey', size: 150 },
      ledger: ['// tier 2 — functions', 'box = "grey"'],
      placeholder: 'function paint(c) { box = c }',
      hints: [ { label: 'function paint(c) { box = c }', insert: 'function paint(c) { box = c }' } ],
      teaser: { done: 'Tier 2 complete — functions &#10003;', next: 'next up &rarr; <b>Tier 3: Events</b>' },
      steps: [
        { check: definePainter, lesson: () =>
          '<h4>Teach the box a trick.</h4>You keep writing the same kind of line — <code>box = "blue"</code>, <code>box = "red"</code>. A <b>function</b> bottles an action under a name so you can reuse it. Here’s one that paints the box whatever color you hand it:' +
          '<div style="margin:7px 0 2px"><span class="ex">function paint(c) { box = c }</span></div>' +
          '<code>paint</code> is the <b>name</b>, <code>c</code> is the <b>parameter</b> (the input), and <code>{ box = c }</code> is the <b>body</b> — what it does. Write it.' },
        { check: callIt,
          until: (ctx) => ctx.distinct('value') >= 3,
          reveals: [
            { when: 2,
              hints: [ { label: 'paint("gold")', insert: 'paint("gold")' }, { label: 'paint("rebeccapurple")', insert: 'paint("rebeccapurple")' } ],
              lesson: () =>
                '<h4>&#128161; One recipe, every color.</h4>You wrote <code>paint</code> <i>once</i> — now it handles any color you pass. Change the <b>input</b>, never the recipe. That’s what a <b>parameter</b> is for. Paint a couple more.' }
          ],
          lesson: () =>
          '<h4>Now run it.</h4>Notice the box didn’t change — <i>defining</i> a recipe isn’t <i>cooking</i>. To run a function you <b>call</b> it: its name, with a value in the parentheses.' +
          '<div style="margin:7px 0 2px"><span class="ex">paint("tomato")</span></div>' +
          'Call your function with a color (use the name you gave it) — <b>three different colors</b> completes the step.' },
        { check: defineReturner, lesson: () =>
          '<h4>A function can hand something back.</h4>Some functions don’t act — they <b>compute</b> and <b>return</b> a value for you to use. This one takes a number and returns a bigger one:' +
          '<div style="margin:7px 0 2px"><span class="ex">function grow(n) { return n + 40 }</span></div>' +
          '<code>return</code> is the function’s answer. Define <code>grow</code> (any name, any number).' },
        { check: useReturn, lesson: () =>
          '<h4>Use what it returns.</h4><code>grow(200)</code> runs the math and <i>becomes</i> <code>240</code> — a value you can drop anywhere a value goes:' +
          '<div style="margin:7px 0 2px"><span class="ex">box.size = grow(200)</span></div>' +
          'Set a property using your function’s answer.' }
      ],
      outro: (ctx) =>
        '<h4>That’s a function.</h4>A named, reusable action — one <i>did</i> something to the box, one <i>returned</i> a value — each driven by an <b>input</b> you choose at the moment you <b>call</b> it. You taught the box tricks, and every line still stands (you wrote <b>' + ctx.ledger.count() + '</b>). Keep playing, or climb to <b>Tier 3: Events</b>.'
    };
});
