/* =========================================================
   Nova Hop — main game
   World units: the game is always 400 units wide; height
   follows the screen's aspect ratio. y grows downward, so
   climbing means y gets more negative. Physics runs at a
   fixed 60 ticks/s regardless of display refresh rate.
   ========================================================= */
(() => {
  'use strict';

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  const stage = $('#stage');
  const ui = {
    hud: $('#hud'), score: $('#hudScore'), best: $('#hudBest'), stars: $('#hudStars'),
    power: $('#power'), powerLabel: $('#powerLabel'), powerFill: $('#powerFill'), shield: $('#shieldChip'),
    toast: $('#toast'), toastSmall: $('#toastSmall'), toastBig: $('#toastBig'), touchHint: $('#touchHint'),
    menu: $('#menu'), pause: $('#pause'), over: $('#over'),
    skins: $('#skins'), wallet: $('#wallet'), menuBest: $('#menuBest'), how: $('#howText'),
    btnHaptics: $('#btnHaptics'), hapticsLabel: $('#hapticsLabel'), btnShare: $('#btnShare'),
    btnControl: $('#btnControl'), controlLabel: $('#controlLabel'), muteLabel: $('#muteLabel'),
    ribbon: $('#ribbon'), overCause: $('#overCause'), overScore: $('#overScore'),
    overBest: $('#overBest'), overStars: $('#overStars'), overZone: $('#overZone'),
    board: $('#board'), boardList: $('#boardList'), boardForm: $('#boardForm'), boardName: $('#boardName'),
  };

  // ---------- constants ----------
  const W = 400;
  const STEP = 1000 / 60;
  const G = 0.42;
  const JUMP = -11.6;          // peak height ≈ 160 units
  const SPRING = -19.5;
  const MAX_FALL = 15;
  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  const SKINS = [
    { id: 'nova', name: 'Nova', price: 0, body: '#ffc04d', shade: '#ff7d33', glow: '#fff0b8' },
    { id: 'mint', name: 'Minty', price: 150, body: '#5ef2c2', shade: '#12a87c', glow: '#d4fff1' },
    { id: 'berry', name: 'Berry', price: 400, body: '#ff7ab6', shade: '#d4307e', glow: '#ffd6e8' },
    { id: 'frost', name: 'Frost', price: 800, body: '#8cc4ff', shade: '#4467e8', glow: '#e3efff' },
  ];

  const ZONES = [
    { at: 0, name: 'Cotton Sky', top: [86, 168, 255], bot: [190, 230, 255], clouds: 1, stars: 0, hills: 1 },
    { at: 6000, name: 'Sunset Drift', top: [255, 104, 146], bot: [255, 198, 120], clouds: 0.7, stars: 0.15, hills: 0 },
    { at: 16000, name: 'Aurora Reach', top: [28, 32, 96], bot: [54, 146, 160], clouds: 0.2, stars: 0.8, hills: 0 },
    { at: 30000, name: 'Deep Cosmos', top: [8, 6, 28], bot: [44, 22, 88], clouds: 0, stars: 1, hills: 0 },
  ];

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const vibrate = (p) => { if (!save.haptics) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('novahop.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem('novahop.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  const save = {
    best: store.get('best', 0),
    wallet: store.get('wallet', 0),
    skin: store.get('skin', 'nova'),
    owned: store.get('owned', ['nova']),
    muted: store.get('muted', false),
    control: store.get('control', 'touch'),
    name: store.get('name', ''),
    bestAlt: store.get('bestAlt', 0),
    haptics: store.get('haptics', true),
  };
  if (!save.owned.includes(save.skin)) save.skin = 'nova';
  const skinOf = () => SKINS.find((s) => s.id === save.skin) || SKINS[0];

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function starPath(x, y, r, points = 5, inner = 0.45, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 ? r * inner : r;
      const a = rot + (i * Math.PI) / points;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  // ---------- canvas sizing ----------
  let H = 700;
  let scale = 1;
  let dpr = 1;

  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    scale = r.width / W;
    H = r.height / scale;
    if (state === 'menu') camY = -H * 0.9;
  }

  // ---------- background decor (precomputed) ----------
  const STARS = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, 1), s: rand(0.6, 2.2), p: rand(0, TAU) }));
  const CLOUDS = Array.from({ length: 8 }, () => ({ x: rand(-60, W), y: rand(0, 1), s: rand(0.6, 1.4), v: rand(0.08, 0.25) }));
  const BOKEH = Array.from({ length: 5 }, (_, i) => ({ x: rand(0, W), y: rand(0, 1), r: rand(60, 140), p: i * 1.3 }));

  // ---------- state ----------
  let state = 'menu'; // menu | play | paused | dying | over
  let player, plats, items, enemies, coins, parts, popups;
  let camY = 0, alt = 0, bonus = 0, topGenY = 0, lastEnemyY = 0, shake = 0, tick = 0;
  let comboN = 0, comboT = 0, runStars = 0, zoneIdx = 0, passedBest = false, dyingT = 0, deathCause = 'fall';

  const diff = () => clamp(alt / 40000, 0, 1);
  const score = () => Math.floor(alt / 3) + bonus;

  function zoneIndex(a) {
    let i = 0;
    while (i + 1 < ZONES.length && a >= ZONES[i + 1].at) i++;
    return i;
  }

  function zoneMix(a) {
    const i = zoneIndex(a);
    const z = ZONES[i];
    const n = ZONES[i + 1];
    const t = n ? clamp((a - (n.at - 2000)) / 2000, 0, 1) : 0;
    if (!n || t === 0) return z;
    const m = (k) => lerp(z[k], n[k], t);
    return {
      top: z.top.map((v, j) => lerp(v, n.top[j], t)),
      bot: z.bot.map((v, j) => lerp(v, n.bot[j], t)),
      clouds: m('clouds'), stars: m('stars'), hills: m('hills'),
    };
  }

  function mkPlat(x, y, w, type) {
    return { x, y, w, h: 14, type, vx: 0, bounce: 0, t: rand(0, 100), gone: 0, broken: false, fall: 0, rot: 0, touched: false, dead: false };
  }

  function resetWorld() {
    plats = []; items = []; enemies = []; coins = []; parts = []; popups = [];
    alt = 0; bonus = 0; shake = 0; comboN = 0; comboT = 0; runStars = 0; zoneIdx = 0;
    passedBest = false; dyingT = 0; lastEnemyY = 0;
    plats.push(mkPlat(18, 0, W - 36, 'ground'));
    player = {
      x: W / 2, y: -20, vx: 0, vy: 0, r: 20, face: 1, sx: 1, sy: 1,
      rocket: 0, shield: 0, magnet: 0, blink: 90, rot: 0, dead: false, trail: [],
    };
    camY = state === 'menu' ? -H * 0.9 : -H * 0.76;
    topGenY = 0;
    genUntil(camY - 400);
  }

  // ---------- procedural generation ----------
  function genUntil(limit) {
    while (topGenY > limit) spawnRow();
  }

  function spawnRow() {
    const d = diff();
    const gap = rand(52 + 50 * d, 78 + 58 * d); // never above ~136 → always reachable
    topGenY -= gap;
    const y = topGenY;
    const w = Math.round(lerp(82, 58, d) + rand(-6, 6));
    const x = rand(6, W - w - 6);

    let type = 'normal';
    const pMove = alt > 600 ? 0.1 + 0.3 * d : 0;
    const pCloud = alt > 3000 ? 0.06 + 0.16 * d : 0;
    const r = Math.random();
    if (r < pMove) type = 'moving';
    else if (r < pMove + pCloud) type = 'cloud';

    const pl = mkPlat(x, y, w, type);
    if (type === 'moving') pl.vx = (rand(0.7, 1.3) + 1.6 * d) * (chance(0.5) ? 1 : -1);
    plats.push(pl);

    // decoy crumble platform between rows (breaks, no bounce)
    if (alt > 300 && chance(0.12 + 0.18 * d)) {
      const cw = rand(56, 72);
      plats.push(mkPlat(rand(6, W - cw - 6), y + gap * 0.5, cw, 'crumble'));
    }

    // items
    if (type !== 'cloud') {
      const q = Math.random();
      if (q < 0.06) items.push({ kind: 'spring', plat: pl, ox: rand(6, w - 24), comp: 0, t: 0 });
      else if (q < 0.074 && alt > 1500) items.push({ kind: 'rocket', plat: pl, ox: w / 2, t: rand(0, 60) });
      else if (q < 0.088 && alt > 800) items.push({ kind: 'shield', plat: pl, ox: w / 2, t: rand(0, 60) });
      else if (q < 0.1 && alt > 800) items.push({ kind: 'magnet', plat: pl, ox: w / 2, t: rand(0, 60) });
    }

    // stardust
    if (chance(0.3)) {
      const n = 3 + ((Math.random() * 3) | 0);
      const cx = rand(50, W - 50);
      const col = chance(0.5);
      for (let i = 0; i < n; i++) {
        const k = n > 1 ? i / (n - 1) : 0;
        coins.push({
          x: col ? cx : clamp(cx + (i - (n - 1) / 2) * 28, 14, W - 14),
          y: col ? y - 40 - i * 28 : y - 46 - Math.sin(k * Math.PI) * 32,
          t: rand(0, TAU), got: false,
        });
      }
    }

    // enemies
    if (alt > 2500 && y < lastEnemyY - (720 - 320 * d) && chance(0.06 + 0.12 * d)) {
      const amp = rand(20, 90);
      const e = { bx: rand(18 + amp, W - 18 - amp), y: y - gap * 0.5, r: 17, t: rand(0, TAU), amp, spd: rand(0.015, 0.032), x: 0, dead: false, vy: 0, rot: 0 };
      e.x = e.bx + Math.sin(e.t) * e.amp;
      enemies.push(e);
      lastEnemyY = y;
    }
  }

  // ---------- particles & popups ----------
  function part(o) {
    if (parts.length > 420) parts.shift();
    const q = { x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 30, size: 3, color: '#fff', shape: 'dot', rot: 0, vr: 0, drag: 0.97, ...o };
    q.max = q.life;
    parts.push(q);
  }

  function popup(x, y, text, color = '#fff', size = 18) {
    popups.push({ x, y, text, color, size, life: 60 });
  }

  function dust(x, y, color = 'rgba(255,255,255,0.9)') {
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI;
      part({ x: x + rand(-10, 10), y, vx: Math.cos(a) * rand(1, 3), vy: Math.sin(a) * rand(0.3, 1.4), life: rand(16, 26), size: rand(2.5, 5), color, drag: 0.92 });
    }
  }

  function ring(x, y, color = '#fff', size = 30) {
    part({ x, y, shape: 'ring', life: 22, size, color });
  }

  function sparkle(x, y, n = 8, colors = ['#fff3a6', '#ffc04d', '#ffffff']) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(1.5, 4.5);
      part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(18, 32), size: rand(3, 6), color: pick(colors), shape: 'star', vr: rand(-0.2, 0.2), drag: 0.92 });
    }
  }

  function confetti(x, y, n = 60) {
    const colors = ['#ffc04d', '#ff6fae', '#5ef2c2', '#8cc4ff', '#ffffff', '#9b6bff'];
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const s = rand(4, 11);
      part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.22, life: rand(60, 110), size: rand(4, 8), color: pick(colors), shape: 'rect', rot: rand(0, TAU), vr: rand(-0.3, 0.3), drag: 0.985 });
    }
  }

  // ---------- input ----------
  const keys = { left: false, right: false };
  const pointers = new Map();
  let tiltX = 0;
  let tiltOn = false;

  // Demo autopilot (?autopilot): steers toward the best landing platform. Used for trailers.
  const autopilot = /[?&]autopilot(=|&|$)/.test(location.search);
  function aiX() {
    const p = player;
    const feet = p.y + p.r;
    const apex = p.vy < 0 ? feet - (p.vy * p.vy) / (2 * G) : feet;
    let best = null;
    for (const pl of plats) {
      if (pl.broken || pl.gone > 0 || pl.type === 'crumble') continue;
      if (pl.y < apex + 4 || pl.y > camY + H) continue;
      if (!best || pl.y < best.y) best = pl;
    }
    if (!best) return 0;
    let dx = best.x + best.w / 2 - p.x;
    if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
    for (const e of enemies) {
      if (!e.dead && Math.abs(e.y - p.y) < 90 && Math.abs(e.x - p.x) < 60 && !(p.vy > 0 && p.y < e.y)) dx += e.x > p.x ? -120 : 120;
    }
    return Math.abs(dx) < 6 ? 0 : clamp(dx / 40, -1, 1);
  }

  function inputX() {
    if (autopilot) return aiX();
    let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (x === 0 && pointers.size) {
      let last = 0;
      for (const v of pointers.values()) last = v;
      x = last;
    }
    if (x === 0 && save.control === 'tilt' && tiltOn) {
      const v = tiltX / 18;
      x = Math.abs(v) < 0.08 ? 0 : clamp(v, -1, 1);
    }
    return x;
  }

  function onOrient(e) {
    let g = e.gamma || 0;
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    if (ang === 90) g = e.beta || 0;
    else if (ang === -90 || ang === 270) g = -(e.beta || 0);
    tiltX = g;
  }

  async function enableTilt() {
    if (tiltOn) return true;
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === 'function') {
      try { if ((await DOE.requestPermission()) !== 'granted') return false; } catch (e) { return false; }
    }
    window.addEventListener('deviceorientation', onOrient);
    tiltOn = true;
    return true;
  }

  const sideOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return e.clientX - r.left < r.width / 2 ? -1 : 1;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    pointers.set(e.pointerId, sideOf(e));
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => { if (pointers.has(e.pointerId)) pointers.set(e.pointerId, sideOf(e)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => canvas.addEventListener(t, (e) => pointers.delete(e.pointerId)));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT') return;
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') keys.left = true;
    if (k === 'ArrowRight' || k === 'KeyD') keys.right = true;
    if ((k === 'Space' || k === 'Enter') && tag !== 'BUTTON') {
      if (state === 'menu' || state === 'over') start();
      else if (state === 'paused') resume();
    }
    if (k === 'Escape' || k === 'KeyP') togglePause();
    if (k === 'KeyM') toggleMute();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; pointers.clear(); if (state === 'play') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); });

  // ---------- simulation ----------
  function land(pl) {
    const p = player;
    p.y = pl.y - p.r;
    pl.bounce = 1;
    const spring = items.find((it) => it.kind === 'spring' && it.plat === pl && Math.abs(p.x - (pl.x + it.ox + 9)) < p.r + 6);
    if (spring) {
      p.vy = SPRING;
      spring.comp = 1;
      if (state === 'play') {
        Sfx.spring();
        vibrate(15);
        popup(p.x, p.y - 34, 'BOING!', '#fff36b', 24);
        sparkle(p.x, pl.y, 10);
        shake = 4;
      }
    } else {
      p.vy = state === 'menu' ? -7.5 : JUMP;
      if (state === 'play') Sfx.jump();
    }
    p.sx = 1.38;
    p.sy = 0.66;
    dust(p.x, pl.y);
    if (pl.type === 'cloud') {
      pl.gone = 0.01;
      Sfx.cloud();
      for (let i = 0; i < 10; i++) part({ x: pl.x + rand(0, pl.w), y: pl.y + rand(-4, 8), vx: rand(-1, 1), vy: rand(-0.5, 0.5), life: 40, size: rand(8, 14), color: 'rgba(255,255,255,0.7)', shape: 'smoke', drag: 0.95 });
    }
    if (state === 'play' && pl.type !== 'ground' && !pl.touched) {
      pl.touched = true;
      if (Math.abs(p.x - (pl.x + pl.w / 2)) < pl.w * 0.13) {
        bonus += 5;
        bumpScore();
        Sfx.perfect();
        popup(p.x, p.y - 36, 'PERFECT +5', '#ffffff', 15);
        ring(p.x, pl.y, '#ffffff', 34);
      }
    }
  }

  function breakPlat(pl) {
    pl.broken = true;
    pl.fall = 0;
    Sfx.crumble();
    for (let i = 0; i < 10; i++) {
      part({ x: pl.x + rand(0, pl.w), y: pl.y + rand(0, 10), vx: rand(-2, 2), vy: rand(-2, 1), g: 0.3, life: rand(30, 50), size: rand(3, 6), color: pick(['#c98a4a', '#e8b97a', '#8a5a2b']), shape: 'rect', rot: rand(0, TAU), vr: rand(-0.3, 0.3) });
    }
  }

  function collectCoin(c) {
    c.got = true;
    comboN = comboT > 0 ? comboN + 1 : 1;
    comboT = 80;
    const mult = Math.min(comboN, 5);
    bonus += 10 * mult;
    runStars++;
    bumpScore();
    Sfx.coin(comboN);
    sparkle(c.x, c.y, 6);
    popup(c.x, c.y - 10, '+' + 10 * mult, '#ffe066', 14 + mult * 2);
    if (comboN >= 3 && comboN % 2 === 1) popup(player.x, player.y - 50, 'COMBO x' + mult, '#ff8ad0', 20);
  }

  function takePower(it, x, y) {
    it.got = true;
    const p = player;
    Sfx.power();
    vibrate(20);
    ring(x, y, '#ffffff', 46);
    sparkle(x, y, 14, ['#ffffff', '#5ef2c2', '#ffc04d']);
    if (it.kind === 'rocket') {
      p.rocket = 150;
      Sfx.rocketStart();
      popup(x, y - 20, 'ROCKET!', '#ffb15c', 24);
    } else if (it.kind === 'shield') {
      p.shield = 1;
      popup(x, y - 20, 'SHIELD!', '#5ef2c2', 24);
    } else if (it.kind === 'magnet') {
      p.magnet = 600;
      popup(x, y - 20, 'MAGNET!', '#ff7ab6', 24);
    }
  }

  function killEnemy(e, label) {
    e.dead = true;
    e.vy = -4;
    bonus += 50;
    bumpScore();
    Sfx.stomp();
    vibrate(25);
    shake = 7;
    popup(e.x, e.y - 24, label, '#ffffff', 20);
    sparkle(e.x, e.y, 12, ['#c9a2ff', '#ffffff', '#9b6bff']);
    ring(e.x, e.y, '#c9a2ff', 40);
  }

  function update() {
    tick++;
    if (state === 'over') { stepFx(); return; }

    const p = player;
    const playing = state === 'play';

    // horizontal
    if (state === 'menu') {
      // attract mode: gentle centred sway, can never leave the ground pad
      const nx = W / 2 + Math.sin(tick * 0.012) * 100;
      p.vx = nx - p.x;
      p.x = nx;
      if (Math.abs(p.vx) > 0.2) p.face = p.vx > 0 ? 1 : -1;
      if (p.y > 100) { p.y = -20; p.vy = 0; }
    } else {
      const ax = playing && !p.dead ? inputX() : 0;
      p.vx += (ax * 6.8 - p.vx) * (Math.abs(ax) > 0.05 ? 0.2 : 0.12);
      if (Math.abs(ax) > 0.15) p.face = ax > 0 ? 1 : -1;
      p.x += p.vx;
    }
    if (p.x < -p.r) p.x += W + 2 * p.r;
    else if (p.x > W + p.r) p.x -= W + 2 * p.r;

    // vertical
    if (p.rocket > 0) {
      p.rocket--;
      p.vy = Math.max(p.vy - 1.1, -16);
      for (let i = 0; i < 2; i++) {
        part({ x: p.x - p.face * 14 + rand(-3, 3), y: p.y + 10, vx: rand(-0.8, 0.8), vy: rand(4, 7), life: rand(14, 22), size: rand(4, 7), color: pick(['#ffe066', '#ff8a3d', '#ff5470']), drag: 0.93 });
      }
      if (tick % 3 === 0) part({ x: p.x - p.face * 14, y: p.y + 16, vx: rand(-0.6, 0.6), vy: rand(2, 3), life: 40, size: rand(7, 11), color: 'rgba(255,255,255,0.45)', shape: 'smoke', drag: 0.96 });
      if (p.rocket === 0) { Sfx.rocketStop(); p.vy = -7; }
    } else {
      p.vy = Math.min(p.vy + G, MAX_FALL);
    }
    const prevFeet = p.y + p.r;
    p.y += p.vy;
    const feet = p.y + p.r;
    if (p.dead) p.rot += 0.16;

    // squash & stretch relaxes toward a velocity-based stretch
    const st = clamp(-p.vy / 30, -0.12, 0.25);
    p.sx = lerp(p.sx, 1 - st * 0.5, 0.22);
    p.sy = lerp(p.sy, 1 + st, 0.22);
    if (--p.blink < 0) p.blink = rand(120, 320);
    if (p.magnet > 0) p.magnet--;

    // trail at high speed
    if (p.vy < -13) { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 8) p.trail.shift(); }
    else if (p.trail.length) p.trail.shift();

    // platforms
    for (const pl of plats) {
      pl.t++;
      if (pl.bounce > 0) pl.bounce = Math.max(0, pl.bounce - 0.06);
      if (pl.type === 'moving') {
        pl.x += pl.vx;
        if (pl.x < 4) { pl.x = 4; pl.vx *= -1; } else if (pl.x + pl.w > W - 4) { pl.x = W - 4 - pl.w; pl.vx *= -1; }
      }
      if (pl.broken) { pl.fall += 0.45; pl.y += pl.fall; pl.rot += 0.04; }
      if (pl.gone > 0) pl.gone = Math.min(1, pl.gone + 0.05);
    }
    if (p.vy > 0 && !p.dead && p.rocket === 0) {
      for (const pl of plats) {
        if (pl.broken || pl.gone > 0) continue;
        if (state === 'menu' && pl.type !== 'ground') continue;
        if (prevFeet <= pl.y + 1 && feet >= pl.y && p.x + p.r * 0.75 > pl.x && p.x - p.r * 0.75 < pl.x + pl.w) {
          if (pl.type === 'crumble') { breakPlat(pl); continue; }
          land(pl);
          break;
        }
      }
    }

    // items
    for (const it of items) {
      it.t++;
      if (it.comp > 0) it.comp = Math.max(0, it.comp - 0.07);
      if (it.kind === 'spring' || it.got || !playing || p.dead) continue;
      const ix = it.plat.x + it.ox;
      const iy = it.plat.y - 34 + Math.sin(it.t * 0.06) * 4;
      if (Math.hypot(p.x - ix, p.y - iy) < p.r + 16) takePower(it, ix, iy);
    }

    // stardust
    if (comboT > 0) comboT--;
    for (const c of coins) {
      c.t += 0.07;
      if (c.got || !playing || p.dead) continue;
      if (p.magnet > 0) {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dd = Math.hypot(dx, dy);
        if (dd < 200 && dd > 0) { c.x += (dx / dd) * 9; c.y += (dy / dd) * 9; }
      }
      if (Math.hypot(p.x - c.x, p.y - c.y) < p.r + 12) collectCoin(c);
    }

    // enemies
    for (const e of enemies) {
      if (e.dead) { e.vy += 0.5; e.y += e.vy; e.rot += 0.2; continue; }
      e.t += e.spd;
      e.x = e.bx + Math.sin(e.t) * e.amp;
      if (!playing || p.dead) continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r * 0.85) {
        if (p.rocket > 0) killEnemy(e, 'BLAST +50');
        else if (p.vy > 0 && p.y < e.y - e.r * 0.2) {
          killEnemy(e, 'STOMP +50');
          p.vy = JUMP * 1.15;
          p.sx = 1.3; p.sy = 0.7;
        } else if (p.shield) {
          p.shield = 0;
          Sfx.shield();
          killEnemy(e, 'SHIELD SAVE');
          p.vy = JUMP;
        } else die('enemy');
      }
    }

    // camera, score & world upkeep
    if (playing) {
      const target = p.y - H * 0.42;
      if (target < camY) camY = lerp(camY, target, 0.22);
      if (p.y - camY < 70) camY = p.y - 70;

      alt = Math.max(alt, -(p.y + p.r));
      genUntil(camY - 300);

      const bottom = camY + H + 120;
      plats = plats.filter((pl) => {
        const keep = pl.y < bottom && pl.gone < 1;
        if (!keep) pl.dead = true;
        return keep;
      });
      items = items.filter((it) => !it.got && !it.plat.dead);
      coins = coins.filter((c) => !c.got && c.y < bottom);
      enemies = enemies.filter((e) => e.y < bottom);

      const zi = zoneIndex(alt);
      if (zi > zoneIdx) {
        zoneIdx = zi;
        toast('ZONE ' + (zi + 1), ZONES[zi].name);
        Sfx.zone();
      }
      const sc = score();
      if (!passedBest && save.best > 0 && sc > save.best) {
        passedBest = true;
        popup(p.x, p.y - 60, 'NEW BEST!', '#ffe066', 28);
        confetti(p.x, p.y, 40);
        Sfx.best();
        vibrate([20, 40, 20]);
      }
      if (p.y - p.r > camY + H) die('fall');
    } else if (state === 'dying') {
      dyingT++;
      camY = Math.min(lerp(camY, p.y - H * 0.5, 0.08), -H * 0.76);
      if (dyingT > 80) gameOver();
    }

    stepFx();
  }

  function stepFx() {
    for (const q of parts) {
      q.vx *= q.drag; q.vy *= q.drag;
      q.vy += q.g;
      q.x += q.vx; q.y += q.vy;
      q.rot += q.vr;
      q.life--;
    }
    parts = parts.filter((q) => q.life > 0);
    for (const t of popups) { t.y -= 0.8; t.life--; }
    popups = popups.filter((t) => t.life > 0);
    if (shake > 0) shake = shake * 0.86 - 0.05;
  }

  // ---------- rendering ----------
  function drawBG() {
    const a = state === 'menu' ? 0 : alt;
    const z = zoneMix(a);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(z.top));
    g.addColorStop(1, rgb(z.bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft bokeh
    for (const b of BOKEH) {
      const y = (((b.y * H - camY * 0.08) % (H + 300)) + H + 300) % (H + 300) - 150;
      const x = b.x + Math.sin(tick * 0.004 + b.p) * 30;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, b.r);
      rg.addColorStop(0, 'rgba(255,255,255,0.13)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
    }

    // stars
    if (z.stars > 0.02) {
      for (const s of STARS) {
        const y = (((s.y * H - camY * 0.05) % H) + H) % H;
        const tw = 0.55 + 0.45 * Math.sin(tick * 0.05 + s.p);
        ctx.globalAlpha = z.stars * tw;
        ctx.fillStyle = '#fff';
        if (s.s > 1.8) { starPath(s.x, y, s.s * 1.8, 4, 0.3, 0); ctx.fill(); } else ctx.fillRect(s.x, y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    // distant planet in late zones
    if (z.stars > 0.5) {
      const py = H * 0.3 + ((-camY * 0.02) % 40);
      ctx.globalAlpha = (z.stars - 0.5) * 2;
      const pg = ctx.createRadialGradient(W * 0.78 - 14, py - 14, 6, W * 0.78, py, 46);
      pg.addColorStop(0, '#ffd1f0'); pg.addColorStop(1, '#7a3fd0');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(W * 0.78, py, 46, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,255,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(W * 0.78, py, 76, 14, -0.35, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // clouds
    if (z.clouds > 0.02) {
      ctx.globalAlpha = z.clouds * 0.85;
      for (const c of CLOUDS) {
        const y = (((c.y * (H + 200) - camY * 0.25) % (H + 200)) + H + 200) % (H + 200) - 100;
        const x = ((c.x + tick * c.v) % (W + 160)) - 80;
        drawCloud(x, y, c.s);
      }
      ctx.globalAlpha = 1;
    }

    // rolling hills near the start
    if (z.hills > 0.02) {
      const base = H * 0.86 + (-H * 0.76 - camY) * 0.5;
      if (base < H + 40) {
        ctx.globalAlpha = z.hills;
        hill(base - 40, '#9fe0b8', 0.012, 26, 1.7);
        hill(base, '#62c99a', 0.018, 18, 0.4);
        ctx.globalAlpha = 1;
      }
    }
  }

  function hill(y, color, freq, amp, phase) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H + 10);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y + Math.sin(x * freq + phase) * amp);
    ctx.lineTo(W, H + 10);
    ctx.closePath();
    ctx.fill();
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, TAU);
    ctx.arc(x + 24 * s, y - 10 * s, 26 * s, 0, TAU);
    ctx.arc(x + 52 * s, y, 20 * s, 0, TAU);
    ctx.arc(x + 26 * s, y + 8 * s, 22 * s, 0, TAU);
    ctx.fill();
  }

  function drawBestLine(top, bot) {
    const y = -save.bestAlt;
    if (y < top || y > bot) return;
    const beaten = alt > save.bestAlt;
    ctx.save();
    ctx.globalAlpha = beaten ? 0.35 : 0.85;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -tick * 0.6;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.setLineDash([]);
    // little flag
    ctx.fillStyle = '#ffe066';
    const ax = W / 2 - 18;
    ctx.fillRect(ax, y - 26, 2, 26);
    const wave = Math.sin(tick * 0.15) * 2;
    ctx.beginPath(); ctx.moveTo(ax + 2, y - 26); ctx.lineTo(ax + 38, y - 22 + wave); ctx.lineTo(ax + 2, y - 14); ctx.fill();
    ctx.fillStyle = '#1b1446';
    ctx.font = "700 9px Fredoka, 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('BEST', ax + 5, y - 20 + wave * 0.5);
    ctx.restore();
  }

  function drawPlat(pl) {
    const off = pl.bounce > 0 ? Math.sin((1 - pl.bounce) * Math.PI * 2) * pl.bounce * 5 : 0;
    const x = pl.x;
    const y = pl.y + off;
    const { w, h } = pl;
    ctx.save();
    if (pl.gone > 0) ctx.globalAlpha = 1 - pl.gone;

    if (pl.type === 'ground') {
      ctx.fillStyle = '#8a5a3b';
      rr(x, y + 6, w, 40, 18); ctx.fill();
      ctx.fillStyle = '#5ee39a';
      rr(x - 4, y, w + 8, 18, 9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      rr(x + 10, y + 3, w - 20, 4, 2); ctx.fill();
      ctx.restore();
      return;
    }

    if (pl.type === 'cloud') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      const n = Math.max(3, Math.round(w / 18));
      for (let i = 0; i < n; i++) {
        const cx = x + 9 + (i * (w - 18)) / (n - 1);
        ctx.moveTo(cx + 11, y + 6);
        ctx.arc(cx, y + 6 + Math.sin(pl.t * 0.05 + i) * 1.2, 11, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = 'rgba(160,190,255,0.35)';
      rr(x + 4, y + 10, w - 8, 6, 3); ctx.fill();
      ctx.restore();
      return;
    }

    if (pl.broken) {
      ctx.translate(x + w / 2, y + h / 2);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * (6 + pl.fall * 2), 0);
        ctx.rotate(side * pl.rot);
        ctx.fillStyle = '#c98a4a';
        rr(side < 0 ? -w / 2 : 0, -h / 2, w / 2, h, 6); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    const palette = {
      normal: ['#8dffcf', '#25c98f', '#138a62'],
      moving: ['#a8dcff', '#4b95ff', '#2a5fd0'],
      crumble: ['#f1c48a', '#c98a4a', '#8a5a2b'],
    }[pl.type];

    // shadow / depth
    ctx.fillStyle = palette[2];
    rr(x, y + 4, w, h, 7); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, palette[0]);
    g.addColorStop(1, palette[1]);
    ctx.fillStyle = g;
    rr(x, y, w, h, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    rr(x + 6, y + 2.5, w - 12, 3, 1.5); ctx.fill();

    if (pl.type === 'moving') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const s of [-1, 1]) {
        const ax = s < 0 ? x + 9 : x + w - 9;
        ctx.beginPath();
        ctx.moveTo(ax + s * 4, y + h / 2 + 1);
        ctx.lineTo(ax - s * 2, y + h / 2 - 3);
        ctx.lineTo(ax - s * 2, y + h / 2 + 5);
        ctx.fill();
      }
    } else if (pl.type === 'crumble') {
      ctx.strokeStyle = 'rgba(90,50,20,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 1); ctx.lineTo(x + w * 0.38, y + h * 0.5); ctx.lineTo(x + w * 0.32, y + h);
      ctx.moveTo(x + w * 0.68, y + 1); ctx.lineTo(x + w * 0.62, y + h * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpring(it) {
    const pl = it.plat;
    const x = pl.x + it.ox;
    const base = pl.y + 1;
    const h = 11 + it.comp * 14;
    ctx.strokeStyle = '#d6dbe8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      ctx.lineTo(x + (i % 2 ? 16 : 2), base - (i * h) / 4);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff5470';
    rr(x - 1, base - h - 5, 20, 6, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    rr(x + 2, base - h - 4, 10, 2, 1); ctx.fill();
  }

  function drawPower(it) {
    const x = it.plat.x + it.ox;
    const y = it.plat.y - 34 + Math.sin(it.t * 0.06) * 4;
    const col = { rocket: '#ff9a3d', shield: '#3fe0b0', magnet: '#ff5fa2' }[it.kind];
    const pulse = 1 + Math.sin(it.t * 0.12) * 0.08;
    const halo = ctx.createRadialGradient(x, y, 4, x, y, 28 * pulse);
    halo.addColorStop(0, col);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, 28 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    if (it.kind === 'rocket') {
      ctx.rotate(-0.5);
      rr(-4, -9, 8, 15, 4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4, 3); ctx.lineTo(-8, 8); ctx.lineTo(-4, 6); ctx.moveTo(4, 3); ctx.lineTo(8, 8); ctx.lineTo(4, 6); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(0, 12 + Math.sin(it.t * 0.5) * 2); ctx.lineTo(3, 7); ctx.fill();
    } else if (it.kind === 'shield') {
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, -5); ctx.lineTo(6, 4); ctx.lineTo(0, 9); ctx.lineTo(-6, 4); ctx.lineTo(-8, -5); ctx.closePath(); ctx.fill();
    } else {
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, -1, 6, Math.PI, 0, true); ctx.stroke();
      ctx.fillStyle = '#c9cfe0';
      ctx.fillRect(-8.5, -3, 5, 5); ctx.fillRect(3.5, -3, 5, 5);
    }
    ctx.restore();
  }

  function drawCoin(c) {
    const sx = Math.max(0.25, Math.abs(Math.cos(c.t)));
    ctx.save();
    ctx.translate(c.x, c.y);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
    glow.addColorStop(0, 'rgba(255,230,120,0.6)');
    glow.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-18, -18, 36, 36);
    ctx.scale(sx, 1);
    starPath(0, 0, 10, 5, 0.48);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff9f1c';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(-2, -3, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y + Math.sin(e.t * 3) * 3);
    if (e.dead) ctx.rotate(e.rot);
    const r = e.r;
    // spikes
    ctx.fillStyle = '#4b1f9e';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + e.t * 1.5;
      const a1 = a - 0.22;
      const a2 = a + 0.22;
      ctx.moveTo(Math.cos(a1) * r * 0.9, Math.sin(a1) * r * 0.9);
      ctx.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9));
      ctx.lineTo(Math.cos(a2) * r * 0.9, Math.sin(a2) * r * 0.9);
    }
    ctx.fill();
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, r);
    g.addColorStop(0, '#d9b8ff');
    g.addColorStop(0.6, '#9b5bff');
    g.addColorStop(1, '#5a28c2');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // face
    if (e.dead) {
      ctx.strokeStyle = '#1b1446'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 6 - 3, -5); ctx.lineTo(s * 6 + 3, 1);
        ctx.moveTo(s * 6 + 3, -5); ctx.lineTo(s * 6 - 3, 1);
        ctx.stroke();
      }
    } else {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s * 6, -2, 4.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b1446';
        const lx = clamp((player.x - e.x) / 80, -1, 1) * 1.6;
        const ly = clamp((player.y - e.y) / 80, -1, 1) * 1.6;
        ctx.beginPath(); ctx.arc(s * 6 + lx, -2 + ly, 2.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#1b1446'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(s * 11, -9); ctx.lineTo(s * 2, -6); ctx.stroke();
      }
      ctx.strokeStyle = '#1b1446'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 9, 4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlob(x, y) {
    const p = player;
    const skin = skinOf();
    const r = p.r;
    ctx.save();
    ctx.translate(x, y + r);
    ctx.rotate(p.rot);
    ctx.scale(p.sx, p.sy);
    ctx.translate(0, -r);

    // rocket pack
    if (p.rocket > 0) {
      ctx.fillStyle = '#c9cfe0';
      rr(-p.face * 14 - 6, -6, 12, 22, 5); ctx.fill();
      ctx.fillStyle = '#ff5470';
      rr(-p.face * 14 - 6, -9, 12, 7, 4); ctx.fill();
    }

    // feet
    ctx.fillStyle = skin.shade;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(s * 9 + p.face * 2, r - 2, 7, 4.5, 0, 0, TAU); ctx.fill();
    }

    // antenna
    const sway = Math.sin(tick * 0.12) * 3 - p.vx * 0.9;
    ctx.strokeStyle = skin.shade;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r + 3); ctx.quadraticCurveTo(sway * 0.4, -r - 8, sway, -r - 13); ctx.stroke();
    const glow = ctx.createRadialGradient(sway, -r - 14, 1, sway, -r - 14, 12);
    glow.addColorStop(0, 'rgba(255,240,170,0.9)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sway, -r - 14, 12, 0, TAU); ctx.fill();
    starPath(sway, -r - 14, 5.5, 5, 0.5, -Math.PI / 2 + tick * 0.05);
    ctx.fillStyle = '#fff6c2'; ctx.fill();

    // body
    const g = ctx.createRadialGradient(-7, -9, 3, 0, 0, r + 3);
    g.addColorStop(0, skin.glow);
    g.addColorStop(0.5, skin.body);
    g.addColorStop(1, skin.shade);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.96, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-8, -10, 5, 3, -0.6, 0, TAU); ctx.fill();

    // face
    const fx = p.face * 3;
    const lx = clamp(p.vx / 7, -1, 1) * 1.8;
    const ly = clamp(p.vy / 12, -1, 1) * 1.8;
    if (p.dead) {
      ctx.strokeStyle = '#1b1446'; ctx.lineWidth = 2.4;
      for (const s of [-1, 1]) {
        const ex = s * 7 + fx;
        ctx.beginPath(); ctx.moveTo(ex - 3.5, -6); ctx.lineTo(ex + 3.5, 1); ctx.moveTo(ex + 3.5, -6); ctx.lineTo(ex - 3.5, 1); ctx.stroke();
      }
    } else if (p.blink < 7) {
      ctx.strokeStyle = '#1b1446'; ctx.lineWidth = 2.4;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 7 + fx - 4, -3); ctx.lineTo(s * 7 + fx + 4, -3); ctx.stroke(); }
    } else {
      for (const s of [-1, 1]) {
        const ex = s * 7 + fx;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex, -3, 5.5, 6.8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b1446';
        ctx.beginPath(); ctx.arc(ex + lx, -2.5 + ly, 3.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex + lx + 1.2, -4 + ly, 1.1, 0, TAU); ctx.fill();
      }
    }
    // cheeks
    ctx.fillStyle = 'rgba(255,90,140,0.35)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 12 + fx, 5, 3.6, 2.4, 0, 0, TAU); ctx.fill(); }
    // mouth
    ctx.strokeStyle = '#1b1446'; ctx.fillStyle = '#7a1f3d'; ctx.lineWidth = 2;
    if (p.dead || p.vy < -9) {
      ctx.beginPath(); ctx.ellipse(fx, 7, 3, 3.6, 0, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(fx, 4, 4.5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    ctx.restore();

    // shield bubble (unrotated)
    if (p.shield) {
      const sr = r + 11 + Math.sin(tick * 0.1) * 1.5;
      const sg = ctx.createRadialGradient(x, y, sr * 0.6, x, y, sr);
      sg.addColorStop(0, 'rgba(94,242,194,0)');
      sg.addColorStop(1, 'rgba(94,242,194,0.45)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(x, y, sr, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(220,255,245,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, sr, tick * 0.05, tick * 0.05 + 1.2); ctx.stroke();
    }
    if (p.magnet > 0 && tick % 2 === 0) {
      ctx.strokeStyle = `rgba(255,95,162,${0.15 + (p.magnet < 120 ? 0.1 * Math.sin(tick) : 0.15)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 24 + ((tick * 2) % 30), 0, TAU); ctx.stroke();
    }
  }

  function drawPlayer() {
    const p = player;
    const skin = skinOf();
    p.trail.forEach((t, i) => {
      ctx.globalAlpha = (i / p.trail.length) * 0.35;
      ctx.fillStyle = skin.body;
      ctx.beginPath(); ctx.arc(t.x, t.y, p.r * (0.5 + (i / p.trail.length) * 0.5), 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawBlob(p.x, p.y);
    // wrap-around ghost so the blob never pops at the edges
    if (p.x < p.r) drawBlob(p.x + W, p.y);
    else if (p.x > W - p.r) drawBlob(p.x - W, p.y);
  }

  function drawParts() {
    for (const q of parts) {
      const k = q.life / q.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = q.color;
      ctx.strokeStyle = q.color;
      if (q.shape === 'ring') {
        ctx.lineWidth = 3 * k;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k) + 4, 0, TAU); ctx.stroke();
      } else if (q.shape === 'star') {
        starPath(q.x, q.y, q.size * k + 1, 4, 0.35, q.rot); ctx.fill();
      } else if (q.shape === 'rect') {
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        ctx.restore();
      } else if (q.shape === 'smoke') {
        ctx.globalAlpha = k * 0.6;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.6 - k * 0.6), 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, q.size * k), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of popups) {
      const age = 60 - t.life;
      const s = age < 8 ? 0.4 + (age / 8) * 0.85 : age < 14 ? 1.25 - ((age - 8) / 6) * 0.25 : 1;
      ctx.globalAlpha = t.life < 18 ? t.life / 18 : 1;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(s, s);
      ctx.font = `700 ${t.size}px Fredoka, 'Trebuchet MS', sans-serif`;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(27,20,70,0.85)';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    drawBG();
    let sx = 0;
    let sy = 0;
    if (shake > 0.3 && !reduceMotion) { sx = rand(-shake, shake); sy = rand(-shake, shake); }
    ctx.save();
    ctx.translate(sx, -camY + sy);
    const top = camY - 80;
    const bot = camY + H + 80;
    if (save.bestAlt > 200 && state !== 'menu') drawBestLine(top, bot);
    for (const pl of plats) if (pl.y > top && pl.y < bot) drawPlat(pl);
    for (const it of items) {
      if (it.got || it.plat.y < top || it.plat.y > bot) continue;
      if (it.kind === 'spring') drawSpring(it); else drawPower(it);
    }
    for (const c of coins) if (!c.got && c.y > top && c.y < bot) drawCoin(c);
    for (const e of enemies) if (e.y > top && e.y < bot) drawEnemy(e);
    if (state !== 'over') drawPlayer();
    drawParts();
    drawPopups();
    ctx.restore();

    // enemy warning arrows for spikers just above the screen
    if (state === 'play') {
      for (const e of enemies) {
        if (e.dead) continue;
        const sy2 = e.y - camY;
        if (sy2 < -10 && sy2 > -260) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tick * 0.25);
          ctx.fillStyle = '#ff5fa2';
          ctx.beginPath(); ctx.moveTo(e.x, 64); ctx.lineTo(e.x - 8, 76); ctx.lineTo(e.x + 8, 76); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // ---------- HUD & screens ----------
  let lastHud = { score: -1, stars: -1 };
  function updateHUD() {
    if (state !== 'play' && state !== 'dying') return;
    const sc = score();
    if (sc !== lastHud.score) { ui.score.textContent = sc; lastHud.score = sc; }
    if (runStars !== lastHud.stars) { ui.stars.textContent = runStars; lastHud.stars = runStars; }
    const p = player;
    if (p.rocket > 0) {
      ui.power.classList.add('show');
      ui.powerLabel.textContent = 'ROCKET';
      ui.powerFill.style.transform = `scaleX(${p.rocket / 150})`;
    } else if (p.magnet > 0) {
      ui.power.classList.add('show');
      ui.powerLabel.textContent = 'MAGNET';
      ui.powerFill.style.transform = `scaleX(${p.magnet / 600})`;
    } else ui.power.classList.remove('show');
    ui.shield.classList.toggle('show', !!p.shield);
  }

  function bumpScore() {
    ui.score.classList.remove('bump');
    void ui.score.offsetWidth; // restart animation
    ui.score.classList.add('bump');
  }

  let toastTimer = 0;
  let lastRun = { score: 0, zone: ZONES[0].name };
  function toast(small, big) {
    ui.toastSmall.textContent = small;
    ui.toastBig.textContent = big;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2200);
  }

  function showScreen(el) {
    [ui.menu, ui.pause, ui.over].forEach((s) => s.classList.toggle('show', s === el));
  }

  function renderSkins() {
    ui.skins.innerHTML = '';
    ui.wallet.textContent = save.wallet;
    ui.menuBest.textContent = save.best;
    for (const s of SKINS) {
      const owned = save.owned.includes(s.id);
      const b = document.createElement('button');
      b.className = 'skin' + (save.skin === s.id ? ' selected' : '') + (owned ? '' : ' locked') + (!owned && save.wallet >= s.price ? ' affordable' : '');
      b.style.setProperty('--b', s.body);
      b.style.setProperty('--s', s.shade);
      b.style.setProperty('--g', s.glow);
      b.setAttribute('aria-label', owned ? `Select ${s.name}` : `Unlock ${s.name} for ${s.price} stardust`);
      b.innerHTML = `<span class="blob"></span><span class="name">${s.name}</span>` +
        (owned ? '' : `<span class="price"><i class="star-ico"></i>${s.price}</span>`);
      b.addEventListener('click', () => {
        Sfx.init();
        if (owned) {
          save.skin = s.id;
          store.set('skin', s.id);
          Sfx.click();
        } else if (save.wallet >= s.price) {
          save.wallet -= s.price;
          save.owned.push(s.id);
          save.skin = s.id;
          store.set('wallet', save.wallet);
          store.set('owned', save.owned);
          store.set('skin', s.id);
          Sfx.unlock();
          vibrate(30);
          toast('UNLOCKED', s.name + '!');
        } else {
          Sfx.deny();
          b.classList.add('shake');
          setTimeout(() => b.classList.remove('shake'), 400);
          toast('NEED ' + (s.price - save.wallet) + ' MORE', 'Collect stardust ★');
          return;
        }
        renderSkins();
      });
      ui.skins.appendChild(b);
    }
  }

  function renderMenuOptions() {
    ui.muteLabel.textContent = save.muted ? 'Off' : 'On';
    ui.hapticsLabel.textContent = save.haptics ? 'On' : 'Off';
    ui.controlLabel.textContent = save.control === 'tilt' ? 'Tilt' : 'Touch';
    ui.how.textContent = isTouch
      ? save.control === 'tilt'
        ? 'Tilt your phone to steer. Land on top of Spikers to stomp them.'
        : 'Hold the left or right side of the screen to steer. Land on top of Spikers to stomp them.'
      : 'Move with A / D or ← →. Space to start, P to pause, M to mute.';
  }

  // ---------- flow ----------
  function start() {
    Sfx.init();
    Sfx.click();
    if (save.control === 'tilt') enableTilt();
    state = 'play';
    resetWorld();
    player.vy = JUMP;
    lastHud = { score: -1, stars: -1 };
    ui.best.textContent = save.best;
    ui.hud.classList.add('show');
    ui.ribbon.classList.remove('show');
    showScreen(null);
    if (isTouch && save.control === 'touch') {
      ui.touchHint.classList.add('show');
      setTimeout(() => ui.touchHint.classList.remove('show'), 2600);
    }
    toast('ZONE 1', ZONES[0].name);
  }

  function pauseGame() {
    if (state !== 'play') return;
    state = 'paused';
    Sfx.rocketStop();
    pointers.clear();
    showScreen(ui.pause);
  }

  function resume() {
    if (state !== 'paused') return;
    Sfx.init();
    state = 'play';
    acc = 0;
    last = performance.now();
    if (player.rocket > 0) Sfx.rocketStart();
    showScreen(null);
  }

  function togglePause() {
    if (state === 'play') pauseGame();
    else if (state === 'paused') resume();
  }

  function goMenu() {
    Sfx.rocketStop();
    state = 'menu';
    resetWorld();
    ui.hud.classList.remove('show');
    ui.touchHint.classList.remove('show');
    renderSkins();
    renderMenuOptions();
    showScreen(ui.menu);
  }

  function toggleMute() {
    save.muted = !save.muted;
    store.set('muted', save.muted);
    Sfx.setMuted(save.muted);
    if (!save.muted) { Sfx.init(); Sfx.click(); }
    renderMenuOptions();
  }

  function die(cause) {
    if (state !== 'play') return;
    state = 'dying';
    deathCause = cause;
    dyingT = 0;
    Sfx.rocketStop();
    pointers.clear();
    const p = player;
    p.rocket = 0;
    if (cause === 'enemy') {
      p.dead = true;
      p.vy = -9;
      shake = 14;
      Sfx.hit();
      vibrate([30, 40, 70]);
      sparkle(p.x, p.y, 16, ['#ffffff', '#ff5fa2', '#ffc04d']);
    } else {
      Sfx.fall();
      vibrate(60);
    }
  }

  function gameOver() {
    state = 'over';
    const sc = score();
    const isBest = sc > save.best;
    if (isBest) { save.best = sc; store.set('best', sc); }
    if (alt > save.bestAlt) { save.bestAlt = Math.round(alt); store.set('bestAlt', save.bestAlt); }
    lastRun = { score: sc, zone: ZONES[zoneIndex(alt)].name };
    save.wallet += runStars;
    store.set('wallet', save.wallet);
    Sfx.over();

    ui.hud.classList.remove('show');
    ui.overCause.textContent = deathCause === 'enemy' ? 'Spiked by a Spiker!' : 'You fell into the clouds!';
    ui.overBest.textContent = save.best;
    ui.overStars.textContent = '+' + runStars;
    ui.overZone.textContent = ZONES[zoneIndex(alt)].name;
    ui.ribbon.classList.toggle('show', isBest && sc > 0);
    showScreen(ui.over);
    countUp(ui.overScore, sc, 900);
    if (isBest && sc > 0) {
      setTimeout(() => { if (state === 'over') { confetti(W / 2, camY + H * 0.35, 90); Sfx.best(); } }, 450);
    }
    loadBoard();
  }

  function countUp(el, to, ms) {
    const t0 = performance.now();
    const stepFn = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }

  // ---------- optional online leaderboard (served by sarver.js) ----------
  const hasServer = location.protocol.startsWith('http');
  async function loadBoard() {
    if (!hasServer) return;
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 2500);
      const res = await fetch('api/leaderboard', { signal: ctl.signal });
      clearTimeout(to);
      if (!res.ok) throw new Error('no board');
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('bad board');
      ui.boardList.innerHTML = '';
      rows.slice(0, 5).forEach((r) => {
        const li = document.createElement('li');
        li.textContent = String(r.name || '???').slice(0, 16);
        const sp = document.createElement('span');
        sp.textContent = r.score;
        li.appendChild(sp);
        ui.boardList.appendChild(li);
      });
      ui.boardName.value = save.name;
      ui.boardForm.querySelector('button').disabled = false;
      ui.board.hidden = false;
    } catch (e) {
      ui.board.hidden = true;
    }
  }

  ui.boardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = ui.boardName.value.trim().slice(0, 16);
    if (!name) return;
    save.name = name;
    store.set('name', name);
    const btn = ui.boardForm.querySelector('button');
    btn.disabled = true;
    try {
      await fetch('api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: score(), character: save.skin }),
      });
      toast('SUBMITTED', 'Score saved!');
      loadBoard();
      btn.disabled = true;
    } catch (err) {
      btn.disabled = false;
    }
  });

  // ---------- buttons ----------
  $('#btnPlay').addEventListener('click', start);
  $('#btnAgain').addEventListener('click', start);
  $('#btnPause').addEventListener('click', pauseGame);
  $('#btnResume').addEventListener('click', resume);
  $('#btnRestart').addEventListener('click', start);
  $('#btnHome1').addEventListener('click', () => { Sfx.click(); goMenu(); });
  $('#btnHome2').addEventListener('click', () => { Sfx.click(); goMenu(); });
  $('#btnMute').addEventListener('click', toggleMute);
  if (isTouch && navigator.vibrate) {
    ui.btnHaptics.hidden = false;
    ui.btnHaptics.addEventListener('click', () => {
      save.haptics = !save.haptics;
      store.set('haptics', save.haptics);
      Sfx.click();
      vibrate(20);
      renderMenuOptions();
    });
  }
  ui.btnShare.addEventListener('click', async () => {
    Sfx.click();
    const url = location.protocol.startsWith('http') ? location.href.split('#')[0] : 'https://nova-hop.vercel.app/';
    const text = `I scored ${lastRun.score} in Nova Hop and reached ${lastRun.zone}! Can you beat me?`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Nova Hop', text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast('COPIED', 'Challenge link copied!');
    } catch (e) { /* share cancelled */ }
  });
  if (isTouch) {
    ui.btnControl.hidden = false;
    ui.btnControl.addEventListener('click', async () => {
      Sfx.init();
      if (save.control === 'touch') {
        if (await enableTilt()) save.control = 'tilt';
        else toast('TILT', 'Not available here');
      } else save.control = 'touch';
      store.set('control', save.control);
      Sfx.click();
      renderMenuOptions();
    });
  }

  // ---------- main loop ----------
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = now - last;
    last = now;
    if (dt > 100) dt = 100;
    if (state !== 'paused') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { update(); acc -= STEP; n++; }
      if (n === 6) acc = 0;
    }
    draw();
    updateHUD();
  }

  // ---------- boot ----------
  Sfx.setMuted(save.muted);
  resetWorld();
  resize();
  resetWorld();
  renderSkins();
  renderMenuOptions();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
