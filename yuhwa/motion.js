// 모션(혜화 motion.js 복사, 2026-10-22): 분위기(해 질 녘 하늘에 떠다니는 별빛), 장면 전환, 반짝이, 대사 타자 효과, 웹툰 칸 등장, 표정 겹쳐 바꾸기.
// 월화 타로 motion.js와 같은 방식(외부 라이브러리 없이 Web Animations API·캔버스). 움직임 줄이기 설정이면 건너뛴다.
const MOTION = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

// ── 분위기: 햇살 속을 천천히 떠오르는 금빛 먼지(월화는 밤의 별, 혜화는 낮의 먼지) ──
(function ambient() {
  if (!MOTION) return;
  const cv = document.createElement('canvas'); cv.className = 'fx'; $('#frame').append(cv);
  const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  let W = 360, H = 640, motes = [];
  function size() {
    H = $('#frame').offsetHeight || 640; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    motes = Array.from({length: 30}, () => ({x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 1.7, vy: -(.05 + Math.random() * .16), vx: (Math.random() - .3) * .1, p: Math.random() * 6}));
  }
  size(); addEventListener('resize', size);
  let last = 0;
  function tick(t) {
    requestAnimationFrame(tick);
    if (document.hidden) { last = t; return; }
    const k = last ? Math.min(3, (t - last) / 33.3) : 1; last = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const m of motes) {
      m.y += m.vy * k; m.x += (m.vx + Math.sin(t / 1800 + m.p) * .07) * k;
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; } if (m.x > W + 4) m.x = -4;
      const a = .2 + .35 * (.5 + .5 * Math.sin(t / 800 + m.p));
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
      g.addColorStop(0, `rgba(255,244,200,${a})`); g.addColorStop(1, 'rgba(255,244,200,0)');   // 별빛 레몬
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3, 0, 7); ctx.fill();
    }
  }
  requestAnimationFrame(tick);
})();

// ── 화면 전환: 바로 바꾼다 ──
// 2026-10-11 haru(혜화): "전체화면이 번쩍 했다 사라지는 그거 빼" → 화면 전체를 겹쳐 바꾸는 View Transition을 쓰지 않는다.
// 2026-10-23 유화에서 월화처럼 0.45초 겹치기를 해 봤으나 스텔라가 날아오는 게 안 보이고 네모가 생겨 haru 「아까처럼 되돌리자」
function sceneChange(fn) { fn(); return Promise.resolve(); }

// ── 반짝이 터짐: 무대 좌표 (x, y) 둘레로 작은 햇빛 조각이 퍼진다 ──
function stagePoint(el) {
  const fr = $('#frame').getBoundingClientRect(), r = el.getBoundingClientRect(), k = fr.width / 360;
  return {x: (r.left + r.width / 2 - fr.left) / k, y: (r.top + r.height / 2 - fr.top) / k};
}
function sparkle(x, y, n = 10) {
  if (!MOTION) return;
  const f = $('#frame');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'spark'; s.style.left = x + 'px'; s.style.top = y + 'px'; f.append(s);
    const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 30;
    s.animate([{transform: 'translate(-50%,-50%) scale(1)', opacity: 1}, {transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0}],
      {duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)'}).onfinish = () => s.remove();
  }
}
const sparkleAt = (el, n) => { if (el) { const p = stagePoint(el); sparkle(p.x, p.y, n); } };

// ── 대사 타자 효과: 한 글자씩. 누르면 바로 다 보인다 ──
let typing = null;
function typeLine(el, text) {
  if (typing) { clearInterval(typing.timer); typing.done(); typing = null; }
  if (!MOTION || !text) { el.textContent = text; return Promise.resolve(); }
  // 대사 전체를 처음부터 투명하게 깔아 두고 앞에서부터 보이게만 한다: 줄 끝 단어가 길어지다 다음 줄로 튀는 '울컥거림'이 없다(2026-10-18 haru)
  const shown = document.createTextNode(''), rest = document.createElement('span'); rest.className = 'type-rest'; rest.textContent = text;
  el.replaceChildren(shown, rest); let i = 0;
  return new Promise(done => {
    const timer = setInterval(() => { i += 1; shown.data = text.slice(0, i); rest.textContent = text.slice(i); if (i >= text.length) { clearInterval(timer); el.textContent = text; typing = null; done(); } }, 24);   // 한 글자 24ms(월화와 같게, 전 26)
    typing = {timer, el, text, done};
  });
}
function finishTyping() { if (!typing) return false; clearInterval(typing.timer); typing.el.textContent = typing.text; const d = typing.done; typing = null; d(); return true; }

