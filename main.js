// 해·달·별 메인: 문 셋이 회전목마처럼 돈다. 옆 문을 누르면 그 문이 가운데로, 가운데 문을 누르면 그 가게로 들어간다.

// 가게 주소. 이 PC에서는 각 가게의 실제 AI 서버(?mock=1이면 가짜 답 서버), 배포 뒤에는 한 도메인 아래 길.
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const REAL = !new URLSearchParams(location.search).has('mock');   // 기본은 실제 AI 가게, ?mock=1이면 가짜 답 가게(2026-10-24 haru 「실제로 가게 해야지」)
const SHOPS = {
  saju:  { path: '/saju/',  mock: 8777, real: 8776, ic: '☀', name: '혜화 사주',   line: '태어난 날과 시로 보는 한 해의 흐름. 혜화와 솔라가 햇살 드는 방에서 기다려요.' },
  tarot: { path: '/tarot/', mock: 8767, real: 8766, ic: '☾', name: '월화 타로',   line: '카드는 직접 뽑고, 풀이는 웹툰으로. 마지막엔 총정리 보고서까지.' },
  astro: { path: '/astro/', mock: 8787, real: 8786, ic: '✦', name: '유화 별자리', line: '태어난 날의 하늘로 보는 점성술. 유화와 스텔라가 별 탑에서 별을 하나씩 이어 읽어요.' },
};
// 폰 시험 링크(trycloudflare)로 열렸으면 문은 각 가게가 켜 둔 폰 링크로 간다(서버 /api/shop-links가 가게 기록에서 읽어 줌, 2026-10-24 haru)
const PHONE = /\.trycloudflare\.com$/.test(location.hostname);
let PHONE_LINKS = null;
// 가게의 '해·달·별로' 버튼이 돌아올 곳(2026-10-24 haru): 이 PC·폰 링크에서는 가게 주소에 home=메인 주소를 붙인다.
// 배포 뒤에는 같은 도메인이라 붙이지 않는다(가게는 늘 '/'로). from=가게 → 돌아오면 그 가게 문이 가운데
const homeFor = (key) => `${location.origin}${location.pathname}?from=${key}${REAL ? '' : '&mock=1'}`;
const withHome = (u, key) => { const x = new URL(u); x.searchParams.set('home', homeFor(key)); return x.href; };
const shopUrl = (s) => {
  const key = Object.keys(SHOPS).find((k) => SHOPS[k] === s);
  if (PHONE) { const link = PHONE_LINKS?.[key]?.[REAL ? 'real' : 'mock']; return link ? withHome(link, key) : '#off'; }
  return LOCAL ? withHome(`http://127.0.0.1:${REAL ? s.real : s.mock}/`, key) : s.path;
};

// 포트폴리오 체험판: 문은 이 폴더 안의 체험판 가게로, 혜화 사주는 아직 '준비 중'(위 주소 규칙 대신)
const DEMO_SHOP = { saju: null, tarot: 'wolhwa/', astro: 'yuhwa/' };
const demoUrl = (s) => { const key = Object.keys(SHOPS).find((k) => SHOPS[k] === s); return DEMO_SHOP[key] || '#soon'; };

const ring = document.getElementById('ring');
const doors = [...ring.querySelectorAll('.door')];
const panels = [...document.querySelectorAll('.panel')];
const tagline = document.getElementById('tagline');
const enter = document.getElementById('enter');
const STEP = (2 * Math.PI) / doors.length;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

doors.forEach((d) => { d.href = demoUrl(SHOPS[d.dataset.shop]); });

const FROM = new URLSearchParams(location.search).get('from');
let front = Math.max(0, ['saju', 'tarot', 'astro'].indexOf(FROM)); if (!FROM) front = 1;   // 처음 가운데는 월화(달), 가게에서 돌아오면 그 가게
let angle = -front * STEP;  // 고리 전체의 회전각
let busy = null;

