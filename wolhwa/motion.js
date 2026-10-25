// 모션: 분위기(떠다니는 금빛 먼지·별 반짝임), 카드 섞기·펼치기, 뽑기 반짝임, 웹툰 칸 등장.
// 움직임 줄이기 설정이면 모두 건너뛴다. 외부 라이브러리 없이 Web Animations API와 캔버스만 쓴다.
const MOTION = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

// ── 분위기: 무대 뒤 캔버스에 금빛 먼지와 반짝이는 별 ──
(function ambient() {
  if (!MOTION) return;
  const cv = document.createElement('canvas'); cv.className = 'fx'; $('#frame').prepend(cv);
  const ctx = cv.getContext('2d'); const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 360, H = 640, motes = [], stars = [];
  function size() {
    W = 360; H = $('#frame').offsetHeight || 640; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    motes = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 1.6, vy: -(.08 + Math.random() * .22), vx: (Math.random() - .5) * .12, p: Math.random() * 6 }));
    stars = Array.from({ length: 18 }, () => ({ x: Math.random() * W, y: Math.random() * H * .32, r: .5 + Math.random() * 1.1, p: Math.random() * 6, s: .6 + Math.random() * 1.4 }));
  }
  size(); addEventListener('resize', size);
  let last = 0;
  function tick(t) {
    requestAnimationFrame(tick);
    if (document.hidden) { last = t; return; }
    const k = last ? Math.min(3, (t - last) / 33.3) : 1; last = t;   // 매 프레임(60fps) 그리고, 움직임은 지난 시간만큼(예전 30fps 기준 속도 유지)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const s of stars) { const a = .25 + .55 * (.5 + .5 * Math.sin(t / 1000 * s.s + s.p)); ctx.fillStyle = `rgba(255,244,220,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
    for (const m of motes) {
      m.y += m.vy * k; m.x += (m.vx + Math.sin(t / 1600 + m.p) * .08) * k; if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
      const a = .18 + .3 * (.5 + .5 * Math.sin(t / 700 + m.p));
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3); g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3, 0, 7); ctx.fill();
    }
  }
  requestAnimationFrame(tick);
})();

// ── 화면 전환: 브라우저의 장면 전환(View Transition)으로 앞뒤 화면을 부드럽게 겹친다. 지원 안 하면 바로 바꾼다 ──
function sceneChange(fn) {
  if (!MOTION || !document.startViewTransition) { fn(); return Promise.resolve(); }
  return document.startViewTransition(fn).finished.catch(() => {});
}

// ── 반짝이 터짐: 무대 좌표 (x, y) 둘레로 작은 별이 퍼진다 ──
function sparkle(x, y, n = 10) {
  if (!MOTION) return;
  const f = $('#frame');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'spark'; s.style.left = x + 'px'; s.style.top = y + 'px'; f.append(s);
    const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 30;
    s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
      { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => s.remove();
  }
}
// 요소의 무대 안 중심 좌표 (무대가 확대·축소돼 있으므로 배율을 나눈다)
function stagePoint(el) {
  const fr = $('#frame').getBoundingClientRect(), r = el.getBoundingClientRect(), k = fr.width / 360;
  return { x: (r.left + r.width / 2 - fr.left) / k, y: (r.top + r.height / 2 - fr.top) / k };
}

// ── 카드 섞기: 탁자 가운데에서 더미를 두 번 갈라 섞는다 ──
async function shuffleMotion() {
  if (!MOTION) return;
  sfx('shuffle');
  const box = $('#cards'); const stack = []; const g = typeof fanGeom === 'function' ? fanGeom() : { W: 50, H: 84, cx: 155, top: 30 };
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('div'); c.className = 'card back shuf';
    Object.assign(c.style, { width: g.W + 'px', height: g.H + 'px', left: g.cx + 'px', top: (g.top + g.H * .3 - i * .6) + 'px' }); box.append(c); stack.push(c);
  }
  for (let round = 0; round < 2; round++) {
    await Promise.all(stack.map((c, i) => c.animate([
      { transform: 'translate(0,0) rotate(0)' },
      { transform: `translate(${i % 2 ? 46 : -46}px, ${-6 - (i % 4) * 2}px) rotate(${i % 2 ? 8 : -8}deg)`, offset: .45 },
      { transform: `translate(0, ${-i * .6}px) rotate(${(i % 3 - 1) * 2}deg)` }
    ], { duration: 520, delay: i * 26, easing: 'ease-in-out', fill: 'forwards' }).finished));
  }
  const tb = stagePoint(box.firstElementChild || box); sparkle(180, tb.y, 12);
  await new Promise(r => setTimeout(r, 160));
  stack.forEach(c => c.remove());
}

// ── 카드 펼치기: 가운데에서 제자리로 한 장씩 날아간다. 'only'를 주면 그 자리 카드만 ──
function dealMotion(only) {
  if (!MOTION) return Promise.resolve();
  const cards = [...$('#cards').querySelectorAll('.card')].filter(c => !only || only.includes(+c.dataset.i));
  if (cards.length) sfx('deal');
  const ox = +$('#cards').dataset.ox || 155, oy = +$('#cards').dataset.oy || 30;
  return Promise.all(cards.map((c, k) => {
    const left = parseFloat(c.style.left), top = parseFloat(c.style.top);
    return c.animate([
      { transform: `translate(${ox - left}px, ${oy - top}px) rotate(0deg) scale(.9)`, opacity: 0 },
      { opacity: 1, offset: .2 },
      { transform: 'translate(0,0) scale(1)', opacity: 1 }
    ], { duration: 460, delay: only ? 0 : k * 38, easing: EASE, fill: 'backwards' }).finished;
  }));
}

// ── 뽑은 카드들이 떠올라 사라짐 (웹툰으로 넘어가기 전) ──
function liftPicked() {
  if (!MOTION) return Promise.resolve();
  const picked = [...$('#cards').querySelectorAll('.card.picked')];
  picked.forEach(c => { const p = stagePoint(c); sparkle(p.x, p.y, 8); });
  return Promise.all(picked.map((c, i) => c.animate([
    { transform: 'translateY(-14px) scale(1)', opacity: 1, filter: 'brightness(1)' },
    { transform: `translate(${(180 - parseFloat(c.style.left) - parseFloat(c.style.width) / 2) * .6}px, -150px) scale(1.5)`, opacity: 0, filter: 'brightness(1.8)' }
  ], { duration: 620, delay: i * 90, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).finished));
}

// ── 웹툰 칸: 화면에 들어올 때 떠오른다 ──
let wtObserver = null;
function revealPanels(root) {
  if (!MOTION || !('IntersectionObserver' in window)) { root.querySelectorAll('.wt-panel').forEach(p => p.classList.add('in')); return; }
  wtObserver ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); wtObserver.unobserve(e.target); } }), { root: $('#webtoon'), threshold: .12 });
  root.querySelectorAll('.wt-panel:not(.in)').forEach(p => wtObserver.observe(p));
}
