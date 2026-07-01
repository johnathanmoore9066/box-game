/* Tier 1 — registered as a config factory; the host (game.js) mounts it.
   Ported from tier1.html; factory body runs fresh on every (re)mount. */
BoxGame.registerTier(1, function () {
    // No per-tier validation boilerplate anymore: the engine owns the box's property
    // registry (size, rounded, opacity, rotation, color, glow) and assignCheck() does
    // the dot / type / range checking with teachable errors. require pins a step to one
    // property; a bare assignCheck() accepts any of them.
    const prop = (name) => BoxGame.assignCheck({ require: name });

    return {
      mount: '#app', file: 'box.js', tier: 1,
      box: { color: 'grey', size: 150, radius: 18, opacity: 1, rotation: 0 },
      caption: 'box.color = "grey"',
      ledger: ['// tier 1 — properties', 'box.color = "grey"'],
      placeholder: 'box.size = 240',
      hints: [ { label: 'box.size = 240', insert: 'box.size = 240' },
               { label: 'box.rounded = true', insert: 'box.rounded = true' },
               { label: 'box.opacity = 0.5', insert: 'box.opacity = 0.5' },
               { label: 'box.rotation = 20', insert: 'box.rotation = 20' } ],
      teaser: { done: 'Tier 1 complete — properties &#10003;', next: 'next up &rarr; <b>Tier 2: Functions</b>' },
      steps: [
        { check: prop('size'), lesson: () =>
          '<h4>The box has parts.</h4>In Tier 0, <code>box</code> was just its color. Really, color is one of its <b>properties</b> — and the box has more: a size, corners, see-through-ness. ' +
          'You reach a property with a <b>dot</b>: <code>box.size</code>. And notice the type — a size is a <b>number</b>, so it takes <i>no quotes</i> (unlike a color). Make the box bigger.' },
        { check: prop('rounded'), lesson: () =>
          '<h4>Numbers, now booleans.</h4>Some properties aren’t numbers or text — they’re just <b>yes or no</b>. Those are <b>booleans</b>: <code>true</code> or <code>false</code>, no quotes. ' +
          'Round the box’s corners with <code>box.rounded = true</code> (try <code>false</code> too).' },
        // the box is yours now — but stay a while: touch a few different properties
        // before the tier resolves, and discover that numbers run negative too.
        { check: BoxGame.assignCheck(),
          // two distinct properties in this free-play step is enough to move on. (3 was a
          // trap: steps 1-2 already spent `size` and `rounded`, leaving only opacity +
          // rotation among the examples here — exactly 2, one short of advancing.)
          until: (ctx) => ctx.distinct('prop') >= 2,
          reveals: [
            { when: 1,
              hints: [ { label: 'box.rotation = -45', insert: 'box.rotation = -45' } ],
              lesson: () =>
                '<h4>&#128161; Numbers go below zero.</h4>They aren’t all positive. <code>box.rotation</code> takes <b>negatives</b> — <code>box.rotation = -45</code> tilts it the other way. Give the box a lean, then keep mixing.' }
          ],
          lesson: () =>
          '<h4>Decimals &amp; ranges — then it’s yours.</h4>Numbers can have decimals. <code>box.opacity</code> runs from <code>0</code> (invisible) to <code>1</code> (solid), so <code>0.5</code> is half see-through. Set it — ' +
          'then the box is yours: change <b>size, rounded, opacity, rotation, color</b> in any order — touch <b>two different properties</b> and the tier resolves.' }
      ],
      outro: (ctx) =>
        '<h4>One box, many properties.</h4>You’ve been setting <b>properties</b> — named parts of the box, each with its own type: text for <code>color</code>, numbers (whole, decimal, even negative) for <code>size</code> and <code>rotation</code>, true/false for <code>rounded</code> — ' +
        'reached, every time, through a dot. That’s the box becoming an <i>object</i>: one thing that bundles many values. (That word, <i>object</i>, earns its own tier later.) ' +
        'You wrote <b>' + ctx.ledger.count() + ' lines</b> and every one still stands. Keep playing, or move on to <b>Tier 2: Functions</b>.'
    };
});