// 각 문의 자리: 고리 위 각도 → 가로 위치·크기·밝기·쌓는 순서. 이동은 translate·scale 개별 속성으로만 준다.
function place() {
  const w = ring.clientWidth;
  const R = Math.min(w * 0.36, 380);
  doors.forEach((d, i) => {
    const t = i * STEP + angle;
    const depth = (Math.cos(t) + 1) / 2;          // 1 = 맨 앞, 0 = 맨 뒤
    const x = Math.sin(t) * R;
    d.style.translate = `${x.toFixed(1)}px ${((1 - depth) * 26).toFixed(1)}px`;
    d.style.scale = (0.6 + 0.4 * depth).toFixed(3);
    d.style.zIndex = String(Math.round(depth * 10));
    d.style.filter = `brightness(${(0.42 + 0.58 * depth).toFixed(2)}) saturate(${(0.55 + 0.45 * depth).toFixed(2)})`;
    // 옆 문 이름표: 넓은 화면에선 보이게, 폰에선 가운데 문과 겹치므로 숨김
    d.querySelector('.plate').style.opacity = (w > 640 ? 0.15 + 0.85 * Math.min(1, depth * 2.6) : depth ** 3).toFixed(2);
  });
  // 화살표는 옆 문 바깥에 한 뼘 띄워서(2026-10-24 haru 「PC에서 화살표가 너무 딱 붙어있어」 — 옆 문 크기를 0.6배로 잡아 실제 0.7배보다 작게 계산했었음).
  // 화면이 좁아 자리가 없으면 화면 안쪽 끝에 둔다
  const sideScale = 0.6 + 0.4 * (Math.cos(STEP) + 1) / 2;
  const half = doors[0].offsetWidth * sideScale / 2;
  const off = Math.min(Math.sin(STEP) * R + half + 28, w / 2 - 44 - 10);
  document.querySelector('.turn.prev').style.left = `calc(50% - ${(off + 44).toFixed(0)}px)`;
  document.querySelector('.turn.next').style.left = `calc(50% + ${off.toFixed(0)}px)`;
}

function settle() {
  doors.forEach((d, i) => {
    const on = i === front;
    d.classList.toggle('front', on);
    d.setAttribute('aria-label', on ? `${SHOPS[d.dataset.shop].name} 들어가기` : `${SHOPS[d.dataset.shop].name}을 가운데로`);
  });
  const key = doors[front].dataset.shop;
  const s = SHOPS[key];
  panels.forEach((p) => p.classList.toggle('on', p.dataset.shop === key));
  tagline.textContent = s.line;
  enter.href = demoUrl(s);
  enter.classList.toggle('soon', enter.getAttribute('href') === '#soon');
  document.getElementById('enter-ic').textContent = s.ic;
  document.getElementById('enter-label').textContent = enter.classList.contains('soon') ? `${s.name} · 준비 중` : `${s.name} 들어가기`;
  document.dispatchEvent(new CustomEvent('shopchange', { detail: key }));   // 아래 풀이 예시 칸이 따라온다
}

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// dir = +1 이면 왼쪽 문이 가운데로(고리가 오른쪽으로 돈다), -1 이면 오른쪽 문이 가운데로.
function turn(dir) {
  if (busy) return;
  front = (front - dir + doors.length) % doors.length;
  const from = angle, to = angle + dir * STEP;
  if (reduced) { angle = to; place(); settle(); return; }
  const t0 = performance.now(), dur = 700;
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    angle = from + (to - from) * ease(p);
    place();
    if (p < 1) busy = requestAnimationFrame(tick);
    else { busy = null; angle = to; }
  };
  settle();
  busy = requestAnimationFrame(tick);
}

function turnTo(i) {
  const n = doors.length;
  const left = (front - 1 + n) % n;
  turn(i === left ? 1 : -1);
}

// 누르기: 가운데 문은 링크 그대로, 옆 문은 돌리기만. 폰 시험에서 그 가게 링크가 꺼져 있으면 알려 준다
let swiped = false;
const offNotice = (e, a) => { if (a.getAttribute('href') === '#soon') { e.preventDefault(); return true; } if (a.getAttribute('href') === '#off') { e.preventDefault(); alert('이 가게의 폰 링크가 꺼져 있어요. PC에서 그 가게의 링크를 켜 주세요(tools/remote.sh on).'); return true; } return false; };
doors.forEach((d, i) => {
  d.addEventListener('click', (e) => {
    if (swiped) { e.preventDefault(); return; }
    if (i !== front) { e.preventDefault(); turnTo(i); return; }
    offNotice(e, d);
  });
});
enter.addEventListener('click', (e) => offNotice(e, enter));

