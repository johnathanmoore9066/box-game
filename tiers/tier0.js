/* Tier 0 — registered as a config factory; the host (game.js) mounts it.
   Ported from tier0.html; factory body runs fresh on every (re)mount. */
BoxGame.registerTier(0, function () {
    return {
      mount: '#app', file: 'box.js', tier: 0,
      box: { color: 'grey' },
      ledger: ['// tier 0 — variables & values', 'box = "grey"'],
      placeholder: 'box = "blue"',
      hints: ['tomato', 'gold', 'teal', 'rebeccapurple', 'hotpink'],
      teaser: { done: 'Tier 0 complete — variables &amp; values &#10003;', next: 'next up &rarr; <b>Tier 1: properties</b>' },
      steps: [
        {
          check: BoxGame.assignCheck({ bare: 'color' }),
          // low, optional bar: a handful of different colors and you may move on. The
          // reveals below entice toward depth (hex → rgb → gradient) and the bar is set
          // so the curious can walk the whole ladder, but reaching it is never required:
          // five names off the hint chips completes the tier just as well.
          until: (ctx) => ctx.distinct('value') >= 5,
          reveals: [
            { when: 2,
              hints: [ { label: '#4dd0ff', insert: 'box = "#4dd0ff"', color: '#4dd0ff' },
                       { label: '#ff5b6e', insert: 'box = "#ff5b6e"', color: '#ff5b6e' },
                       { label: '#ffd166', insert: 'box = "#ffd166"', color: '#ffd166' } ],
              lesson: () =>
                '<h4>&#128161; Colors are really numbers.</h4>“blue” is just a nickname. Underneath, a color is a number written in <b>hex</b> — a pair of digits each for red, green, blue: <code>"#4dd0ff"</code>. Same idea, more control. Try one (or keep using names — your call).' },
            { when: (ctx) => ctx.history.some(e => e.tag === 'hex'),
              hints: [ { label: 'rgb(124, 77, 255)', insert: 'box = "rgb(124, 77, 255)"', color: 'rgb(124,77,255)' },
                       { label: 'rgb(77, 255, 208)', insert: 'box = "rgb(77, 255, 208)"', color: 'rgb(77,255,208)' } ],
              lesson: () =>
                '<h4>&#128161; Three channels.</h4>Same color, spelled out — <b>red, green, blue</b>, <code>0</code>–<code>255</code> each: <code>"rgb(124, 77, 255)"</code>. Now you’re mixing it by hand.' },
            { when: (ctx) => ctx.history.some(e => e.tag === 'rgb'),
              hints: [ { label: 'gradient', insert: 'box = "linear-gradient(135deg, #7c4dff, #4dd0ff)"', color: 'linear-gradient(135deg,#7c4dff,#4dd0ff)' } ],
              lesson: () =>
                '<h4>&#128161; A color can be many colors.</h4>A value doesn’t have to be one thing. A <b>gradient</b> fades between colors: <code>"linear-gradient(135deg, #7c4dff, #4dd0ff)"</code>. Paint one.' }
          ],
          lesson: () =>
            '<h4>Meet box.</h4>The box has a <i>name</i> — <code>box</code> — and a <i>value</i> — <code>"grey"</code>. Together that’s a <b>variable</b>. Repaint it by assigning a new value with a single <code>=</code>:' +
            '<div style="margin:7px 0 2px"><span class="ex">box = "blue"</span> &nbsp; <span class="ex">box = "tomato"</span> &nbsp; <span class="ex">box = "gold"</span></div>' +
            'Give <code>box</code> a color — then keep going: <b>five different colors</b> opens the next tier. The box always shows your <b>last</b> line.'
        }
      ],
      outro: (ctx) =>
        '<h4>That’s a variable.</h4>One name — <code>box</code> — re-pointed at new values line after line, and every line still stands (you wrote <b>' + ctx.ledger.count() + '</b>). You also found that a value has <i>depth</i>: a name, a hex number, three channels, even a whole gradient — all still just <code>box = value</code>. That single idea — <b>assignment</b> — is the floor everything else is built on. Keep playing, or climb to <b>Tier 1: properties</b>.'
    };
});