// ── 선택지: 아래에서 하나씩 떠오른다 ──
function riseIn(els) {
  if (!MOTION) return;
  [...els].forEach((b, i) => b.animate([{transform: 'translateY(10px)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 320, delay: 60 + i * 55, easing: EASE, fill: 'backwards'}));
}

// ── 웹툰·보고서 칸: 화면에 들어올 때 떠오른다 ──
let wtObserver = null;
function revealPanels(root) {
  const sel = '.wt-head,.wt-basis,.wt-panel,.wt-sec,.wt-key,.forecast,.rp-box,.rp-scene,.rp-cover.has,.rp-sign';
  if (!MOTION || !('IntersectionObserver' in window)) { root.querySelectorAll(sel).forEach(p => p.classList.add('in')); return; }
  wtObserver ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); wtObserver.unobserve(e.target); } }), {root: $('#webtoon'), threshold: .1});
  root.querySelectorAll(sel).forEach(p => { if (!p.classList.contains('in')) { p.classList.add('rv'); wtObserver.observe(p); } });
}

// ── 표정 바꾸기: 앞 그림은 그대로 두고 새 그림만 그 위로 서서히 나타난다 ──
// (2026-10-11 haru "화면 전체가 반짝") 두 장을 동시에 흐리고 진하게 하면 중간에 둘 다 반쯤 투명해져 화면이 75%만 덮이고
// 뒤의 밝은 바탕이 비쳤다. 새 그림을 다 받아(decode) 위에 올리고, 다 나타난 뒤에야 아래 그림을 치운다.
let faceLayer = 0, faceGen = 0;
function crossFace(url, instant = false) {   // instant: 겹치기 없이 바로(오프닝 막 뒤에서 미리 바꿀 때)
  const ls = $('#frame').querySelectorAll('.vn-layer');
  if (!ls.length) { $('#frame').style.setProperty('--room', `url(${url})`); return; }
  const gen = ++faceGen, im = new Image(); im.src = url;
  let ready; const shown = new Promise(r => { ready = r; });
  const swap = () => {
    if (gen !== faceGen) return ready();                       // 그사이 다른 표정으로 바뀌었으면 이건 버림
    const next = ls[1 - faceLayer], cur = ls[faceLayer];
    next.style.backgroundImage = `url("${url}")`;
    next.style.zIndex = 1; cur.style.zIndex = 0;       // 새 그림이 위
    if (instant || !MOTION) next.style.transition = 'none';
    next.classList.add('on');                          // 위에서 0→1(아래 그림은 1 그대로라 밝은 바탕이 비치지 않음)
    faceLayer = 1 - faceLayer;
    const done = () => { if (gen === faceGen) { cur.style.transition = 'none'; cur.classList.remove('on'); requestAnimationFrame(() => { cur.style.transition = ''; next.style.transition = ''; }); } };
    if (instant || !MOTION) requestAnimationFrame(() => { done(); ready(); }); else setTimeout(() => { done(); ready(); }, 320);
  };
  im.decode().then(swap, swap);
  return shown;   // 바뀐 뒤(오프닝은 이걸 기다렸다가 막을 걷는다)
}

// ── 효과음(2026-10-25 haru: 버튼 클릭음·보고서 펼치는 소리는 해·달·별 공통 → 월화 것을 복사): tap(모든 버튼 '틱')·seal(총정리 보고서 열 때 책 드르륵 → 탁)·reveal(서명이 써지기 시작할 때 반짝)
// 파일은 sfx-data.js에 담긴 것을 푼다(IDM이 .mp3를 가로채서, tools/embed-sfx.mjs). 브라우저는 첫 터치 전엔 소리를 못 내서 첫 터치 때 켠다. 음소거(소리 버튼)를 따른다
const SFX = (() => {
  const VOL = .55, bufs = {};
  let ctx = null;
  function unlock() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    for (const [k, b64] of Object.entries(window.SFX_DATA || {})) {
      const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      ctx.decodeAudioData(u8.buffer).then(b => { bufs[k] = b; }, () => {});
    }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, unlock, {capture: true, passive: true}));
  function play(name, {vol = 1} = {}) {
    if (window.SOUND_MUTED || !ctx || !bufs[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    const g = ctx.createGain(); g.gain.value = VOL * vol; g.connect(ctx.destination);
    const s = ctx.createBufferSource(); s.buffer = bufs[name]; s.connect(g); s.start();
  }
  // 모든 버튼에 같은 '틱'(월화와 같음). 소리 버튼은 빼고, 대사 넘기는 탭은 버튼이 아니라(#talk) 원래 안 난다
  addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled || b.closest('.sound-btn')) return; play('tap'); }, true);
  return {play};
})();
function sfx(name, opt) { SFX.play(name, opt); }


