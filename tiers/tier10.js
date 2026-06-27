/* Tier 10 — the finale: free build. Registered as a config factory like every tier;
   the host (game.js) mounts it and marks it complete on entry (a freeplay tier has no
   step to advance, so reaching it IS the finish).

   No new grammar, no gates. The engine already seeds this tier from the carried box +
   the full accumulating ledger, so the player walks in with everything they built. The
   one open-ended step accepts any box property (assignCheck() with no args) and never
   completes (until: () => false) — the canvas stays open forever. The `freeplay` flag is
   purely a layout hint: it swaps the step dots for a "free build" label. */
BoxGame.registerTier(10, function () {
    // the finale accepts everything the game ever taught: the Tier-0 bare form
    // (box = "blue", which sets color) AND any box.prop = value. assignCheck can do
    // one or the other, not both at once, so route by whether the line has a dot.
    const anyProp = BoxGame.assignCheck();                       // box.prop = value
    const bareColor = BoxGame.assignCheck({ bare: 'color' });    // box = "color"
    const bothForms = (p, ctx) => (p.prop ? anyProp : bareColor)(p, ctx);

    return {
      mount: '#app', file: 'box.js', tier: 10, freeplay: true,
      box: { color: 'grey' },
      ledger: ['// tier 10 — free build · everything unlocked'],
      placeholder: 'box.glow = 40',
      hints: [
        { label: 'box = "rebeccapurple"', insert: 'box = "rebeccapurple"' },
        { label: 'box = "linear-gradient(135deg, #7c4dff, #4dd0ff)"', insert: 'box = "linear-gradient(135deg, #7c4dff, #4dd0ff)"' },
        { label: 'box.size = 320', insert: 'box.size = 320' },
        { label: 'box.rounded = true', insert: 'box.rounded = true' },
        { label: 'box.rotation = 45', insert: 'box.rotation = 45' },
        { label: 'box.opacity = 0.8', insert: 'box.opacity = 0.8' },
        { label: 'box.glow = 40', insert: 'box.glow = 40' }
      ],
      steps: [
        {
          // any property, any order, as many times as you like. never advances:
          // the finale is a canvas, not a checklist.
          check: bothForms,
          until: () => false,
          lesson: (ctx) =>
            '<h4>&#9733; The opening — now it’s yours.</h4>' +
            'Remember the field of glowing squares you named your box in? Every one of them was a box, drawn by code — the kind of code you’ve now written yourself. ' +
            'There are no more steps. <b>' + ctx.ledger.count() + ' lines</b> stand behind you, and the whole box is open at once: ' +
            '<code>color</code>, <code>size</code>, <code>rounded</code>, <code>opacity</code>, <code>rotation</code>, <code>glow</code> — set any of them, in any order, as often as you like. ' +
            'The last line always wins. This is where you keep building.'
        }
      ]
    };
});
