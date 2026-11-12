/* Nova Hop — tiny synthesized sound engine (Web Audio, no audio files). */
window.Sfx = (() => {
  'use strict';
  let ac = null;
  let master = null;
  let noiseBuf = null;
  let rocket = null;
  let muted = false;

  function init() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function setMuted(m) {
    muted = m;
    if (m) rocketStop();
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ac.currentTime, 0.02);
  }

  function tone(f, f2, dur, { type = 'sine', vol = 0.25, delay = 0, attack = 0.006 } = {}) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function noise(dur, { vol = 0.2, freq = 1000, f2 = 0, q = 0.8, delay = 0 } = {}) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  function seq(notes, step, opts) {
    notes.forEach((n, i) => tone(n, n, opts.dur || 0.16, { ...opts, delay: (opts.delay || 0) + i * step }));
  }

  function rocketStart() {
    if (!ac || muted || rocket) return;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 650;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + 0.12);
    src.connect(f).connect(g).connect(master);
    src.start();
    rocket = { src, g };
  }

  function rocketStop() {
    if (!rocket) return;
    const { src, g } = rocket;
    rocket = null;
    try {
      g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.06);
      src.stop(ac.currentTime + 0.35);
    } catch (e) { /* already stopped */ }
  }

  return {
    init,
    setMuted,
    rocketStart,
    rocketStop,
    jump() { const b = 320 + Math.random() * 70; tone(b, b * 2.2, 0.15, { type: 'triangle', vol: 0.2 }); },
    spring() { tone(200, 900, 0.32, { vol: 0.3 }); tone(400, 1400, 0.24, { type: 'triangle', vol: 0.1, delay: 0.03 }); },
    coin(n = 1) {
      const f = 900 * Math.pow(1.06, Math.min(n, 10));
      tone(f, f, 0.06, { type: 'square', vol: 0.06 });
      tone(f * 1.5, f * 1.5, 0.14, { type: 'square', vol: 0.06, delay: 0.055 });
    },
    perfect() { tone(660, 1320, 0.14, { vol: 0.14 }); },
    crumble() { noise(0.28, { vol: 0.4, freq: 600, f2: 120, q: 0.6 }); },
    cloud() { noise(0.35, { vol: 0.14, freq: 2600, f2: 700, q: 0.5 }); },
    stomp() {
      tone(200, 60, 0.18, { type: 'square', vol: 0.18 });
      noise(0.1, { vol: 0.25, freq: 900 });
      tone(520, 1200, 0.15, { type: 'triangle', vol: 0.14, delay: 0.07 });
    },
    power() { seq([523, 659, 784, 1047], 0.06, { type: 'triangle', vol: 0.15, dur: 0.14 }); },
    shield() { noise(0.35, { vol: 0.3, freq: 3200, f2: 500, q: 2 }); tone(880, 440, 0.3, { vol: 0.12 }); },
    hit() { tone(420, 70, 0.55, { type: 'sawtooth', vol: 0.2 }); noise(0.2, { vol: 0.3, freq: 400 }); },
    fall() { tone(950, 110, 1.0, { vol: 0.18 }); },
    over() { seq([392, 330, 262, 196], 0.16, { type: 'triangle', vol: 0.16, dur: 0.24, delay: 0.1 }); },
    best() { seq([523, 659, 784, 1047, 1319], 0.07, { type: 'square', vol: 0.06, dur: 0.18 }); },
    zone() { tone(392, 784, 0.5, { vol: 0.14 }); tone(587, 1175, 0.5, { vol: 0.09, delay: 0.1 }); },
    click() { tone(650, 950, 0.05, { vol: 0.1 }); },
    deny() { tone(220, 160, 0.18, { type: 'square', vol: 0.08 }); },
    unlock() { seq([659, 784, 988, 1319], 0.08, { type: 'triangle', vol: 0.14, dur: 0.2 }); },
  };
})();
