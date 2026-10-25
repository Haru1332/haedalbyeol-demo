// 풀이 예시 보기(2026-10-25 haru 「음악은 … 메인에 딸린 건 다 공유하면 되는 거 아니야?」): 따로 된 페이지(sample/)였을 땐
// 넘어갈 때마다 음악이 끊겼다 다시 올라와서, 메인 안에서 화면만 바꾼다. 주소는 ?sample=<가게>-<사람>, 뒤로 가기로 메인에 돌아온다.
// 글은 sample/data/<id>.json(가게가 보낸 실제 AI 결과, 고치지 않음), 캡처는 sample/img/. json 모양은 docs/보낼 지시/의 '남길 것'과 같다
// 세 자매 프로필(?about=<사람>, 2026-10-25)도 여기서 연다: 메인 안 화면이 둘이라 어느 화면이 열렸는지는 이 파일 하나가 정한다(둘이 같이 열리지 않게). 그리기는 profiles.js
const SampleView = (() => {
const $ = (x) => document.getElementById(x);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const marked = (s) => esc(s).replace(/==([^=\n]{1,200})==/g, '<mark>$1</mark>').replace(/\*\*([^*\n]{1,200})\*\*/g, '<b>$1</b>');
const paras = (s) => String(s).split(/\n{2,}/).map((x) => `<p>${marked(x).replace(/\n/g, '<br>')}</p>`).join('');
const VIEWS = { sample: $('sample-view'), about: $('about-view') }, home = $('top'), TITLE = document.title;
let ticket = 0, stopPhone = () => {}, homeY = 0;
// 주소: ?sample=<id> 또는 ?about=<사람> 하나만. kind 없이 부르면 둘 다 뺀 메인 주소
const urlWith = (id, kind = 'sample') => { const u = new URL(location.href); u.hash = ''; Object.keys(VIEWS).forEach((k) => u.searchParams.delete(k)); if (id) u.searchParams.set(kind, id); return u.pathname + u.search; };

function render(id) {
  const S = SAMPLES.find((s) => s.id === id && s.ready);
  if (!S) return false;
  const SHOP = SAMPLE_SHOPS[S.shop], WHO = PEOPLE[S.who], my = ++ticket;
  document.title = `${sampleTitle(S)} · 풀이 예시 · 해·달·별`;
  $('s-shop').textContent = `${SHOP.sym}의 가게 · ${SHOP.name}`;
  $('s-title').textContent = sampleTitle(S);
  $('s-story').textContent = SHOP.story;
  $('s-who').innerHTML = `
    <div class="who-head"><img class="face" src="${WHO.face}" alt="${WHO.name}"><div class="name">${WHO.name}<small>${WHO.role}</small></div></div>
    ${SHOP.usesBirth ? `<div class="facts">${WHO.born} · ${WHO.place}에서 태어남</div>` : ''}
    <div class="facts" id="s-topic"></div>
    <blockquote>${esc(WHO.concern)}</blockquote>`;
  $('s-go').href = `?from=${S.shop}`; $('s-go').dataset.goshop = S.shop;
  $('s-go-ic').textContent = { saju: '☀', tarot: '☾', astro: '✦' }[S.shop];
  $('s-go-label').textContent = `나도 ${SHOP.reader}에게 물어보기`;
  $('s-more').innerHTML = SAMPLES.filter((s) => s.ready && s.id !== S.id).map((s) => `<a href="${urlWith(s.id)}" data-sample="${s.id}">${sampleTitle(s)}</a>`).join('');
  $('s-flow-sec').hidden = true; stopPhone();
  $('s-parts').innerHTML = '<p class="sub">풀이를 불러오는 중이에요.</p>';
  fill(S, my);
  return true;
}

// 한 조각 그리기: 아는 칸(질문·카드·결론·핵심·본문)은 글로, 보고서처럼 [{title, body}] 묶음이면 소제목과 글로
const KNOWN = ['q', 'question', 'title', 'cards', 'headline', 'keypoint', 'body', 'text', 'answer', 'summary'];
function piece(v) {
  if (v == null) return '';
  if (typeof v === 'string') return paras(v);
  if (Array.isArray(v)) return v.map(piece).join('');
  if (typeof v !== 'object') return paras(String(v));
  // 보고서 표의 한 줄: {label, value}·{when, what}
  if (v.label != null && v.value != null) return `<p><b>${marked(v.label)}</b> · ${marked(v.value)}</p>`;
  if (v.when != null && v.what != null) return `<p><b>${marked(v.when)}</b> · ${marked(v.what)}</p>`;
  let h = '';
  if (Array.isArray(v.cards) && v.cards.length) h += `<p class="cards">뽑은 카드 · ${esc(v.cards.map((c) => typeof c === 'string' ? c : `${c.name || ''}${c.rev ? '(역방향)' : ''}`).join(', '))}</p>`;
  if (v.title && !v.q) h += `<h3 class="rt">${marked(v.title)}</h3>`;   // 보고서 소제목
  if (v.headline) h += `<p class="head">${marked(v.headline)}</p>`;
  if (v.keypoint) h += `<p><mark>${marked(v.keypoint)}</mark></p>`;
  const main = v.body || v.answer || v.summary || (v.body ? '' : v.text);
  if (main) h += piece(main);
  const rest = Object.entries(v).filter(([k]) => !KNOWN.includes(k));
  // 칸 이름이 영어(가게 코드용 이름)면 이름표 없이 글만
  return h + rest.map(([k, x]) => /[가-힣]/.test(k) ? `<dl><dt>${esc(k)}</dt><dd>${piece(x)}</dd></dl>` : piece(x)).join('');
}
const LABEL = (k) => /^q\d+$/.test(k) ? `질문 ${k.slice(1)}` : ({ concern: '따로 적은 고민', report: '총정리 보고서' }[k] || k);
const ORDER = (k) => /^q\d+$/.test(k) ? Number(k.slice(1)) : k === 'concern' ? 900 : k === 'report' ? 999 : 500;

async function fill(S, my) {
  let d;
  try { const r = await fetch(`sample/data/${S.id}.json`, { cache: 'no-cache' }); if (!r.ok) throw 0; d = await r.json(); }
  catch { $('s-parts').innerHTML = '<p class="sub">이 예시는 아직 준비 중이에요.</p>'; return; }
  if (my !== ticket) return;   // 그사이 다른 예시를 열었음
  if (d.topic) $('s-topic').textContent = `고른 주제 · ${d.topic}`;
  if (Array.isArray(d.shots) && d.shots.length) {
    showPhone(d.shots);
    $('s-flow-sec').hidden = false;
  }
  const keys = Object.keys(d.parts || {}).sort((a, b) => ORDER(a) - ORDER(b));
  $('s-parts').innerHTML = keys.map((k, i) => {
    const v = d.parts[k], q = v && typeof v === 'object' ? (v.q || v.question || '') : '';
    return `<details><summary><span class="n">${esc(LABEL(k))}</span>${q ? `<span class="q">${marked(q)}</span>` : ''}</summary><div class="in">${piece(v)}</div></details>`;
  }).join('') || '<p class="sub">이 예시는 아직 준비 중이에요.</p>';
}

// 흐름 캡처: 폰 틀 하나에 한 장씩. 3.5초마다 저절로 넘기다가 손님이 한 번 만지면 멈춘다. 화면 밖이면 쉬고, 움직임 줄이기 설정이면 저절로 안 넘긴다
function showPhone(shots) {
  stopPhone();
  const box = $('s-flow'), n = shots.length;
  box.innerHTML = `
    <div class="screen">${shots.map((s, i) => `<img src="sample/img/${esc(s.file)}" alt="${esc(s.caption)}"${i ? ' loading="lazy"' : ''}>`).join('')}</div>
    <p class="cap" aria-live="polite"></p>
    <div class="steps">${shots.map((_, i) => `<button type="button" aria-label="${i + 1}번째 화면"><b>${i + 1}</b><span>${esc(shots[i].caption)}</span></button>`).join('')}</div>
    <div class="nav"><button type="button" aria-label="이전 화면">‹</button><span class="count"></span><button type="button" aria-label="다음 화면">›</button></div>`;
  const imgs = box.querySelectorAll('.screen img'), dots = box.querySelectorAll('.steps button');
  let cur = 0, timer = 0, auto = !matchMedia('(prefers-reduced-motion: reduce)').matches, seen = false;
  const go = (i) => {
    cur = (i + n) % n;
    imgs.forEach((im, k) => im.classList.toggle('on', k === cur));
    dots.forEach((b, k) => b.setAttribute('aria-current', k === cur));
    box.querySelector('.cap').innerHTML = `<b>${cur + 1}</b>${esc(shots[cur].caption)}`;
    box.querySelector('.count').textContent = `${cur + 1} / ${n}`;
  };
  const tick = () => { clearInterval(timer); if (auto && seen) timer = setInterval(() => go(cur + 1), 3500); };
  const hand = (i) => { auto = false; clearInterval(timer); go(i); };
  dots.forEach((b, k) => b.addEventListener('click', () => hand(k)));
  const [prev, next] = box.querySelectorAll('.nav button');
  prev.addEventListener('click', () => hand(cur - 1));
  next.addEventListener('click', () => hand(cur + 1));
  let x0 = null;
  const scr = box.querySelector('.screen');
  scr.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  scr.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 40) hand(cur + (e.clientX < x0 ? 1 : -1)); x0 = null; });
  stopPhone = () => { clearInterval(timer); io.disconnect(); };
  const io = new IntersectionObserver(([en]) => { seen = en.isIntersecting; tick(); }, { threshold: 0.5 }); io.observe(scr);
  go(0);
}

