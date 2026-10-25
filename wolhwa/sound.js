// 소리: 배경음악(장면마다 바뀜)과 효과음. 파일이 있으면 파일을, 없으면 효과음은 코드로 만든 임시 소리를 낸다(배경음악은 조용).
// 파일 자리: assets/bgm/<장면>.mp3 (intro·salon·reading·report, 없으면 main.mp3), assets/sfx/<이름>.mp3 — 목록은 docs/소리 목록.md
// 효과음은 assets/sfx에 넣은 뒤 node tools/embed-sfx.mjs로 sfx-data.js에 담는다(앱은 파일을 직접 받지 않음)
// 브라우저는 손님이 화면을 한 번 누르기 전에는 소리를 못 내게 하므로, 첫 터치 때 소리를 켠다. 음소거는 이번에 열어 둔 동안만(새로 열면 소리 켠 상태)
const SOUND = (() => {
  const VOL = { bgm: 0.35, sfx: 0.55 };
  // muted: 음소거는 기억하지 않는다(새로 열면 늘 소리 켠 상태, 2026-10-09 사용자). held: [들어가기] 전에는 음악을 붙잡아 둔다
  let muted = false, ctx = null, master = null, unlocked = false, held = false;
  const buffers = {}, missing = new Set(), lastVar = {};
  let bgmWant = null, bgmNow = null;   // { name, el }

  function unlock() {
    if (unlocked) return; unlocked = true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination); } catch { ctx = null; }
    if (bgmWant && !held) bgm(bgmWant, true);
    new Set([...Object.keys(SYNTH), ...Object.keys(window.SFX_DATA || {})]).forEach(load);   // 담긴 효과음(변형 포함)을 미리 풀어 둔다(처음 한 번도 파일 소리로, 없는 건 임시 소리)
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, unlock, { capture: true, passive: true }));
  // 모든 버튼에 같은 '틱'(대사 넘기는 탭·카드·음소거·점검 버튼은 제외: 카드는 따로 소리, 대사 탭은 너무 잦음)
  addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || b.closest('.sound-btn, .dev-btn, .dev-font, #cards')) return;
    SOUND.sfx('tap');   // 바깥 이름으로 불러야 점검 도구의 기록에도 잡힌다
  }, true);

  // ── 효과음 ──
  // 효과음은 파일을 따로 받지 않고 sfx-data.js에 담긴 것을 푼다(IDM 같은 다운로드 관리자가 .mp3 요청을 가로채서). 없으면 임시 소리
  async function load(name) {
    if (buffers[name] || missing.has(name) || !ctx) return buffers[name];
    const b64 = window.SFX_DATA?.[name];
    if (!b64) { missing.add(name); return; }
    try {
      const bin = atob(b64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      buffers[name] = await ctx.decodeAudioData(bytes.buffer);
    } catch { missing.add(name); }
    return buffers[name];
  }
  function sfx(name, { vol = 1 } = {}) {
    if (muted || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const out = ctx.createGain(); out.gain.value = VOL.sfx * vol; out.connect(master);
    // 같은 이름의 변형(flip-2, flip-3 …)이 담겨 있으면 그중 하나를 무작위로(직전과 다른 것)
    const vars = [name, `${name}-2`, `${name}-3`, `${name}-4`].filter(n => buffers[n]);
    if (vars.length) {
      const pool = vars.length > 1 ? vars.filter(n => n !== lastVar[name]) : vars, pick = pool[Math.floor(Math.random() * pool.length)]; lastVar[name] = pick;
      const s = ctx.createBufferSource(); s.buffer = buffers[pick]; s.connect(out); s.start(); return { stop: () => { try { s.stop(); } catch {} } };   // 멈출 수 있게 손잡이를 돌려준다
    }
    if (!missing.has(name)) load(name);   // 다음부터는 파일로(이번엔 임시 소리)
    (SYNTH[name] || SYNTH.tap)(out);
    return { stop: () => { try { out.disconnect(); } catch {} } };
  }

  // 임시 효과음(파일이 올 때까지): 종이 스침은 걸러 낸 잡음, 반짝임은 맑은 종소리
  const now = () => ctx.currentTime;
  function noise(out, { dur = 0.12, from = 1800, to = 900, q = 0.8, gain = 0.5, at = 0 }) {
    const n = Math.ceil(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, now() + at); f.frequency.exponentialRampToValueAtTime(to, now() + at + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now() + at); g.gain.exponentialRampToValueAtTime(gain, now() + at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, now() + at + dur);
    s.connect(f).connect(g).connect(out); s.start(now() + at); s.stop(now() + at + dur + 0.02);
  }
  function bell(out, { freq = 1320, dur = 0.7, gain = 0.25, at = 0 }) {
    [1, 2.01, 3.03].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
      const g = ctx.createGain(); const v = gain / (i * 1.8 + 1);
      g.gain.setValueAtTime(0.0001, now() + at); g.gain.exponentialRampToValueAtTime(v, now() + at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, now() + at + dur / (i + 1));
      o.connect(g).connect(out); o.start(now() + at); o.stop(now() + at + dur);
    });
  }
  function pad(out, { notes = [220, 277, 330], dur = 1.8, gain = 0.12 }) {
    notes.forEach(fq => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fq;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(gain, now() + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
      o.connect(g).connect(out); o.start(); o.stop(now() + dur + 0.05);
    });
  }
  const SYNTH = {
    tap: out => bell(out, { freq: 1760, dur: 0.12, gain: 0.08 }),                                  // 선택지 누름
    shuffle: out => { for (let i = 0; i < 7; i++) noise(out, { dur: 0.09, from: 2600, to: 1400, gain: 0.35, at: i * 0.13 + Math.random() * 0.03 }); },   // 카드 섞기(촤르륵)
    deal: out => { for (let i = 0; i < 5; i++) noise(out, { dur: 0.08, from: 2200, to: 1100, gain: 0.22, at: i * 0.07 }); },    // 카드 깔기
    pick: out => bell(out, { freq: 1568, dur: 0.6, gain: 0.18 }),                                   // 카드 고름(반짝)
    flip: out => noise(out, { dur: 0.07, from: 3000, to: 1500, q: 1.2, gain: 0.4 }),                // 카드 뒤집기(탁)
    reveal: out => { bell(out, { freq: 1318, dur: 0.9, gain: 0.14 }); bell(out, { freq: 1976, dur: 0.9, gain: 0.1, at: 0.09 }); },   // 앞면 공개
    toTray: out => noise(out, { dur: 0.22, from: 1400, to: 500, gain: 0.25 }),                      // 쟁반으로 날아감(슉)
    spread: out => { for (let i = 0; i < 4; i++) noise(out, { dur: 0.1, from: 1800, to: 900, gain: 0.2, at: i * 0.09 }); },   // 다 펼치기
    page: out => noise(out, { dur: 0.32, from: 900, to: 2400, q: 0.5, gain: 0.18 }),               // 웹툰 넘김(휘릭)
    door: out => { pad(out, { notes: [196, 247, 294, 392], dur: 2.2, gain: 0.08 }); bell(out, { freq: 1175, dur: 1.4, gain: 0.08, at: 0.5 }); },   // 문이 열리고 빛
    doorClose: out => {                                                                              // 문 닫힘: 낮은 쿵 + 걸쇠 딸깍
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, now()); o.frequency.exponentialRampToValueAtTime(48, now() + 0.25);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.7, now() + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.35);
      o.connect(g).connect(out); o.start(); o.stop(now() + 0.4);
      noise(out, { dur: 0.18, from: 400, to: 120, q: 0.7, gain: 0.5 });
      noise(out, { dur: 0.04, from: 3200, to: 2400, q: 2, gain: 0.35, at: 0.16 }); noise(out, { dur: 0.03, from: 2600, to: 2000, q: 2, gain: 0.25, at: 0.21 });
    },
    seal: out => { bell(out, { freq: 784, dur: 1.2, gain: 0.16 }); bell(out, { freq: 1175, dur: 1.2, gain: 0.1, at: 0.12 }); }   // 보고서 봉인
  };

  // ── 배경음악: 장면이 바뀌면 1.2초 겹쳐 바꾼다. 장면 파일이 없으면 main.mp3, 그것도 없으면 조용 ──
  const fade = (el, to, ms, done) => {
    const id = el._fade = (el._fade || 0) + 1;   // 같은 곡에 새 페이드가 걸리면 앞의 것은 멈춘다(서로 다투지 않게)
    if (ms <= 0) { el.volume = to; done?.(); return; }
    const from = el.volume, t0 = performance.now();
    // 끌 때(to=0): 처음엔 천천히, 끝으로 갈수록 빨리 줄어드는 곡선(데시벨로 -50dB × k², 마지막에 0).
    // 일정한 비율로 줄이면 끝에 툭 끊기고, 데시벨로 고르게 줄이면 시작부터 확 줄어든다(2026-10-09 사용자)
    const step = t => { if (el._fade !== id) return; const k = Math.min(1, (t - t0) / ms);
      el.volume = to === 0 && from > 0 ? (k < 1 ? from * Math.pow(10, -2.5 * k * k) : 0)
        : to > 0 && from > 0 ? from * Math.pow(to / from, k)          // 작게 줄이기(duck)·키우기: 데시벨로 고르게
        : from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step); else done?.(); };
    requestAnimationFrame(step);
  };
  // 반복: 0이면 그냥 처음으로 돌아간다(2026-10-09 사용자: 곡 끝이 자연스러워 그냥 반복). 숫자(초)를 넣으면 끝나기 그만큼 전에 처음을 겹쳐 잇는다
  const OVERLAP = 0;
  function play(name, src, fadeMs) {
    const el = new Audio(src); el.volume = 0; el.preload = 'auto'; el.loop = !OVERLAP;
    const track = { name, el, src, next: false };
    el.ontimeupdate = () => {
      if (!OVERLAP || track.next || bgmNow !== track || !el.duration || el.duration - el.currentTime > OVERLAP) return;
      track.next = true; const t = play(name, src, 1500);
      t.ready.then(ok => { if (!ok) return; bgmNow = t; setTimeout(() => el.pause(), OVERLAP * 1000 + 300); });
    };
    track.ready = el.play().then(() => { if (bgmWant !== track.name) { el.pause(); return false; } fade(el, muted ? 0 : VOL.bgm, fadeMs); return true; }, () => false);
    return track;
  }
  // 장면 + 상담 주제 → 실제 파일. 있는 것 중 앞의 것을 쓴다:
  //   살롱(카드 뽑기): salon-<주제> → <주제>(예: love) → salon → main
  //   그 밖(풀이 reading·보고서 report 등): <장면>-<주제> → <장면>(예: reading = 웹툰 풀이 곡) → <주제> → main
  // 주제: love·work·money·study·today·talk (app.js TOPICS의 id). 같은 파일이면 장면이 바뀌어도 처음부터 다시 틀지 않고 이어 간다
  const srcOf = {};
  let topic = null, fadingOut = null, pending = null;   // pending: 틀었지만 아직 소리가 나기 전인 곡(폰에서는 받는 데 몇 초 걸림)   // fadingOut: stop()으로 꺼지는 중인 곡(새 곡이 시작되면 바로 멈춰 겹치지 않게)
  async function resolve(name) {
    const key = name + '|' + topic;
    if (key in srcOf) return srcOf[key];
    const names = !topic ? [name, 'main'] : name === 'salon' ? [`${name}-${topic}`, topic, name, 'main'] : [`${name}-${topic}`, name, topic, 'main'];
    for (const n of names) {
      try { if ((await fetch(`assets/bgm/${n}.mp3`, { method: 'HEAD' })).ok) return (srcOf[key] = `assets/bgm/${n}.mp3`); } catch {}
    }
    return (srcOf[key] = null);
  }
  // 곡을 서서히 끄고 조용히 둔다(다음 bgm 호출 때 다시 나옴). 다 꺼지면 끝나는 약속(Promise)을 돌려준다
  function stop(fadeMs = 3000) {
    bgmWant = null; const old = bgmNow; bgmNow = null;
    if (!old) return new Promise(r => setTimeout(r, fadeMs));   // 음소거·소리 꺼짐이어도 같은 박자로
    fadingOut = old; return new Promise(r => fade(old.el, 0, fadeMs, () => { old.el.pause(); r(); }));
  }
  // 상담 주제가 정해지면(또는 처음으로 돌아가면) 지금 장면의 곡을 다시 고른다
  function setTopic(t, fadeMs, silent) { if (topic === t) return; topic = t; if (bgmWant && !silent) bgm(bgmWant, true, fadeMs); }
  // 다른 곡으로 바뀔 때는 겹치지 않는다(2026-10-09 사용자: 겹쳐 들리면 이상함): 앞 곡이 fadeMs 동안 작아져 멈춘 뒤 새 곡을 바로 시작
  async function bgm(name, force, fadeMs = 1200, fadeInMs = 0) {
    bgmWant = name;
    if (!unlocked || held || (!force && bgmNow?.name === name)) return;
    const src = name ? await resolve(name) : null;
    if (bgmWant !== name) return;                                   // 기다리는 사이 장면이 또 바뀜
    if (bgmNow && bgmNow.src === src) { bgmNow.name = name; return; }
    // 같은 곡을 받는 중이면 그대로 기다린다. 이걸 안 보면 폰에서 웹툰 페이지를 넘길 때마다 같은 곡을 또 처음부터 틀어 겹치거나 처음으로 돌아갔음(2026-10-23 haru)
    if (pending && pending.src === src) { pending.name = name; return; }
    const old = bgmNow; bgmNow = null;
    const start = () => { if (!src || bgmWant !== name) return; if (fadingOut) { fadingOut.el.pause(); fadingOut = null; } if (pending) pending.el.pause(); const t = pending = play(name, src, fadeInMs); t.ready.then(ok => { if (pending === t) pending = null; if (ok && bgmWant === t.name && !bgmNow) bgmNow = t; else if (bgmNow !== t) t.el.pause(); }); };
    if (old) fade(old.el, 0, fadeMs, () => { old.el.pause(); start(); }); else start();
  }
  document.addEventListener('visibilitychange', () => { if (!bgmNow) return; if (document.hidden) bgmNow.el.pause(); else if (!muted) bgmNow.el.play().catch(() => {}); });

  // ── 음악 신호(cue): 흐름의 정해진 순간마다 곡을 어떻게 바꿀지. 값은 sound-cues.json ──
  // music: keep(그대로) · stop(끄기) · duck(level 비율까지 작게, 계속 재생) · 장면 이름(intro·salon·reading·report) · topic(주제 곡 = 주제가 정해진 살롱)
  // fadeOutMs: 앞 곡이 작아지는 시간, delayMs: 신호 뒤 기다렸다 바꾸는 시간, fadeInMs: 새 곡이 커지는 시간
  let CUES = {};
  const cuesReady = fetch('sound-cues.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(j => { CUES = j || {}; }).catch(() => {});
  const cueListeners = [];
  async function cue(id) {
    await cuesReady;
    const c = CUES[id]; cueListeners.forEach(f => f(id, c));
    if (!c || c.music === 'keep') return;
    const go = () => c.music === 'stop' ? stop(c.fadeOutMs) : c.music === 'duck' ? (bgmNow && fade(bgmNow.el, muted ? 0 : VOL.bgm * (c.level ?? 0.4), c.fadeOutMs)) : bgm(c.music === 'topic' ? 'salon' : c.music, true, c.fadeOutMs, c.fadeInMs);
    if (c.delayMs > 0) return new Promise(r => setTimeout(() => r(go()), c.delayMs)); return go();   // stop이면 다 꺼질 때 끝나는 약속
  }

  // ── 음소거 ──
  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 1;
    if (bgmNow) { if (m) fade(bgmNow.el, 0, 300); else { bgmNow.el.play().catch(() => {}); fade(bgmNow.el, VOL.bgm, 600); } }
    const b = document.getElementById('sound-btn');
    if (b) { b.classList.toggle('off', m); b.setAttribute('aria-label', m ? '소리 켜기' : '소리 끄기'); b.setAttribute('aria-pressed', String(m)); }
  }
  function button() {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'sound-btn'; b.className = 'sound-btn';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path class="w1" d="M15.5 9a4 4 0 0 1 0 6"/><path class="w2" d="M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M15.5 9.5l5 5m0-5l-5 5"/></svg>';
    b.onclick = e => { e.stopPropagation(); unlock(); setMuted(!muted); if (!muted) sfx('tap'); };
    document.getElementById('frame').append(b); setMuted(muted);
  }
  // [들어가기] 화면: hold(true)로 붙잡고, 버튼을 누르면 hold(false) → 그 순간 음악 시작
  function hold(h) { held = h; if (!h) { unlock(); if (bgmWant) bgm(bgmWant, true); } }
  return { sfx, bgm, stop, cue, button, hold, topic: setTopic, onCue: f => cueListeners.push(f), get cues() { return CUES; }, set cues(v) { CUES = v; }, get muted() { return muted; } };
})();
const sfx = (name, o) => SOUND.sfx(name, o);
