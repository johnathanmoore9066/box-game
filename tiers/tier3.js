/* Tier 3 — registered as a config factory; the host (game.js) mounts it.
   Ported from tier3.html; factory body runs fresh on every (re)mount. */
BoxGame.registerTier(3, function () {
    // New grammar this tier: event registration with an arrow-function handler.
    // A handler is just a function that runs *later*, when the player interacts — so its
    // body is (again) an assignment the engine validates/applies. The only new piece is
    // attaching a real DOM listener to the live box element (ctx.stage.el).
    const EVENTS = { click: 'click', hover: 'mouseenter', leave: 'mouseleave', doubleclick: 'dblclick', dblclick: 'dblclick' };
    const VERB = { click: 'click', dblclick: 'double-click', mouseenter: 'hover over', mouseleave: 'move off' };
    const LISTEN = {};                       // domEvent -> the currently-wired fn (last wins)

    const runAssign = (line, ctx) => {
      const parsed = BoxGame.parseAssignment(line);
      if (parsed.error) return { error: parsed.error };
      return (parsed.prop ? BoxGame.assignCheck() : BoxGame.assignCheck({ bare: 'color' }))(parsed, ctx);
    };

    function attach(ctx, dom, fn) {
      const el = ctx.stage.el;
      if (LISTEN[dom]) el.removeEventListener(dom, LISTEN[dom]);   // last handler wins
      LISTEN[dom] = fn;
      el.addEventListener(dom, fn);
      if (dom === 'click' || dom === 'dblclick') el.style.cursor = 'pointer';
    }

    // a check for  on("<event>", () => <assignment>) ; opts.event pins the event type
    function onCheck(opts) {
      opts = opts || {};
      return function (p, ctx, raw) {
        const nm = ctx.name, line = String(raw).trim();
        const m = line.match(/^on\(\s*(["'])(\w+)\1\s*,\s*\(\s*\)\s*=>\s*([\s\S]+?)\s*\)\s*$/);
        if (!m) return { error: 'An event handler looks like:  on("click", () => ' + nm + ' = "red")' };
        const evt = m[2].toLowerCase(), body = m[3].trim(), dom = EVENTS[evt];
        if (!dom) return { error: 'Unknown event “' + evt + '”. Try  click ,  hover , or  dblclick .' };
        if (opts.event && evt !== opts.event) return { error: 'For this step, listen for  "' + opts.event + '"  — on("' + opts.event + '", () => …)' };
        const res = runAssign(body, ctx);
        if (res.error) return { error: res.error };
        const fire = () => { if (res.apply) res.apply(ctx.box); ctx.stage.pop(); };
        attach(ctx, dom, fire);
        return { commit: line, parsed: { value: body, event: evt }, message: 'wired — now ' + (VERB[dom] || evt) + ' your box.' };
      };
    }

    return {
      mount: '#app', file: 'box.js', tier: 3,
      box: { color: 'grey', size: 150 },
      ledger: ['// tier 3 — events', 'box = "grey"'],
      placeholder: 'on("click", () => box = "red")',
      hints: [ { label: 'on("click", () => box = "red")', insert: 'on("click", () => box = "red")' } ],
      teaser: { done: 'Tier 3 complete — events &#10003;', next: 'next up &rarr; <b>Tier 4: Arrays &amp; loops</b>' },
      steps: [
        { check: onCheck({ event: 'click' }), lesson: () =>
          '<h4>Make the box answer back.</h4>So far the box only changes when <i>you</i> write a line. An <b>event</b> lets it react to the player instead. You <b>listen</b> for something — a click — and hand over a <b>function</b> to run when it happens:' +
          '<div style="margin:7px 0 2px"><span class="ex">on("click", () => box = "red")</span></div>' +
          'The <code>() =&gt; box = "red"</code> is the <b>handler</b> — a function with no name, saved for later. Wire it up… then <b>click your box</b>.' },
        { check: onCheck({ event: 'hover' }), lesson: () =>
          '<h4>Other events, same idea.</h4>Clicks aren’t the only thing to listen for. <code>"hover"</code> fires when the player points at the box. Wire it to <i>grow</i>:' +
          '<div style="margin:7px 0 2px"><span class="ex">on("hover", () => box.size = 240)</span></div>' +
          'Then move your mouse onto the box and watch.' },
        { check: onCheck(),
          until: (ctx) => ctx.distinct('value') >= 2,
          reveals: [
            { when: 1,
              hints: [ { label: 'on("click", () => box.rotation = 20)', insert: 'on("click", () => box.rotation = 20)' },
                       { label: 'on("dblclick", () => box = "gold")', insert: 'on("dblclick", () => box = "gold")' } ],
              lesson: () =>
                '<h4>&#128161; The last handler wins.</h4>Wire <code>"click"</code> again and the newest handler replaces the old — just like the last <i>line</i> wins. And a handler can do <b>anything</b> you can write: set any property, even call a function. Wire one more, your way.' }
          ],
          lesson: () =>
          '<h4>You’re holding the controller now.</h4>The box is yours to choreograph. Wire up <b>another</b> reaction — a different event, or a new thing for click to do:' +
          '<div style="margin:7px 0 2px"><span class="ex">on("click", () => box.rotation = 20)</span> &nbsp; <span class="ex">on("dblclick", () => box = "gold")</span></div>' +
          'Make the box dance.' }
      ],
      outro: (ctx) =>
        '<h4>That’s an event.</h4>You <b>listened</b> for what the player does and answered with a <b>function</b> that runs on cue — the box now reacts on its own, no new line required. That’s the leap from a drawing to a <i>program people can use</i>. Every handler you wired still stands (you wrote <b>' + ctx.ledger.count() + '</b> lines). Keep playing, or climb to <b>Tier 4: Arrays &amp; loops</b>.'
    };
});