// 가게로 들어갈 때(2026-10-25 haru 「메인에서 각 가게로 들어갈떄도 갑자기 팍! 들어가거든」): 화면이 검게 닫히고 음악이 줄어든 뒤 넘어간다.
// 가게에서 [해·달·별로]로 올 때 검은 화면에서 밝아지는 것(about.css html.arrive)과 짝. 뒤로 가기로 돌아오면(bfcache) 검은 막을 걷는다
const LEAVE_MS = reduced ? 200 : 800;
const black = document.createElement('div'); black.className = 'leave-black'; document.body.append(black);
function leaveTo(e, a) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
  const href = a.href;
  if (!href || a.getAttribute('href') === '#' || a.getAttribute('href') === '#off') return;
  e.preventDefault();
  if (black.classList.contains('on')) return;   // 연타
  black.classList.add('on');
  window.HdbBgm?.fadeOut(LEAVE_MS);
  setTimeout(() => { location.href = href; }, LEAVE_MS + 60);
}
doors.forEach((d, i) => d.addEventListener('click', (e) => { if (i === front && !swiped) leaveTo(e, d); }));
enter.addEventListener('click', (e) => leaveTo(e, enter));
addEventListener('pageshow', (e) => { if (e.persisted) black.classList.remove('on'); });
if (PHONE) {
  fetch('/api/shop-links', { cache: 'no-store' }).then((r) => r.json()).then((links) => {
    PHONE_LINKS = links;
    doors.forEach((d) => { d.href = demoUrl(SHOPS[d.dataset.shop]); });
    settle();
  }).catch(() => {});
}
document.querySelector('.turn.prev').addEventListener('click', () => turn(1));
document.querySelector('.turn.next').addEventListener('click', () => turn(-1));
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, summary') || document.documentElement.classList.contains('curtained')) return;
  if (e.key === 'ArrowLeft') turn(1);
  if (e.key === 'ArrowRight') turn(-1);
});

// 옆으로 밀기(폰). 손가락을 오른쪽으로 밀면 왼쪽 문이 가운데로 온다.
const stage = document.getElementById('stage');
let sx = null, sy = 0;
stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; swiped = false; });
stage.addEventListener('pointerup', (e) => {
  if (sx === null) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  sx = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; turn(dx > 0 ? 1 : -1); }
});
stage.addEventListener('pointercancel', () => { sx = null; });

addEventListener('resize', place);
place();
settle();

// 배경음악·소리 단추는 bgm.js(예시 페이지와 같이 씀)

// 예시 화면의 [나도 ○○에게 물어보기]·프로필의 [○○로 가기]: 메인으로 돌아와 그 가게 문을 가운데로
document.addEventListener('wantshop', (e) => { const i = doors.findIndex((d) => d.dataset.shop === e.detail); if (i >= 0 && i !== front) turnTo(i); });