// 열기·닫기: 메인(#top)과 다른 화면을 숨기고 그 화면만 보인다. 닫으면 메인에서 보던 자리로
const opened = () => Object.values(VIEWS).some((v) => !v.hidden);
function show(id, kind = 'sample') {
  if (kind === 'sample' ? !render(id) : !renderProfile(id)) return close();
  if (kind !== 'sample') { ticket++; stopPhone(); }
  if (!opened()) homeY = scrollY;
  home.hidden = true;
  Object.entries(VIEWS).forEach(([k, v]) => { v.hidden = k !== kind; });
  scrollTo(0, 0);
}
function close(scroll = true) {
  ticket++; stopPhone();
  if (!opened()) return;
  Object.values(VIEWS).forEach((v) => { v.hidden = true; });
  home.hidden = false; document.title = TITLE;
  if (scroll) scrollTo(0, homeY);
}
// 주소대로 그린다(처음 열 때·뒤로/앞으로 가기)
const sync = () => {
  const q = new URLSearchParams(location.search), kind = Object.keys(VIEWS).find((k) => q.get(k));
  kind ? show(q.get(kind), kind) : close();
};
addEventListener('popstate', sync);
// 예시·프로필로 가는 링크(카드·가게 안내 칸·'다른 예시'·자매 단추)는 페이지를 옮기지 않고 화면만
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-sample], a[data-about]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  const kind = a.dataset.sample ? 'sample' : 'about', id = a.dataset[kind];
  history.pushState(null, '', urlWith(id, kind));
  show(id, kind);
});
// 화면 안의 메인 쪽 링크(#shop·#faq·'다른 예시'·[나도 물어보기]·[가게 들어가기])는 화면을 닫고 그 자리로
Object.values(VIEWS).forEach((view) => view.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"], a[data-goshop]');
  if (!a) return;
  e.preventDefault();
  const shop = a.dataset.goshop;
  history.pushState(null, '', urlWith(null) + (shop ? '' : a.getAttribute('href')));
  close(false);
  if (shop) { document.dispatchEvent(new CustomEvent('wantshop', { detail: shop })); scrollTo(0, 0); }
  else document.querySelector(a.getAttribute('href'))?.scrollIntoView();
}));
// 머리말 메뉴(#shop·#faq)도 다른 화면에서 누르면 메인으로
document.querySelector('header').addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !opened()) return;
  e.preventDefault();
  history.pushState(null, '', urlWith(null) + a.getAttribute('href'));
  close(false);
  document.querySelector(a.getAttribute('href'))?.scrollIntoView();
});
sync();
return { show, close, urlWith };
})();