// ── 배경음악(2026-10-24 haru가 수노로 만든 '유화 오프닝'·'유화 시작', 혜화 BGM 방식): [들어가기]부터 오프닝 곡, 첫 인사 뒤 화면이 어두워질 때 서서히 멀어진다.
// 브라우저는 손님이 누르기 전엔 소리를 못 내서 [들어가기] 누르는 순간(같은 클릭 안에서) 시작. 암전이 끝나 방이 밝아질 때 대화 곡('유화 시작', 2026-10-24)이 바로 들어온다(혜화처럼 겹치지 않게).
// 별 잇기에서 스텔라가 첫 별에 내려앉으면 대화 곡이 서서히 멀어지고 풀이 곡('유화 풀이')이 시작된다(2026-10-24 haru).
// 총정리 보고서를 열면 보고서 곡('유화 보고서', 2026-10-25 haru)으로 바뀐다(앞 곡을 서서히 줄인 뒤).
// 풀이는 읽는 데 오래 걸려 한 곡만 돌면 지루하다 → 풀이 곡들을 차례로 돌린다(풀이 → 풀이2 → 풀이 …, 2026-10-24 haru). 한 곡이 끝나면 다음 곡이 바로 이어진다.
// 월화에서 고친 것 미리: 서버가 구간 받기(Range)를 해 줘야 폰에서 반복할 때 처음부터 다시 돌지 않는다(server.mjs), 같은 곡을 받는 중에 또 틀지 않는다(play의 now 확인),
// 끌 때 데시벨 곡선(툭 끊기지 않게), 탭을 가리면 멈추고 돌아오면 이어서, 음소거는 기억하지 않음
const BGM = (() => {
  // 곡은 .mp3를 직접 요청하지 않는다: IDM 같은 다운로드 관리자가 가로채 '내려받을까요' 창을 띄운다(2026-10-24 haru).
  // assets/bgm/<이름>.js(tools/embed-bgm.mjs가 mp3를 담음)를 <script>로 받아 Blob 주소로 튼다 — 월화 효과음(sfx-data.js)과 같은 방법
  const VOL = .35, SRC = {opening: 'assets/bgm/opening.js', talk: 'assets/bgm/talk.js', reading: 'assets/bgm/reading.js', reading2: 'assets/bgm/reading2.js', report: 'assets/bgm/report.js'}, els = {}, loading = {};
  const NEXT = {reading: 'reading2', reading2: 'reading'}, group = k => NEXT[k] ? 'reading' : k;   // 차례로 도는 곡: 끝나면 다음 곡, 같은 묶음이면 다시 틀지 않음
  let now = null, muted = false;
  const load = k => loading[k] || (loading[k] = new Promise(r => {
    const done = () => { const b = (window.BGM_DATA || {})[k]; if (!b) return r(null);
      const bin = atob(b), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      delete window.BGM_DATA[k]; const a = Object.assign(new Audio(URL.createObjectURL(new Blob([u8], {type: 'audio/mpeg'}))), {preload: 'auto', loop: !NEXT[k], volume: 0});
      if (NEXT[k]) a.addEventListener('ended', () => { if (now === k) { now = null; play(NEXT[k]); } });
      r(a); };
    const sc = document.createElement('script'); sc.src = SRC[k]; sc.onload = done; sc.onerror = () => r(null); document.head.append(sc);
  }).then(a => (els[k] = a)));
  load('opening'); setTimeout(() => load('talk'), 1500); setTimeout(() => load('reading'), 6000); setTimeout(() => load('reading2'), 12000); setTimeout(() => load('report'), 20000);   // 첫 화면에서 미리 받기(폰은 받는 데 몇 초 걸려 [들어가기] 뒤 늦게 나왔다 — 월화 2026-10-23)
  const el = k => els[k];
  // 끌 때는 처음엔 천천히, 끝으로 갈수록 빨리(뚝 끊기지 않게)
  const fade = (a, to, ms) => new Promise(r => {
    const id = a._f = (a._f || 0) + 1, from = a.volume, t0 = performance.now();
    const step = t => { if (a._f !== id) return r(); const k = ms > 0 ? Math.min(1, (t - t0) / ms) : 1;
      a.volume = to < from ? (k < 1 ? from * Math.pow(10, -2.5 * k * k) : to) : from + (to - from) * k * k;
      if (k < 1) requestAnimationFrame(step); else r(); };
    requestAnimationFrame(step);
  });
  async function out(ms = 1200) { const a = now && els[now]; now = null; if (!a) return; await fade(a, 0, ms); if (!now || els[now] !== a) a.pause(); }
  // fadeMs: 앞 곡을 이만큼 서서히 줄여 멈춘 뒤 새 곡을 바로 시작(겹치지 않게 — 월화·혜화와 같음). 0이면 바로 바꿈
  async function play(name, fadeMs = 0) {
    if (!SRC[name] || (now && group(now) === group(name))) return;
    if (now && fadeMs > 0) { const was = now; await out(fadeMs); if (now !== null && now !== was) return; } else if (now) out(0);
    now = name;
    const go = a => { if (!a || now !== name) return; a._f = (a._f || 0) + 1; a.currentTime = 0;
      if (muted) { a.volume = 0; return; } a.volume = VOL; a.play().catch(() => {}); };
    // 곡이 아직 안 왔으면 오는 대로(손님이 이미 한 번 눌렀으니 브라우저가 소리를 허락한다)
    if (els[name]) go(els[name]); else load(name).then(go);
  }
  document.addEventListener('visibilitychange', () => { const a = now && els[now]; if (!a || muted) return; if (document.hidden) a.pause(); else a.play().catch(() => {}); });
  async function setMuted(m) {
    muted = m; const a = now && els[now]; if (!a) return;
    if (m) { await fade(a, 0, 300); if (muted) a.pause(); } else { try { await a.play(); } catch { return; } fade(a, VOL, 600); }
  }
  return {play, out, setMuted, get now() { return now; }};
})();
