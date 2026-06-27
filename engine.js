/* ============================================================
   BoxGame engine — the shared foundation.
   One canonical Box, one Ledger, one Stage, one Console, one
   CosmicField, one highlighter. Lesson tiers are thin config
   passed to mountTier(); bespoke scenes compose the parts.

   Classic script on purpose: loads via <script src="engine.js">
   and works on a double-clicked file:// page (no server needed).
   When this graduates to a bundled app it becomes an ES module —
   and Tier 9 gets to teach the import/export it already models.
   ============================================================ */
window.BoxGame = (function () {
  'use strict';

  /* ---------- syntax highlighter (safe, placeholder-based) ---------- */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function highlight(line, name) {
    const ident = isName(name) ? name : 'box';
    let s = esc(line); const slots = [];
    const stash = (cls, txt) => { slots.push('<span class="' + cls + '">' + txt + '</span>'); return 'p' + (slots.length - 1); };
    s = s.replace(/("[^"]*"|'[^']*')/g, m => stash('s', m));
    s = s.replace(/(\/\/.*)$/g, m => stash('c', m));
    s = s.replace(new RegExp('\\b' + escapeRe(ident) + '\\b', 'g'), () => stash('ident-box', ident));
    s = s.replace(/(===|==|=)/g, m => stash('op', m));
    s = s.replace(/\b(function|return|class|new|const|let|var|if|else|for|while|of|import|export|from|this|null|undefined|true|false)\b/g, m => stash('k', m));
    s = s.replace(/\b([A-Z]\w*)\b/g, m => stash('f', m));
    s = s.replace(/-?\b\d+(?:\.\d+)?\b/g, m => stash('n', m));
    s = s.replace(/p(\d+)/g, (m, i) => slots[+i]);
    return s;
  }

  /* ---------- is this a real CSS color? ---------- */
  let _probe = null;
  function isColor(v) {
    if (!_probe) _probe = document.createElement('div');
    _probe.style.color = '';
    try { _probe.style.color = v; } catch (e) {}
    if (_probe.style.color !== '') return true;
    // gradients are <image>s, not <color>s — invalid for `color`, but valid as a
    // background. Wave those through too, so "a color can be many colors" renders.
    if (!/gradient\(/i.test(String(v))) return false;
    _probe.style.backgroundImage = '';
    try { _probe.style.backgroundImage = v; } catch (e) { return false; }
    return _probe.style.backgroundImage !== '';
  }

  /* ---------- the box's chosen identity ----------
     The shell lets the player name the box; tiers pick that name up so every
     line reads in their voice. Resolves from ?box=… or localStorage, else 'box'.
     The dev level-select (index.html) clears it, so direct tier opens stay 'box'. */
  function isName(s) { return typeof s === 'string' && /^[A-Za-z_$][\w$]*$/.test(s); }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function varName() {
    try {
      const q = new URLSearchParams(location.search).get('box');
      if (isName(q)) return q;
      const s = localStorage.getItem('boxgame.name');
      if (isName(s)) return s;
    } catch (e) {}
    return 'box';
  }
  function setVarName(n) { try { if (isName(n)) localStorage.setItem('boxgame.name', n); } catch (e) {} }
  function clearVarName() { try { localStorage.removeItem('boxgame.name'); } catch (e) {} }

  /* ---------- carried state: the box follows the player across tiers ----------
     The whole game's premise is that code you write stays forever and the next
     tier builds on it. So the box's *visual* state (color/size/…) and the
     accumulating ledger persist across tiers, keyed off the player's saved game.
     Written on each commit (not on every render) so tier 6's 60fps loop doesn't
     hammer storage. The dev/menu reset clears these alongside name + progress. */
  const BOX_KEY = 'boxgame.box', LEDGER_KEY = 'boxgame.ledger';
  function boxState() { try { const s = JSON.parse(localStorage.getItem(BOX_KEY)); return (s && typeof s === 'object') ? s : null; } catch (e) { return null; } }
  function saveBoxState(s) { try { localStorage.setItem(BOX_KEY, JSON.stringify(s)); } catch (e) {} }
  function ledgerLines() { try { const a = JSON.parse(localStorage.getItem(LEDGER_KEY)); return Array.isArray(a) ? a : null; } catch (e) { return null; } }
  function saveLedgerLines(a) { try { localStorage.setItem(LEDGER_KEY, JSON.stringify(a)); } catch (e) {} }
  function clearCarry() { try { localStorage.removeItem(BOX_KEY); localStorage.removeItem(LEDGER_KEY); } catch (e) {} }

  // swap the literal identifier `box` for the chosen name in pure-code strings…
  function renameIdent(str, name) {
    if (!str || !isName(name) || name === 'box') return str;
    return String(str).replace(/\bbox\b/g, name);
  }
  // …and, in lesson/teaser HTML, only inside code spans — never prose nouns ("the box").
  function renameInCode(html, name) {
    if (!html || !isName(name) || name === 'box') return html;
    return String(html)
      .replace(/(<code>)([\s\S]*?)(<\/code>)/g, (m, a, b, c) => a + renameIdent(b, name) + c)
      .replace(/(<span class="ex">)([\s\S]*?)(<\/span>)/g, (m, a, b, c) => a + renameIdent(b, name) + c);
  }

  /* ---------- which *form* a color value takes (for reveal tags) ---------- */
  function colorForm(v) {
    v = String(v).trim();
    if (/gradient\(/i.test(v)) return 'gradient';
    if (/^#/.test(v))          return 'hex';
    if (/^rgb/i.test(v))       return 'rgb';
    return 'named';
  }

  /* ---------- canonical box properties: what any tier can set ----------
     The box's friendly, teachable surface (rounded → radius, etc.). Tiers
     validate against this via assignCheck rather than re-declaring it. */
  const PROPS = {
    color:    { type: 'color',                       apply: (b, v) => b.set('color', v) },
    size:     { type: 'number',  min: 20,   max: 420, apply: (b, v) => b.set('size', v) },
    rounded:  { type: 'boolean',                     apply: (b, v) => b.set('radius', v ? 80 : 4) },
    opacity:  { type: 'number',  min: 0,    max: 1,   apply: (b, v) => b.set('opacity', v) },
    rotation: { type: 'number',  min: -180, max: 180, apply: (b, v) => b.set('rotation', v) },
    glow:     { type: 'number',  min: 0,    max: 60,  apply: (b, v) => b.set('glow', v) }
  };

  /* ---------- assignCheck: a name-aware validator factory ----------
     Turns a small declaration into a step.check, doing all the target / dot /
     type / range validation (with teachable errors) so a tier needn't:
       assignCheck({ bare: 'color' })   →  <name> = "blue"   sets color
       assignCheck({ require: 'size' })  →  insists on <name>.size = N
       assignCheck()                     →  any <name>.prop = value
     The variable name comes from ctx at call time, so the same check works
     whatever the player named their box. Returns {commit,apply,tag} or {error}. */
  function assignCheck(opts) {
    opts = opts || {};
    const props = opts.props || PROPS;
    const bare = opts.bare || null;     // prop that a dot-less `name = value` sets
    const need = opts.require || null;  // pin the step to one property
    const tagOf = opts.tag || null;     // (value, parsed) => tag (else: color form)
    return function (p, ctx) {
      const name = (ctx && ctx.name) || opts.name || 'box';
      if (p.error) return { error: p.error };
      if (p.target !== name) return { error: 'You can only change  ' + name + '  here — start the line with  ' + name };

      let prop = p.prop;
      if (!prop) {
        if (!bare) return { error: 'Reach into the box with a dot — like  ' + name + '.size = 240' };
        prop = bare;
      } else if (bare && !need) {
        return { error: 'Just set  ' + name + '  itself for now:  ' + name + ' = "color"' };
      }
      if (need && prop !== need) {
        if (props[need] && props[prop]) return { error: 'Good instinct — ' + name + '.' + prop + ' is real. For this step, set  ' + name + '.' + need + '.' };
        return { error: 'This step is about  ' + name + '.' + need + '.' };
      }
      const spec = props[prop];
      if (!spec) return { error: 'The box has no property  ' + name + '.' + prop + '. Try ' + Object.keys(props).join(', ') + '.' };

      if (spec.type === 'color') {
        if (p.type !== 'string') return { error: 'A color is text, so it needs quotes:  ' + (p.prop ? name + '.' + prop : name) + ' = "' + p.rawValue + '"' };
        if (!isColor(p.value)) return { error: 'The browser doesn’t recognize "' + p.value + '". Try  blue · tomato · gold — or a hex like  #4dd0ff' };
      } else if (spec.type === 'number') {
        if (p.type === 'string') return { error: 'A ' + prop + ' is a number — drop the quotes:  ' + name + '.' + prop + ' = ' + p.value };
        if (p.type !== 'number') return { error: name + '.' + prop + ' needs a number, like  ' + name + '.' + prop + ' = 240' };
        if (spec.min != null && (p.value < spec.min || p.value > spec.max)) return { error: 'Keep  ' + name + '.' + prop + '  between ' + spec.min + ' and ' + spec.max + '.' };
      } else if (spec.type === 'boolean') {
        if (p.type !== 'boolean') return { error: name + '.' + prop + ' is yes-or-no — write  true  or  false  (no quotes):  ' + name + '.' + prop + ' = true' };
      } else if (spec.type === 'string') {
        if (p.type !== 'string') return { error: name + '.' + prop + ' is text — wrap it in quotes.' };
      }

      const lhs = p.prop ? name + '.' + prop : name;
      const quoted = (spec.type === 'color' || spec.type === 'string');
      let tag = tagOf ? tagOf(p.value, p) : undefined;
      if (tag === undefined && spec.type === 'color') tag = colorForm(p.value);
      return { commit: lhs + ' = ' + (quoted ? '"' + p.value + '"' : p.rawValue), apply: (b) => spec.apply(b, p.value), tag: tag, message: 'committed — locked into the ledger.' };
    };
  }

  /* ---------- shared assignment parser ----------
     Understands:  name = value   and   name.prop = value
     Classifies the value as string / number / boolean / identifier. */
  function parseAssignment(input) {
    const line = String(input).trim();
    if (!line) return { error: 'Type a line of code.' };
    const m = line.match(/^([A-Za-z_$][\w$]*)(\.[A-Za-z_$][\w$]*)?\s*(=+)\s*(.*)$/);
    if (!m) {
      if (!/=/.test(line)) return { error: 'To set a value you need an  =  sign.' };
      return { error: 'Start with a variable name, like  box = ...' };
    }
    const target = m[1], prop = m[2] ? m[2].slice(1) : null, eq = m[3];
    const rhs = m[4].trim().replace(/;+$/, '').trim();
    if (eq.length > 1) return { error: eq + ' compares two things (it asks “are these equal?”). To set a value, use a single  =' };
    if (rhs === '') return { error: 'What value should it get? Put something after the  =' };
    const qs = rhs.match(/^(["'])(.*)\1$/);
    let value, type;
    if (qs) { value = qs[2]; type = 'string'; }
    else if (/^["']/.test(rhs)) return { error: 'Looks like a missing closing quote. Wrap the whole value, like  "blue"' };
    else if (/^-?\d+(\.\d+)?$/.test(rhs)) { value = parseFloat(rhs); type = 'number'; }
    else if (rhs === 'true' || rhs === 'false') { value = (rhs === 'true'); type = 'boolean'; }
    else { value = rhs; type = 'identifier'; }
    return { target: target, prop: prop, value: value, type: type, rawValue: rhs };
  }

  /* ---------- Box: the one canonical state model ---------- */
  class Box {
    constructor(initial) {
      this.state = Object.assign({ color: 'grey', size: 150, radius: 18, opacity: 1, rotation: 0, glow: 0 }, initial || {});
      this._subs = [];
    }
    get(k) { return this.state[k]; }
    set(k, v) { this.state[k] = v; this._emit(); return this; }
    assign(o) { Object.assign(this.state, o); this._emit(); return this; }
    subscribe(fn) { this._subs.push(fn); fn(this.state); return this; }
    _emit() { for (const fn of this._subs) fn(this.state); }
  }

  /* ---------- Stage: render a Box's state into the live square ---------- */
  class Stage {
    constructor(el) { this.el = el; }
    bind(box) { this.box = box; box.subscribe(s => this.render(s)); return this; }
    render(s) {
      const el = this.el; if (!el) return;
      el.style.background = s.color;
      el.style.width = el.style.height = s.size + 'px';
      el.style.borderRadius = s.radius + 'px';
      el.style.opacity = s.opacity;
      el.style.transform = 'rotate(' + (s.rotation || 0) + 'deg)';
      el.style.boxShadow = (s.glow ? '0 0 ' + s.glow + 'px ' + (s.glow / 3) + 'px ' + s.color + ', ' : '') +
        '0 22px 70px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.07)';
    }
    pop() { const el = this.el; if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }

  /* ---------- Squares: render MANY squares (Tier 4 arrays/loops) ----------
     A list of plain square states drawn into a flex container. Elements are
     reused across renders so property changes animate (CSS transition), and
     each square takes the same shape as a Box so loop bodies apply uniformly. */
  class Squares {
    constructor(el) { this.el = el; this.items = []; }
    _base(c) { return { color: c || 'grey', size: 84, radius: 12, opacity: 1, rotation: 0 }; }
    set(list) {
      this.items = (list || []).map(v => typeof v === 'string' ? this._base(v) : Object.assign(this._base(), v));
      this.render(); return this;
    }
    each(fn) { this.items.forEach((s, i) => fn(s, i)); this.render(); return this; }
    get length() { return this.items.length; }
    render() {
      const el = this.el; if (!el) return;
      while (el.children.length > this.items.length) el.removeChild(el.lastChild);
      while (el.children.length < this.items.length) { const d = document.createElement('div'); d.className = 'sq'; el.appendChild(d); }
      this.items.forEach((s, k) => {
        const d = el.children[k];
        d.style.background = s.color;
        d.style.width = d.style.height = s.size + 'px';
        d.style.borderRadius = s.radius + 'px';
        d.style.opacity = s.opacity;
        d.style.transform = 'rotate(' + (s.rotation || 0) + 'deg)';
      });
    }
  }

  /* ---------- Ledger: the accumulating, read-only code pane ---------- */
  class Ledger {
    constructor(el, name) { this.el = el; this.name = isName(name) ? name : 'box'; }
    _add(text, opts) {
      opts = opts || {};
      const prev = this.el.querySelector('.line.active');
      if (prev && opts.active) { prev.classList.remove('active'); prev.classList.add('past'); }
      const n = this.el.children.length;
      const div = document.createElement('div');
      div.className = 'line' + (opts.fresh ? ' fresh' : '') + (opts.active ? ' active' : '');
      div.dataset.i = n;
      div.innerHTML = '<span class="gutter">' + (n + 1) + '</span><span class="content">' + (text === '' ? '&nbsp;' : highlight(text, this.name)) + '</span>';
      this.el.appendChild(div);
      this.el.scrollTop = this.el.scrollHeight;
      return div;
    }
    load(lines) { this.el.innerHTML = ''; lines.forEach((t, i) => this._add(t, { active: i === lines.length - 1 })); return this; }
    commit(text) { return this._add(text, { active: true, fresh: true }); }
    count() { return this.el.children.length; }
    rename(i, newText) { const d = this.el.querySelector('.line[data-i="' + i + '"]'); if (d) { d.classList.add('renamed'); d.querySelector('.content').innerHTML = highlight(newText, this.name); } }
    orphan(i, note) { const d = this.el.querySelector('.line[data-i="' + i + '"]'); if (d) { d.classList.add('err'); d.querySelector('.content').innerHTML += '<span class="annot">  ' + note + '</span>'; d.scrollIntoView({ block: 'nearest' }); } }
  }

  /* ---------- Console: input + lesson text + messages ---------- */
  class Console {
    constructor(root) {
      this.root = root;
      this.lessonEl = root.querySelector('.lesson');
      this.input = root.querySelector('input.cmd');
      this.msgEl = root.querySelector('.msg');
      this._run = null;
      if (this.input) this.input.addEventListener('keydown', e => { if (e.key === 'Enter' && this._run) this._run(this.input.value); });
    }
    onRun(fn) { this._run = fn; return this; }
    lesson(html) { this.lessonEl.innerHTML = html; return this; }
    clear() { this.input.value = ''; }
    ok(m) { this.msgEl.className = 'msg ok'; this.msgEl.textContent = m; }
    err(m) { this.msgEl.className = 'msg err'; this.msgEl.textContent = m; this.root.classList.add('shake'); setTimeout(() => this.root.classList.remove('shake'), 330); }
    focus() { if (this.input) this.input.focus(); }
  }

  /* ---------- CosmicField: the spectacle (opening + shell) + collapse ----------
     Hundreds of drifting squares with depth/parallax and a glowing hero.
     collapse() lets gravity take the field and kills the hero. */
  class CosmicField {
    constructor(spaceEl, opts) {
      this.space = spaceEl; this.opts = opts || {};
      this.W = spaceEl.clientWidth || 600; this.H = spaceEl.clientHeight || 700;
      this.mouse = { x: this.W / 2, y: this.H / 2, tx: this.W / 2, ty: this.H / 2 };
      this.stars = []; this.hero = null; this.state = 'idle';
      this.palette = ['#7c4dff', '#4dd0ff', '#ff4dd2', '#9b8cff', '#4dffd0'];
    }
    _rand(a, b) { return a + Math.random() * (b - a); }
    _nebula(x, y, sz, col) { const n = document.createElement('div'); n.className = 'nebula'; n.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + sz + 'px;height:' + sz + 'px;background:' + col + ';'; this.space.appendChild(n); }
    _makeStar() {
      const f = this, s = {};
      s.depth = f._rand(0.15, 1); s.size = 2 + s.depth * 6;
      s.x = f._rand(0, f.W); s.y = f._rand(0, f.H);
      s.vx = f._rand(-0.15, 0.15) * s.depth; s.vy = f._rand(-0.15, 0.15) * s.depth;
      s.spin = f._rand(-0.4, 0.4); s.angle = f._rand(0, 360); s.phase = f._rand(0, Math.PI * 2);
      s.color = f.palette[Math.floor(Math.random() * f.palette.length)]; s.life = 1;
      s.el = document.createElement('div'); s.el.className = 'star';
      s.el.style.width = s.el.style.height = s.size + 'px'; s.el.style.background = s.color;
      s.el.style.boxShadow = '0 0 ' + (4 + s.depth * 8) + 'px ' + s.color;
      f.space.appendChild(s.el); return s;
    }
    _updateStar(s, t, dying) {
      const f = this;
      if (dying) {
        s.vy += 0.3; s.angle += s.spin * 4; s.x += s.vx * 2; s.y += s.vy; s.life -= 0.013;
        s.el.style.opacity = Math.max(0, s.life);
        s.el.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0) rotate(' + s.angle + 'deg)'; return;
      }
      s.x += s.vx; s.y += s.vy;
      if (s.x < -12) s.x = f.W + 12; if (s.x > f.W + 12) s.x = -12;
      if (s.y < -12) s.y = f.H + 12; if (s.y > f.H + 12) s.y = -12;
      const px = (f.mouse.x - f.W / 2) * s.depth * 0.045, py = (f.mouse.y - f.H / 2) * s.depth * 0.045;
      s.angle += s.spin;
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.002 + s.phase));
      s.el.style.opacity = tw * (0.3 + s.depth * 0.7);
      s.el.style.transform = 'translate3d(' + (s.x + px) + 'px,' + (s.y + py) + 'px,0) rotate(' + s.angle + 'deg)';
    }
    _makeHero() {
      const f = this, h = {};
      h.size = Math.min(f.W, f.H) * (f.opts.heroSize || 0.15);
      h.x = f.W / 2; h.y = f.H / 2; h.angle = 0; h.hue = 230; h.death = 0;
      h.el = document.createElement('div'); h.el.id = 'hero';
      h.el.style.width = h.el.style.height = h.size + 'px';
      f.space.appendChild(h.el); return h;
    }
    _updateHero(h, t, dying) {
      const f = this;
      if (dying) {
        h.death = Math.min(1, h.death + 0.016); const p = h.death;
        const s = Math.max(0, h.size * (1 - p)), flick = Math.random() < 0.4 ? 0.3 : 1, sat = 90 * (1 - p);
        h.el.style.opacity = (1 - p) * flick; h.el.style.width = h.el.style.height = s + 'px';
        h.el.style.background = 'hsl(' + h.hue + ',' + sat + '%,' + (60 - 20 * p) + '%)';
        h.el.style.boxShadow = '0 0 ' + (40 * (1 - p)) + 'px ' + (10 * (1 - p)) + 'px hsla(' + h.hue + ',' + sat + '%,60%,' + (0.5 * (1 - p)) + ')';
        h.el.style.transform = 'translate3d(' + (h.x - s / 2) + 'px,' + (h.y - s / 2) + 'px,0) rotate(' + (h.angle + p * 180) + 'deg)'; return;
      }
      const tx = f.W / 2 + (f.mouse.x - f.W / 2) * 0.12, ty = f.H / 2 + (f.mouse.y - f.H / 2) * 0.12;
      h.x += (tx - h.x) * 0.06; h.y += (ty - h.y) * 0.06;
      h.hue = (230 + Math.sin(t * 0.0004) * 90 + 360) % 360; h.angle = Math.sin(t * 0.0006) * 24;
      const s = h.size * (1 + Math.sin(t * 0.002) * 0.06), c = 'hsl(' + h.hue + ' 90% 65%)';
      h.el.style.width = h.el.style.height = s + 'px';
      h.el.style.background = 'linear-gradient(135deg, hsl(' + h.hue + ' 90% 70%), hsl(' + ((h.hue + 60) % 360) + ' 90% 58%))';
      h.el.style.boxShadow = '0 0 55px 9px ' + c + ', 0 0 120px 32px hsla(' + h.hue + ',90%,60%,.38), inset 0 0 24px rgba(255,255,255,.32)';
      h.el.style.transform = 'translate3d(' + (h.x - s / 2) + 'px,' + (h.y - s / 2) + 'px,0) rotate(' + h.angle + 'deg)';
    }
    start() {
      const sp = this.space; this.W = sp.clientWidth || this.W; this.H = sp.clientHeight || this.H;
      this._nebula(this.W * 0.20, this.H * 0.25, Math.max(260, this.W * 0.45), '#3a1d6e');
      this._nebula(this.W * 0.74, this.H * 0.66, Math.max(300, this.W * 0.55), '#123a5e');
      this._nebula(this.W * 0.55, this.H * 0.18, Math.max(220, this.W * 0.35), '#5e1d4a');
      const count = this.opts.density || Math.max(90, Math.min(240, Math.round((this.W * this.H) / 3200)));
      for (let i = 0; i < count; i++) this.stars.push(this._makeStar());
      this.hero = this._makeHero();
      sp.addEventListener('mousemove', e => { const r = sp.getBoundingClientRect(); this.mouse.tx = e.clientX - r.left; this.mouse.ty = e.clientY - r.top; });
      window.addEventListener('resize', () => { this.W = sp.clientWidth; this.H = sp.clientHeight; });
      this.state = 'alive';
      requestAnimationFrame(this._loop.bind(this));
      return this;
    }
    collapse() { this.state = 'collapsing'; this.space.classList.add('dead'); }
    _loop(t) {
      this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.08;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.08;
      const dying = this.state === 'collapsing';
      for (const s of this.stars) this._updateStar(s, t, dying);
      if (this.hero) this._updateHero(this.hero, t, dying);
      requestAnimationFrame(this._loop.bind(this));
    }
  }

  /* ---------- layout + styles ---------- */
  function ensureStyles() {
    if (document.getElementById('boxgame-css')) return;
    const st = document.createElement('style');
    st.id = 'boxgame-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function layoutHTML(cfg, name) {
    const dots = '<span class="pdot"></span>'.repeat((cfg.steps || []).length);
    const ph = renameIdent(cfg.placeholder || (name + ' = "blue"'), name);
    const t = cfg.teaser || { done: 'Tier complete &#10003;', next: '' };
    const teaser = { done: renameInCode(t.done, name), next: renameInCode(t.next || '', name) };
    return '' +
      '<div class="editor">' +
        '<div class="tabbar"><div class="tab"><span class="dot">&#9679;</span> ' + (cfg.file || 'box.js') + '</div>' +
          '<div class="progress"><span class="plabel">tier ' + (cfg.tier != null ? cfg.tier : '') + '</span>' + dots + '</div></div>' +
        '<div class="code"></div>' +
        '<div class="console">' +
          '<div class="lesson"></div><div class="hints"></div>' +
          '<div class="row"><span class="caret">&#10095;</span>' +
            '<input class="cmd" autocomplete="off" spellcheck="false" placeholder=\'' + ph + '\' />' +
            '<span class="enter">&#9166; run</span></div>' +
          '<div class="msg"></div>' +
        '</div>' +
      '</div>' +
      '<div class="stage">' +
        '<div class="stage-label">tier ' + (cfg.tier != null ? cfg.tier : '') + ' &middot; the box</div>' +
        '<div class="box-wrap"><div id="boxEl"></div></div>' +
        '<div class="caption"></div>' +
        '<div class="teaser"><div class="card"><div class="done">' + teaser.done + '</div><div class="next">' + (teaser.next || '') + '</div><button class="go" type="button" style="display:none">Continue &rarr;</button></div></div>' +
      '</div>';
  }

  function buildHints(el, list, con, name) {
    if (!el || !list) return;
    const nm = isName(name) ? name : 'box';
    list.forEach(h => {
      const obj = (typeof h === 'object');
      const label = renameIdent(obj ? h.label : h, nm);   // string hint label = the colour
      const insert = renameIdent(obj ? h.insert : (nm + ' = "' + h + '"'), nm);
      const swatch = obj ? h.color : h;          // string hints are their own colour
      const dot = swatch ? '<i style="background:' + swatch + '"></i>' : '';
      const b = document.createElement('span'); b.className = 'swatch';
      b.innerHTML = dot + label;
      b.onclick = () => { con.input.value = insert; con.input.focus(); };
      el.appendChild(b);
    });
  }

  /* ---------- tier registry + discovery hook (host-driven SPA) ----------
     Each tier file registers a config *factory* instead of mounting itself, so the
     single-page host can mount/re-mount any tier on demand. discover() lets the host
     record concepts as the player meets them (reveals fired, tiers completed). */
  const TIERS = {};
  function registerTier(n, factory) { TIERS[n] = factory; }
  let _onDiscover = null;
  function setDiscoverHandler(fn) { _onDiscover = fn; }
  function discover(info) { if (_onDiscover) { try { _onDiscover(info); } catch (e) {} } }

  /* ---------- mountTier: wire a whole lesson from a config ---------- */
  function mountTier(cfg) {
    ensureStyles();
    const root = typeof cfg.mount === 'string' ? document.querySelector(cfg.mount) : cfg.mount;
    root.classList.add('app');
    const name = isName(cfg.varName) ? cfg.varName : varName();
    root.innerHTML = layoutHTML(cfg, name);

    // the box follows the player: carried visual state wins over the tier's defaults,
    // so the square you shaped in an earlier tier shows up here exactly as you left it.
    const carried = boxState();
    const box = new Box(Object.assign({}, cfg.box || {}, carried || {}));
    const stage = new Stage(root.querySelector('#boxEl')).bind(box);
    // accumulating ledger: once there's saved history, every later tier appends its
    // banner comment to the full record (never re-seeding "box = grey"); a fresh game
    // falls back to the tier's own ledger. `ledgerStore` is the live, persisted array.
    const tierLedger = (cfg.ledger || ['box = "grey"']);
    const savedLines = ledgerLines();
    const banner = tierLedger.filter(l => /^\s*\/\//.test(l));   // leading comment line(s)
    const ledgerStore = (savedLines && savedLines.length) ? savedLines.concat(banner) : tierLedger.slice();
    const ledger = new Ledger(root.querySelector('.code'), name).load(ledgerStore.map(l => renameIdent(l, name)));
    const con = new Console(root.querySelector('.console'));
    const captionEl = root.querySelector('.caption');
    const dots = root.querySelectorAll('.pdot');
    const steps = cfg.steps || [];
    let step = 0;

    // opt-in many-squares stage (Tier 4): hide the lone box, draw a collection instead.
    let squares = null;
    if (cfg.collection) {
      const wrap = root.querySelector('.box-wrap'); if (wrap) wrap.style.display = 'none';
      const sqEl = document.createElement('div'); sqEl.className = 'squares';
      root.querySelector('.stage').insertBefore(sqEl, captionEl);
      squares = new Squares(sqEl);
      if (Array.isArray(cfg.collection)) squares.set(cfg.collection);
    }

    // history powers the reps mechanic. `history` is every commit ever; `stepHistory`
    // is just the current step's slice — what reveal/until predicates reason over.
    // distinct() answers "how many different values (or tags) so far", the low,
    // optional-depth bar that lets a tier advance on variety instead of a gate.
    const history = [];
    let stepHistory = [];
    const firedReveals = new Set();
    const hintsEl = root.querySelector('.hints');

    const ctx = {
      box: box, ledger: ledger, stage: stage, console: con, name: name, squares: squares,
      get step() { return step; }, total: steps.length, history: history,
      get stepCommits() { return stepHistory.length; },
      distinct: function (field) {
        const seen = new Set();
        for (const e of stepHistory) {
          const v = field === 'tag' ? e.tag : (e.parsed ? e.parsed[field] : undefined);
          if (v != null) seen.add(v);
        }
        return seen.size;
      }
    };
    const setCaption = (text) => { captionEl.innerHTML = highlight(renameIdent(text, name), name); };
    // prefer the last line the player actually wrote (carried from a prior tier) over the
    // tier's hardcoded default, so the caption shows the box as they left it — not "grey".
    const lastWritten = (savedLines && savedLines.length) ? savedLines[savedLines.length - 1] : null;
    setCaption(lastWritten ? lastWritten
             : cfg.caption ? renameIdent(cfg.caption, name)
             : (name + ' = "' + box.get('color') + '"'));
    // every lesson/outro/reveal passes through here so `box` renders in the player's name.
    const showLesson = (html) => con.lesson(renameInCode(html, name));

    // a lightbulb: fired once, mid-step, when its rep count or predicate is met.
    // It only ever unlocks — injects a richer lesson and appends hints — never gates.
    function fireReveals(cur, parsed) {
      if (!cur.reveals) return;
      cur.reveals.forEach((rv, i) => {
        if (firedReveals.has(i)) return;
        const hit = typeof rv.when === 'function'
          ? !!rv.when(ctx, parsed)
          : stepHistory.length >= (rv.when || 1);
        if (!hit) return;
        firedReveals.add(i);
        discover({ tier: cfg.tier, reveal: i });
        if (rv.lesson) showLesson(rv.lesson(ctx));
        if (rv.hints) buildHints(hintsEl, rv.hints, con, name);
      });
    }

    // a step completes on its until() predicate, else after `goal` commits (default 1).
    // Omitting both reproduces the old behaviour exactly: advance on any valid commit.
    function stepComplete(cur, parsed) {
      if (typeof cur.until === 'function') return !!cur.until(ctx, parsed);
      return stepHistory.length >= (cur.goal || 1);
    }

    con.onRun(raw => {
      const cur = steps[Math.min(step, steps.length - 1)];
      if (!cur) return;
      const parsed = parseAssignment(raw);
      const res = cur.check(parsed, ctx, raw) || {};
      if (res.error) { con.err(res.error); return; }

      const commitText = res.commit || String(raw).trim();
      ledger.commit(commitText);
      if (res.apply) res.apply(box);
      // persist what the player just did: the line into the accumulating ledger, and
      // the box's current visual state so the next tier opens on the same square.
      ledgerStore.push(commitText);
      saveLedgerLines(ledgerStore);
      saveBoxState(box.state);
      stage.pop();
      setCaption(commitText);
      con.clear();
      con.ok(res.message || 'committed — locked into the ledger.');

      // a check may hand back its own `parsed` so reps/distinct work for grammars
      // that aren't plain assignments (a function call has no `=` to parse).
      const entry = { commit: commitText, parsed: res.parsed || parsed, tag: res.tag };
      history.push(entry);

      // past the last step? the tier's done — keep painting, but nothing to advance.
      if (step >= steps.length) return;
      stepHistory.push(entry);

      fireReveals(cur, parsed);
      if (!stepComplete(cur, parsed)) return;   // still climbing this step

      step++;
      stepHistory = [];
      firedReveals.clear();
      dots.forEach((d, i) => d.classList.toggle('on', i < step));
      if (step >= steps.length) {
        const t = root.querySelector('.teaser'); if (t) t.classList.add('show');
        showLesson(cfg.outro ? cfg.outro(ctx) : steps[steps.length - 1].lesson(ctx));
        discover({ tier: cfg.tier, complete: true });
        if (typeof cfg.onComplete === 'function') cfg.onComplete(ctx);
        const go = root.querySelector('.teaser .go');
        if (go && typeof cfg.onAdvance === 'function') {
          go.style.display = '';
          go.onclick = () => cfg.onAdvance(ctx);
        }
      } else {
        showLesson(steps[step].lesson(ctx));
      }
    });

    showLesson(steps.length ? steps[0].lesson(ctx) : '');
    buildHints(hintsEl, cfg.hints, con, name);
    con.focus();
    return ctx;
  }

  const CSS = `
  .app { display: grid; grid-template-columns: minmax(320px, 44%) 1fr; height: 100vh; background:#05060a; color:#e6e9f2; font-family: ui-sans-serif, "Segoe UI", system-ui, sans-serif; }
  .app * { box-sizing: border-box; }
  .editor { display:flex; flex-direction:column; background:#0d1017; border-right:1px solid #1c2230; min-width:0; }
  .tabbar { display:flex; align-items:center; gap:8px; height:40px; padding:0 12px; background:#0a0d13; border-bottom:1px solid #1c2230; flex:0 0 auto; }
  .tab { font:12px ui-monospace, Menlo, monospace; color:#e6e9f2; padding:7px 13px; border-radius:7px 7px 0 0; background:#0d1017; border:1px solid #1c2230; border-bottom:none; }
  .tab.muted { color:#4a5670; background:transparent; border:none; }
  .tab .dot { color:#4dd0ff; font-size:9px; }
  .progress { margin-left:auto; display:flex; gap:6px; align-items:center; }
  .pdot { width:9px; height:9px; border-radius:50%; border:1px solid #34406a; background:transparent; transition:all .4s; }
  .pdot.on { background:#54e6a0; border-color:#54e6a0; box-shadow:0 0 10px rgba(84,230,160,.6); }
  .plabel { font:10px ui-monospace, monospace; letter-spacing:.15em; text-transform:uppercase; color:#56618a; margin-right:4px; }
  .code { flex:1 1 auto; overflow:auto; padding:14px 0; font:13px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .code.fade .line { opacity:0; transform:translateY(-8px); transition:opacity .5s ease, transform .5s ease; }
  .line { display:flex; white-space:pre; padding:1px 14px; }
  .line .gutter { width:28px; text-align:right; padding-right:16px; color:#3c4866; user-select:none; flex:0 0 auto; }
  .line .content { flex:1 1 auto; }
  .line.fresh { animation: slidein .45s ease; }
  @keyframes slidein { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:none; } }
  .line.active { background:rgba(84,230,160,.07); box-shadow: inset 2px 0 0 #54e6a0; }
  .line.active .gutter { color:#54e6a0; }
  .line.active .content::after { content:" \\25C2 the box is this now"; color:#54e6a0; opacity:.7; font-size:11px; }
  .line.past { opacity:.58; }
  .line.renamed .ident-box { color:#54e6a0; }
  .line.err { background:rgba(255,70,90,.07); }
  .line.err .ident-box { color:#ff5b6e; text-decoration:line-through; }
  .k{color:#c792ea;} .s{color:#c3e88d;} .n{color:#f78c6c;} .c{color:#5a6786;font-style:italic;} .f{color:#82aaff;}
  .ident-box{color:#ffd166;font-weight:600;} .op{color:#89ddff;} .annot{color:#ff6b7d;}
  .console { flex:0 0 auto; border-top:1px solid #1c2230; background:#0a0d13; padding:14px 15px; }
  .lesson { font:13px/1.6 ui-sans-serif, system-ui, sans-serif; color:#aab6d4; margin-bottom:11px; }
  .lesson h4 { font:600 13px ui-sans-serif, system-ui; color:#e6e9f2; margin-bottom:5px; }
  .lesson code { font-family:ui-monospace, monospace; color:#ffd166; font-weight:600; background:rgba(255,209,102,.08); padding:1px 5px; border-radius:4px; }
  .lesson .ex { color:#c3e88d; font-family:ui-monospace, monospace; }
  .lesson i { color:#cfd6ea; font-style:italic; }
  .hints { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:11px; }
  .swatch { display:inline-flex; align-items:center; gap:6px; font:11px ui-monospace, monospace; color:#9fb0d0; background:#11151f; border:1px solid #243049; border-radius:20px; padding:3px 10px 3px 4px; cursor:pointer; transition:border-color .2s; }
  .swatch:hover { border-color:#4dd0ff; }
  .swatch i { width:13px; height:13px; border-radius:50%; display:inline-block; }
  .row { display:flex; align-items:center; gap:9px; font:14px ui-monospace, monospace; }
  .caret { color:#4dd0ff; }
  input.cmd { flex:1 1 auto; min-width:0; background:#11151f; border:1px solid #243049; color:#e6e9f2; font:14px ui-monospace, monospace; padding:10px 12px; border-radius:9px; outline:none; }
  input.cmd:focus { border-color:#4dd0ff; box-shadow:0 0 0 3px rgba(77,208,255,.12); }
  input.cmd::placeholder { color:#44506e; }
  .enter { color:#3c4866; font-size:11px; white-space:nowrap; }
  .console.shake { animation: shake .32s; }
  @keyframes shake { 0%,100%{transform:none} 20%{transform:translateX(-6px)} 60%{transform:translateX(6px)} }
  .msg { font-size:12px; margin-top:8px; min-height:15px; }
  .msg.err { color:#ff6b7d; } .msg.ok { color:#54e6a0; }
  .stage { position:relative; min-width:0; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center;
    background: radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 0 0 / 26px 26px, radial-gradient(130% 100% at 50% 38%, #141a28 0%, #0a0c12 58%, #07080d 100%); }
  .stage-label { position:absolute; top:14px; left:16px; font:11px ui-monospace, monospace; letter-spacing:.2em; text-transform:uppercase; color:#56618a; z-index:7; }
  .box-wrap { animation: idle 6s ease-in-out infinite; }
  @keyframes idle { 0%,100%{ transform:translateY(0) scale(1);} 50%{ transform:translateY(-9px) scale(1.015);} }
  #boxEl { width:150px; height:150px; border-radius:18px; background:grey; box-shadow:0 22px 70px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.07); transition: background .55s ease, border-radius .4s ease, opacity .4s ease, width .4s ease, height .4s ease, transform .4s ease; }
  #boxEl.pop { animation: popflash .32s ease; }
  @keyframes popflash { 0%{ filter:brightness(1.7);} 100%{ filter:none;} }
  .squares { display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:center; max-width:82%; }
  .sq { width:84px; height:84px; border-radius:12px; background:grey; box-shadow:0 14px 40px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.07);
    transition: background .45s ease, width .45s ease, height .45s ease, border-radius .4s ease, opacity .4s ease, transform .45s ease; }
  .caption { margin-top:26px; font:14px ui-monospace, monospace; color:#8a93ad; }
  .teaser { position:absolute; left:0; right:0; bottom:30px; display:flex; justify-content:center; opacity:0; transition:opacity .9s ease .2s; pointer-events:none; padding:0 20px; }
  .teaser.show { opacity:1; }
  .teaser .card { background:rgba(13,16,23,.85); border:1px solid #1c2230; border-radius:12px; padding:13px 18px; text-align:center; }
  .teaser .done { font:600 14px ui-sans-serif, system-ui; color:#54e6a0; }
  .teaser .next { margin-top:5px; font:12px ui-monospace, monospace; color:#7d8aa3; }
  .teaser .next b { color:#4dd0ff; }
  .teaser .go { margin-top:13px; font:600 13px ui-sans-serif, system-ui; color:#05060a; background:#54e6a0; border:none; border-radius:9px; padding:9px 20px; cursor:pointer; pointer-events:auto; transition:transform .12s ease, box-shadow .2s ease; box-shadow:0 6px 20px rgba(84,230,160,.32); }
  .teaser .go:hover { transform:translateY(-1px); box-shadow:0 9px 26px rgba(84,230,160,.46); }

  /* --- scenes (shell + opening): the cosmic field --- */
  .cosmic-stage { position:relative; min-width:0; overflow:hidden; background:#020108; }
  #space { position:absolute; inset:0; background: radial-gradient(120% 95% at 50% 42%, #181434 0%, #0b0a1a 46%, #020108 100%); transition: background 1.6s ease, filter 1.3s ease; cursor:crosshair; }
  #space.dead { background:#020108; filter:saturate(.15) brightness(.4); }
  .nebula { position:absolute; border-radius:50%; filter:blur(80px); opacity:.5; pointer-events:none; mix-blend-mode:screen; transition:opacity 1.4s ease; }
  #space.dead .nebula { opacity:0; }
  .star { position:absolute; top:0; left:0; border-radius:2px; will-change:transform,opacity; }
  #hero { position:absolute; top:0; left:0; border-radius:16px; z-index:5; will-change:transform,opacity; }
  .task { font:12.5px/1.55 ui-sans-serif, system-ui, sans-serif; color:#9fb0d0; margin-bottom:10px; }
  .task b { color:#ffd166; font-family:ui-monospace, monospace; font-weight:600; }
  .task .self { color:#c792ea; }
  .pre { color:#7d8aa3; }
  .replay { position:absolute; top:11px; right:13px; z-index:8; font:11px ui-monospace, monospace; color:#9fb0d0; background:rgba(10,13,19,.7); border:1px solid #1c2230; border-radius:7px; padding:6px 10px; cursor:pointer; opacity:0; transition:opacity .5s; }
  .replay.show { opacity:1; } .replay:hover { border-color:#4dd0ff; }
  #restBox { position:absolute; left:50%; top:50%; width:120px; height:120px; margin:-60px 0 0 -60px; background:#8b8f9a; border-radius:12px; z-index:5; opacity:0; transform:scale(.6); transition:opacity 1s ease, transform 1s ease; box-shadow:0 12px 50px rgba(0,0,0,.55); }
  #restBox.show { opacity:1; transform:scale(1); }
  .afterglow { position:absolute; left:0; right:0; bottom:38px; text-align:center; z-index:7; opacity:0; transition:opacity 1s ease .3s; pointer-events:none; padding:0 20px; }
  .afterglow.show { opacity:1; }
  .afterglow .big { font:600 18px ui-sans-serif, system-ui; color:#e6e9f2; }
  .afterglow .sub { margin-top:7px; font:13px ui-monospace, monospace; color:#7d8aa3; }
  .afterglow .sub b { color:#54e6a0; }
  `;

  return {
    highlight: highlight, isColor: isColor, parseAssignment: parseAssignment,
    Box: Box, Stage: Stage, Squares: Squares, Ledger: Ledger, Console: Console, CosmicField: CosmicField,
    mountTier: mountTier, injectStyles: ensureStyles,
    registerTier: registerTier, tiers: TIERS, discover: discover, onDiscover: setDiscoverHandler,
    props: PROPS, colorForm: colorForm, assignCheck: assignCheck,
    varName: varName, setVarName: setVarName, clearVarName: clearVarName,
    boxState: boxState, saveBoxState: saveBoxState, ledgerLines: ledgerLines, saveLedgerLines: saveLedgerLines, clearCarry: clearCarry
  };
})();