// 풀이 예시(samples.js): 가게가 결과를 보내 온 것(ready)만 카드로, 가게 안내 칸에는 그 가게 예시로 가는 줄
// 2026-10-25 haru 「세자매가 서로 봐준거 섹션이 가게를 따라가게」: 위에서 가운데 온 가게의 예시만. 칸 안의 해·달·별 단추로도 가게를 돌린다
const readySamples = SAMPLES.filter((s) => s.ready);
if (readySamples.length) {
  const box = document.getElementById('samples'), story = document.getElementById('sample-story'), tabs = document.getElementById('sample-tabs');
  const SHOP_KEYS = doors.map((d) => d.dataset.shop);
  tabs.innerHTML = SHOP_KEYS.map((k, i) => `<button type="button" data-shop="${k}" data-i="${i}"><span class="sym">${SAMPLE_SHOPS[k].sym}</span>${SAMPLE_SHOPS[k].reader}</button>`).join('');
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && +b.dataset.i !== front) turnTo(+b.dataset.i); });
  // 카드 모양(2026-10-24 haru 「B로 하자」): 동그란 프로필 + 받은 사람의 안내 그림을 흐리게 깐 배경
  const card = (s) => {
    const shop = SAMPLE_SHOPS[s.shop], who = PEOPLE[s.who];
    return `<a class="sample-card bg" href="?sample=${s.id}" data-sample="${s.id}" style="--scene:url('${who.scene}')">
      <span class="who-row"><img class="face" src="${who.face}" alt="${who.name}" loading="lazy">
        <span><span class="shop"><span class="sym">${shop.sym}</span>${shop.name}</span><h3>${sampleTitle(s)}</h3></span></span>
      <q>${who.concern}</q>
      <span class="go">풀이 보기 →</span></a>`;
  };
  const show = (key) => {
    const mine = readySamples.filter((s) => s.shop === key), shop = SAMPLE_SHOPS[key];
    story.textContent = shop.story;
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.shop === key));
    box.innerHTML = mine.length ? mine.map(card).join('') : `<p class="sample-wait">${shop.reader}의 풀이 예시는 지금 만드는 중이에요. 곧 올라와요.</p>`;
  };
  document.addEventListener('shopchange', (e) => show(e.detail));
  show(doors[front].dataset.shop);
  document.getElementById('sample').hidden = false;
  panels.forEach((p) => {
    const mine = readySamples.filter((s) => s.shop === p.dataset.shop);
    if (!mine.length) return;
    const a = document.createElement('a');
    a.className = 'to-sample'; a.href = `?sample=${mine[0].id}`; a.dataset.sample = mine[0].id;   // 누르면 sample-view.js가 메인 안에서 연다
    a.textContent = `${SAMPLE_SHOPS[p.dataset.shop].reader}의 풀이 예시 보기 →`;
    p.querySelector('.panel-links').prepend(a);
  });
}

// 카톡·인스타 같은 앱 안 브라우저로 들어온 손님: 결제창·소리·PDF 저장이 기본 브라우저에서 더 안정적이라 처음부터 권한다(2026-10-25 월화 제안, haru 「어떤 링크로 들어가더라도」)
// 카톡은 단추 하나로 기본 브라우저에서 같은 주소를 연다. 나머지 앱은 메뉴 안내만. 닫으면 이 탭에서는 다시 안 띄운다
(() => {
  const ua = navigator.userAgent;
  if (!/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(ua)) return;
  try { if (sessionStorage.getItem('hdb-inapp-closed')) return; } catch {}
  const kakao = /KAKAOTALK/i.test(ua);
  const bar = document.createElement('div');
  bar.className = 'inapp';
  bar.innerHTML = `<p>${kakao ? '카카오톡 안에서 열렸어요.' : '앱 안에서 열렸어요.'} 결제·소리·PDF 저장은 기본 브라우저에서 더 잘 돼요.${kakao ? '' : ' 메뉴(⋯)에서 ‘다른 브라우저로 열기’를 눌러 주세요.'}</p>
    ${kakao ? '<a class="go" href="#">브라우저로 열기</a>' : ''}<button type="button" aria-label="닫기">✕</button>`;
  // 폰 시험 링크에서는 문지기가 기본 브라우저를 모르는 기기로 보므로, 한 번 쓰는 넘겨주기 표를 붙여 넘긴다(site/remote-gate.mjs /__handoff)
  const openOut = (u) => { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(u); };
  if (kakao) bar.querySelector('.go').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!PHONE) return openOut(location.href);
    try { const { t } = await (await fetch('/__handoff', { method: 'POST' })).json(); const u = new URL(location.href); u.searchParams.set('hand', t); openOut(u.href); }
    catch { openOut(location.href); }
  });
  bar.querySelector('button').addEventListener('click', () => { bar.remove(); try { sessionStorage.setItem('hdb-inapp-closed', '1'); } catch {} });
  document.body.append(bar);
})();
