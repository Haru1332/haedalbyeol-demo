// 월화 타로 — 대화 흐름과 무대 조작. 풀이는 ai-reading.js(서버의 AI)
const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const st = { concern: '', situation: null, deck: [], picked: [], three: [], name: '', gender: '' };   // 이름·성별은 이번 리딩에서만 쓰고 저장하지 않는다
// '하루님' 같은 호칭(이름이 없으면 빈 문자열). 문장에 넣을 때는 nim(', ')처럼 뒤에 붙일 말을 준다
const nim = (after = '') => st.name ? `${st.name}님${after}` : '';
// 메인('해·달·별')으로 돌아가는 주소(2026-10-24, 전체 서비스 연결 약속 9절): 메인이 ?home=으로 넘겨준다. 허용된 모양만 이 탭 sessionStorage에 두고 주소창에서 지운다.
// 없으면(메인을 거치지 않고 바로 연 경우) 나가는 문을 숨긴다. 배포 뒤엔 같은 도메인이라 '/'로 바꾼다(임시 규칙)
const HOME_KEY = 'hdb-home';
(() => {
  const q = new URLSearchParams(location.search), h = q.get('home');
  if (h == null) return;
  if (/^http:\/\/(127\.0\.0\.1|localhost):8796\//.test(h) || /^https:\/\/[a-z0-9-]+\.trycloudflare\.com\//.test(h)) { try { sessionStorage.setItem(HOME_KEY, h); } catch {} }
  q.delete('home'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
})();
const homeUrl = () => { try { return sessionStorage.getItem(HOME_KEY) || ''; } catch { return ''; } };
function goHome() { const h = homeUrl(); if (h) location.href = h; }
// 작별 인사 뒤 메인으로([또 올게요]·[해·달·별로]). 화면이 검게 → 문 닫히는 소리·음악이 줄어듦 → 메인(2026-10-25 haru: 「블랙아웃 되면서 문소리 나오고 자연스럽게」)
async function leaveHome() {
  await say(LINES.leave(), { react: 'warm' });
  if (!homeUrl()) return;
  const k = document.createElement('div'); k.className = 'leave-black'; document.body.append(k);
  void k.offsetWidth; k.classList.add('on');
  await new Promise(r => setTimeout(r, 700));                // 다 검어진 뒤
  sfx('doorClose'); SOUND.stop(1800);                        // 문 닫힘(오프닝 끝과 같은 소리) + 음악이 멀어짐
  await new Promise(r => setTimeout(r, 2000));
  goHome();
}
addEventListener('pageshow', e => { if (e.persisted) document.querySelectorAll('.leave-black').forEach(k => k.remove()); });   // 메인에서 뒤로 오면 검은 막을 걷음

// ── 무대 맞추기: 360×640을 화면에 맞춰 키우고 줄인다 ──
// 세로로 긴 휴대폰은 폭에 맞추고 남는 높이는 탁자를 늘려 채운다(위는 위에, 대화창은 아래에 붙어 있음)
let lastW = 0;
function fit() {
  // 휴대폰 키보드가 올라와 높이만 줄어든 경우에는 무대를 다시 맞추지 않는다(위치가 갑자기 바뀌지 않게)
  if (document.activeElement?.tagName === 'TEXTAREA' && innerWidth === lastW) return;
  lastW = innerWidth;
  const s = Math.min(innerWidth / 360, innerHeight / 640);
  const h = Math.max(640, Math.floor(innerHeight / s));
  const frame = $('#frame');
  frame.style.setProperty('--frame-h', h + 'px');
  frame.style.setProperty('--shift', Math.round((h - 640) * 0.55) + 'px'); // 남는 높이의 절반쯤 여우·탁자를 내려 빈 곳을 나눈다
  frame.style.transform = `scale(${s})`;
  $('#fit').style.width = 360 * s + 'px';
  $('#fit').style.height = h * s + 'px';
}
addEventListener('resize', fit); fit();
SOUND.button();   // 음소거 버튼(무대 오른쪽 위)

// 새 그림이 들어오면 자동으로 쓴다: 카드 뒷면(card-back.webp), 밤 배경(bg-night.webp)
{ const img = new Image(); img.onload = () => { const f = $('#frame'); f.style.setProperty('--card-back', 'url(assets/card-back.webp) center/cover'); f.classList.add('has-cardback'); }; img.src = 'assets/card-back.webp'; }
{ const img = new Image(); img.onload = () => $('#frame').classList.add('has-bg'); img.src = 'assets/bg-night.webp'; }

// ── 여우 표정: 새 그림이 들어오면 그 파일을, 없으면 지금 있는 그림을 쓴다 ──
let VN = false; // 세로 장면(vn-smile.webp 등)이 들어오면 true
// 월화 표정(세로 장면 vn-<표정>.webp, 모두 같은 구도). 대사마다 react로 고른다. 없으면 normal
const FACES = ['normal', 'smile', 'tease', 'surprised', 'worried', 'think', 'warm', 'amused', 'curious'];
let faceNow = 'normal', faceSrc = 'assets/vn-normal.webp';          // 그림이 늦게 들어와도 지금 대사의 표정으로 시작
// 같은 표정의 다른 그림(vn-think-2.webp, vn-think-3.webp …)이 있으면 찾아 두고, 표정이 바뀔 때마다 그중 하나를 무작위로
const FACE_SRCS = Object.fromEntries(FACES.map(f => [f, [`assets/vn-${f}.webp`]]));
FACES.forEach(f => { for (let k = 2; k <= 5; k++) if (hasAsset(`vn-${f}-${k}.webp`)) FACE_SRCS[f].push(`assets/vn-${f}-${k}.webp`); });   // 있는 그림은 목록(asset-list.js)으로 안다 — 미리 받지 않음
// 시간대·이벤트 그림(vn-<표정>_<테마>.webp, 예: vn-smile_evening): 오늘 대본의 테마 그림이 9개 표정 모두 있을 때만 그것으로(일부만 있으면 창밖이 바뀌며 튀므로 안 씀)
const THEME = typeof LINES !== 'undefined' && LINES.theme ? LINES.theme() : '', THEMED = {};
if (THEME && FACES.every(f => hasAsset(`vn-${f}_${THEME}.webp`))) { FACES.forEach(f => { THEMED[f] = `assets/vn-${f}_${THEME}.webp`; }); faceSrc = THEMED[faceNow]; }
// 같은 표정의 다른 그림(-2·-3·-4)은 구도가 조금씩 달라, 대화 도중에 섞으면 표정이 바뀔 때마다 튄다.
// 그래서 한 묶음(번호)을 정해 두고 그 번호의 그림만 쓰다가, 카드 탁자에서 돌아올 때처럼 장면이 크게 바뀔 때만 번호를 바꾼다(2026-10-18 사용자)
let vnSet = 0;
function reshuffleFaces() { vnSet = Math.floor(Math.random() * 4); faceNow = ''; }
const facesOf = f => Object.keys(THEMED).length === FACES.length ? [THEMED[f]] : [(vnSet && FACE_SRCS[f].find(s => s.endsWith(`vn-${f}-${vnSet + 1}.webp`))) || FACE_SRCS[f][0]];
// 표정 바꾸기: 새 그림을 위층에 0.3초 동안 서서히 띄우고, 아래 그림은 다 덮일 때까지 그대로 둔다
// (두 장을 동시에 흐리고 진하게 하면 중간에 바탕이 비쳐 번쩍인다)
let vnTop = 0, vnWant = '', vnFade = 0;
function showFace(src) {
  const ls = document.querySelectorAll('.vn-layers i'), cur = ls[vnTop];
  if (cur.dataset.src === src) return;
  const next = ls[1 - vnTop], im = new Image(); vnWant = src;
  im.onload = () => { if (vnWant !== src) return;   // 늦게 도착한 앞 그림이 새 그림을 덮지 않게(테마 그림으로 바뀔 때)
    clearTimeout(vnFade);
    next.style.transition = 'none'; next.classList.remove('on'); void next.offsetWidth; next.style.transition = '';   // 앞 전환이 덜 끝났어도 새 그림은 투명에서 시작
    next.style.backgroundImage = `url("${src}")`; next.dataset.src = src; next.style.zIndex = 1; cur.style.zIndex = 0;
    next.classList.add('on'); vnTop = 1 - vnTop;
    vnFade = setTimeout(() => cur.classList.remove("on"), 350); };
  im.src = src;
  $('#frame').style.setProperty('--vn', `url(${src})`);                  // 겹치는 층이 안 보이는 환경을 위한 바탕
}
{ const im = new Image(); im.onload = () => { VN = true; $('#frame').classList.add('has-vn'); showFace(faceSrc); FACES.forEach(f => { const p = new Image(); p.src = `assets/vn-${f}.webp`; }); }; im.src = 'assets/vn-normal.webp'; }
// 새 살롱 배경을 쓰는 동안 예전 귀여운 여우는 숨긴다(상담사 초상이 오면 그걸로 대체)
document.documentElement.classList.add('no-old-fox');
const FACE = { '!': 'surprised', '?': 'think', '♡': 'smile', '♪': 'tease', '…': 'worried' };   // 예전 기호도 받는다
function setFox(pose, react) {
  // 세로 장면(vn-<표정>.webp)이 있으면 화면 전체 배경의 표정을 바꾼다
  const face = FACES.includes(react) ? react : FACE[react] || 'normal';
  if (face !== faceNow) { const list = facesOf(face); faceSrc = list[Math.floor(Math.random() * list.length)]; faceNow = face; }   // 같은 표정이 이어지면 그림을 바꾸지 않는다
  if (VN) showFace(faceSrc);
  const b = $('#bubble'); b.hidden = !react || FACES.includes(react);
  if (react) { b.textContent = react; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
}

// ── 대사: 한 글자씩 보여 주고, 화면을 누르면 다음 ──
let waiting = null, timer = null;
// 대화창에 다 안 들어가는 긴 말은 줄바꿈(없으면 문장) 자리에서 나눠 다음 대화창으로 이어 말한다(2026-10-11 사용자)
function fitsTalk(text) {
  const line = $('#line'), box = $('#talk'), prev = [...line.childNodes];   // 글자 노드째 되돌린다(타자 중인 span을 끊지 않게)
  line.style.visibility = 'hidden'; line.textContent = text;
  const ok = line.getBoundingClientRect().bottom <= box.getBoundingClientRect().bottom - parseFloat(getComputedStyle(box).paddingBottom) * 0.6;
  line.replaceChildren(...prev); line.style.visibility = ''; return ok;
}
function splitToFit(text) {
  if (fitsTalk(text)) return [text];
  const cut = text.includes('\n') ? text.split('\n') : text.split(/(?<=[.?!…])\s+/);
  if (cut.length < 2) return [text];
  const sep = text.includes('\n') ? '\n' : ' ';
  let best = null;                                      // 두 덩이 길이가 가장 비슷한 자리
  for (let k = 1; k < cut.length; k++) {
    const a = cut.slice(0, k).join(sep), b = cut.slice(k).join(sep), d = Math.abs(a.length - b.length);
    if (!best || d < best.d) best = { a, b, d };
  }
  return [...splitToFit(best.a), ...splitToFit(best.b)];
}
// 문장이 끝나는 자리(. ? ! … ~ 뒤 띄어쓰기)마다 줄을 바꾼다. 원래 줄바꿈(hard)은 그대로(2026-10-17 사용자)
const sentences = text => text.split('\n').flatMap((l, i) => l.split(/(?<=[.?!…~]["”’']?)[ \t]+(?=\S)/).map((s, j) => ({ s, hard: i > 0 && j === 0 })));
function oneLine(text) {                                 // 대화창 한 줄에 들어가나
  const line = $('#line'), prev = [...line.childNodes];
  line.style.visibility = 'hidden'; line.textContent = text;
  const h = line.offsetHeight, ok = h > 0 && h < parseFloat(getComputedStyle(line).lineHeight) * 1.5;
  line.replaceChildren(...prev); line.style.visibility = ''; return ok;
}
// 짧은 문장이 이어지면('어서 오세요. 누구냐고요?') 한 줄에 들어가는 만큼 붙인다(2026-10-17 사용자)
const joinLines = ss => ss.reduce((out, x, i) => {
  const both = i && !x.hard ? out[out.length - 1] + ' ' + x.s : null;
  if (both && oneLine(both)) out[out.length - 1] = both; else out.push(x.s);
  return out;
}, []).join('\n');
// 손님이 답하는 자리(opt.ask)에서 끝이 질문이면 그 질문은 다음 대화창에서 묻는다: 한 창에 글이 몰리지 않게(2026-10-17 사용자)
function splitAsk(ss) {
  let k = ss.length;
  while (k > 0 && /\?["”’']?\s*$/.test(ss[k - 1].s)) k--;
  return k === 0 || k === ss.length ? [ss] : [ss.slice(0, k), [{ ...ss[k], hard: false }, ...ss.slice(k + 1)]];
}
function say(text, opt = {}) {
  if (text && text.face) opt = { ...opt, react: text.face };   // 대사 문서에서 그 줄에 붙인 표정이 장면 기본 표정보다 먼저(lines.js withFace)
  if (opt.html || (opt.who || 'fox') !== 'fox') return sayBox(text, opt);
  const ss = sentences(String(text)), parts = (opt.ask ? splitAsk(ss) : [ss]).map(joinLines).flatMap(splitToFit);
  return parts.reduce((p, t) => p.then(() => sayBox(t, opt)), Promise.resolve());
}
// 마지막 안전장치(2026-10-20): 대사를 놓은 뒤에도 대화창을 넘치면(폰 글자 크기를 아주 크게 했거나 글꼴이 늦게 와 잰 크기와 다를 때) 그 대사만 글자를 조금씩 줄인다. 평소에는 넘치지 않아 그대로
function shrinkLine() {
  const line = $('#line'), box = $('#talk'); line.style.removeProperty('font-size');
  const over = () => line.getBoundingClientRect().bottom > box.getBoundingClientRect().bottom - parseFloat(getComputedStyle(box).paddingBottom) * 0.6;
  for (let fs = parseFloat(getComputedStyle(line).fontSize), k = 0; over() && k < 12; k++) { fs *= 0.92; line.style.setProperty('font-size', fs + 'px', 'important'); }
}
// 대화창에 글을 바로 놓는 곳(카드 고르기·기다리는 말 등)도 넘치면 줄이기를 거친다
function setLine(text) { $('#line').textContent = text; shrinkLine(); }
function sayBox(text, { who = 'fox', react = null, pose = null, html = false } = {}) {
  return new Promise(res => {
    $('#name').textContent = who === 'me' ? '나' : '월화';
    $('#name').classList.toggle('me', who === 'me');
    if (who === 'fox') { setFox(pose, react); if (typeof TRAIT !== 'undefined') TRAIT.tick(); }
    const line = $('#line'); line.textContent = ''; line.style.removeProperty('font-size'); $('#next').hidden = true; $('#live').textContent = text;
    let i = 0;
    const finish = () => {
      clearInterval(timer); timer = null; line.textContent = text; shrinkLine(); $('#next').hidden = false;
      waiting = () => { waiting = null; res(); };
    };
    if (html) { line.innerHTML = text; $('#live').textContent = line.textContent; clearInterval(timer); $('#next').hidden = false; waiting = () => { waiting = null; res(); }; return; }
    if (reduce) return finish();
    // 남은 글자를 안 보이게 미리 깔아 둔다: 한 글자씩 붙이면 줄 끝 낱말이 길어지다 다음 줄로 통째로 넘어가 글이 뭉텅이로 움직였다(2026-10-18 haru)
    const shown = document.createElement('span'), rest = document.createElement('span'); rest.className = 'rest'; rest.textContent = text; line.replaceChildren(shown, rest);
    shrinkLine();
    timer = setInterval(() => { shown.textContent = text.slice(0, ++i); rest.textContent = text.slice(i); if (i >= text.length) finish(); }, 24);
    waiting = finish;
  });
}
function tap(e) {
  if (e && e.target.closest('button, textarea, .sheet, .choices')) return;
  if (waiting) waiting();
}
$('#frame').addEventListener('click', tap);
$('#talk').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (waiting) waiting(); } });

// ── 선택지: 언제나 대화창 바로 위 같은 자리 ──
// 버튼이 여러 개 나오는 곳은 모두 같은 높이로(글이 길어 두 줄이 된 버튼에 맞춤, haru 2026-10-20). 돌아가기 버튼은 빼고. 글꼴이 늦게 와도 다시 맞춘다
function equalButtons(bs) {
  if (bs.length < 2) return;
  const fit = () => { bs.forEach(b => b.style.removeProperty('min-height')); const h = Math.max(...bs.map(b => b.offsetHeight)); if (h > 0) bs.forEach(b => { b.style.minHeight = h + 'px'; }); };
  requestAnimationFrame(fit); document.fonts?.ready.then(() => requestAnimationFrame(fit));
}
function choose(options, { cols = 1 } = {}) {
  return new Promise(res => {
    const box = $('#choices'); box.replaceChildren(); box.classList.toggle('two-col', cols === 2); box.classList.toggle('three-col', cols === 3); box.hidden = false;
    $('#next').hidden = true;
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'choice' + (o.lock ? ' lock' : '') + (o.back ? ' back' : '');
      b.style.animationDelay = i * 0.07 + 's'; if (o.tag) b.innerHTML = `${esc(o.label)} <small class="tag">${o.tag}</small>`; else b.textContent = o.label;
      b.onclick = () => { box.hidden = true; res(o.value); };
      box.append(b);
    });
    equalButtons([...box.querySelectorAll('.choice:not(.back)')]);
  });
}
function askText({ placeholder = '', skip = '상황만 고를래요', go = '이걸로 볼게요', note = '' } = {}) {
  return new Promise(res => {
    const box = $('#choices'); box.classList.remove('two-col', 'three-col'); box.hidden = false; $('#next').hidden = true;
    box.innerHTML = `<div class="ask">
      <textarea id="concern" maxlength="200" aria-label="고민 적기" placeholder="${placeholder}"></textarea>
      ${note ? `<p class="ask-note">${note}</p>` : ''}<div class="row"><button class="choice" type="button" id="skip">${skip}</button><button class="choice go" type="button" id="send">${go}</button></div></div>`;
    const t = $('#concern');
    $('#send').onclick = () => {
      const v = t.value.trim();
      if (!v) { t.focus(); return; }
      box.hidden = true; res(v);
    };
    $('#skip').onclick = () => { box.hidden = true; res(''); };
  });
}

// 불러 드릴 이름 받기(실명 아니어도 됨). 8자까지, 끝의 '님'·특수문자는 뗀다
function askName() {
  return new Promise(res => {
    const box = $('#choices'); box.classList.remove('two-col', 'three-col', 'topics'); box.hidden = false; $('#next').hidden = true;
    box.innerHTML = `<div class="ask"><input id="name-in" class="name-in" maxlength="8" autocomplete="off" aria-label="불러 드릴 이름" placeholder="이름">
      <div class="row"><button class="choice" type="button" id="skip">이름 없이 볼게요</button><button class="choice go" type="button" id="send">이렇게 불러 주세요</button></div></div>`;
    const t = $('#name-in');
    const ok = () => { const v = t.value.replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().replace(/\s*님$/, '').trim().slice(0, 8);
      if (!v) { t.focus(); return; } box.hidden = true; res(v); };
    $('#send').onclick = ok; t.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } };
    $('#skip').onclick = () => { box.hidden = true; res(''); };
  });
}

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const short = (t, n) => t.length > n ? t.slice(0, n) + '…' : t;
const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function clearTable() { $('#cards').replaceChildren(); $('#table-hint').hidden = true; }
const closeZoom = () => { $('#zoom').hidden = true; };

// ── 이야기 ──

// ── 주제 고르기: 큰 주제 카드(2열) → 안에서 세부 주제. 준비 안 된 것은 흐리게 + '준비 중' ──
const ICON = {
  love: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  work: '<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M4 13h16"/>',
  money: '<ellipse cx="12" cy="7" rx="6.5" ry="2.5"/><path d="M5.5 7v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V7M5.5 11v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4"/>',
  study: '<path d="M4 6.5C6.5 5 9.5 5 12 6.5 14.5 5 17.5 5 20 6.5V18c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 6.5V18"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  talk: '<path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z"/><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"/>'
};
const TOPICS = [
  { id: 'love', label: '연애 · 사랑', open: true,
    items: [{ id: 'single', label: '없어요', open: true }, { id: 'some', label: '좋아하는 사람 있어요', open: true, word: '좋아하는 사람 얘기는' }, { id: 'couple', label: '사귀는 사람 있어요', open: true, word: '연애 중인 사이는' }, { id: 'reunion', label: '헤어졌어요', open: true, word: '헤어진 사이는' }] },
  // 세부 주제 없이 바로 질문 세트로 가는 주제(2026-10-13 모두 엶, 대사·질문은 초안 → docs/나중 확인 목록.md)
  { id: 'work', label: '일 · 커리어', open: true,       // 2026-10-13: 연애처럼 상황별 질문 세트(초안)
    items: [{ id: 'w_job', label: '취업 준비 중이에요', open: true }, { id: 'w_office', label: '회사 다니고 있어요', open: true }, { id: 'w_move', label: '이직·퇴사 고민해요', open: true }, { id: 'w_biz', label: '내 일·사업을 해요', open: true }] },
  { id: 'money', label: '돈 · 재물', open: true,
    items: [{ id: 'm_earn', label: '수입을 늘리고 싶어요', open: true }, { id: 'm_save', label: '돈을 모으고 싶어요', open: true }, { id: 'm_worry', label: '돈 문제가 걱정돼요', open: true }] },
  { id: 'study', label: '학업 · 시험', open: true,
    items: [{ id: 's_exam', label: '시험 준비 중이에요', open: true }, { id: 's_path', label: '진로가 고민이에요', open: true }] },
  { id: 'today', label: '오늘의 운세', open: true },
  { id: 'talk', label: '자유 고민 상담', open: true }
];
const icon = id => `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg>`;
function chooseTopic() {
  return new Promise(res => {
    const box = $('#choices'); box.replaceChildren(); box.classList.remove('two-col', 'three-col'); box.classList.add('topics'); box.hidden = false; $('#next').hidden = true;
    TOPICS.forEach((t, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'topic' + (t.open ? '' : ' lock'); b.style.animationDelay = i * 0.06 + 's';
      b.innerHTML = `${icon(t.id)}<b>${t.label}</b>${t.open ? '' : '<small>준비 중</small>'}`;
      b.onclick = () => { box.classList.remove('topics'); box.hidden = true; res(t); };
      box.append(b);
    });
    // 나가기: 리딩을 보고 돌아와 다시 고를 때만, 메인 주소가 있을 때만(2026-10-24 haru 「다시 고를 때만」 · 버튼 말 「또 올게요」)
    if (st.returned && homeUrl()) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'topic leave'; b.textContent = '또 올게요';
      b.onclick = () => { box.classList.remove('topics'); box.hidden = true; res({ id: 'leave', open: true }); };
      box.append(b);
    }
  });
}
// ── 첫 만남: 루나가 카드를 물고 와 문으로 안내 → 문이 열리고 월화(그림 intro-1~3.webp가 있을 때만) ──
// 손님 눈으로 본 장면이라 손님은 나오지 않는다. 들어올 때마다 보여 주고, 화면을 누르면 다음 장, '건너뛰기'로 끝
const loadImg = src => new Promise(r => { const im = new Image(); im.onload = () => r(src); im.onerror = () => r(null); im.src = src; });
// 나중에 쓸 그림을 뒤에서 두 장씩 미리 받는다(이미 맡긴 건 건너뜀). 첫 화면을 가볍게 하고, 쓸 때는 바로 뜨게(2026-10-20)
// 줄은 하나: first면 줄 맨 앞에 끼운다 — 곧 쓸 그림(탁자 카드 앞면·반응 컷)이 표정 그림 108장 뒤에서 기다리지 않게(2026-10-23 haru 폰: 카드 뒤집기·반응 컷이 늦음)
const PRELOADED = new Set(), PRE_Q = [];
let preBusy = 0;
function preloadQueue(srcs, first = false) {
  const q = srcs.filter(x => x && !PRELOADED.has(x)); q.forEach(x => PRELOADED.add(x));
  if (first) PRE_Q.unshift(...q); else PRE_Q.push(...q);
  const next = () => { if (!PRE_Q.length) { preBusy--; return; } const im = new Image(); im.onload = im.onerror = next; im.src = PRE_Q.shift(); };
  while (preBusy < 2 && PRE_Q.length) { preBusy++; next(); }
}
// 지금 바로 쓸 그림: 줄을 기다리지 않고 곧장 받는다(카드를 누른 순간 그 앞면)
function loadNow(src) { if (!src || PRELOADED.has(src)) return; PRELOADED.add(src); const i = PRE_Q.indexOf(src); if (i >= 0) PRE_Q.splice(i, 1); const im = new Image(); im.fetchPriority = 'high'; im.src = src; }
// ── 들어가기: 브라우저는 사람이 한 번 누르기 전에는 소리를 못 낸다 → 첫 화면에서 [들어가기]를 누르면 음악과 오프닝이 같이 시작된다 ──
// 한 번 지나가면 다시 안 묻는다(같은 페이지 안). bg: 뒤에 깔 그림(없으면 지금 화면 위에 어둡게). ?gate=0이면 건너뜀(자동 점검용)
function gate(bg) {
  if (st.gated || (DEV_MODE && new URLSearchParams(location.search).get('gate') === '0')) return Promise.resolve();
  st.gated = true;
  SOUND.hold(true);
  const g = $('#gate'); g.style.backgroundImage = bg ? `linear-gradient(180deg,#0b070633,#0b0706aa),url("${bg}")` : ''; g.classList.toggle('dim', !bg); g.hidden = false;
  // 누르는 순간 바로 다음으로(음악·오프닝이 같이 시작), 버튼 화면은 그 위에서 0.5초 동안 사라진다
  return new Promise(res => { $('#gate-go').onclick = e => { e.stopPropagation(); SOUND.hold(false); g.classList.add('out'); res(); setTimeout(() => { g.hidden = true; g.classList.remove('out'); }, reduce ? 0 : 500); }; });
}

// 문에서 금빛 가루가 흩날린다(캔버스). 문 가운데(가로 50%, 세로 20~52%)에서 바깥·위로, 약 3초
function introDust(cv, delay = 0) {
  const fr = $('#frame'), W = 360, H = fr.offsetHeight || 640, k = 2;
  cv.width = W * k; cv.height = H * k; const c = cv.getContext('2d'); c.scale(k, k);
  const ps = []; let t0 = 0;
  for (let i = 0; i < 90; i++) {
    const y = H * (.2 + Math.random() * .32), dir = Math.random() < .5 ? -1 : 1;
    ps.push({ x: W / 2 + dir * Math.random() * 18, y, vx: dir * (.25 + Math.random() * 1.1), vy: -(.15 + Math.random() * .7), r: .6 + Math.random() * 1.8, born: Math.random() * 1400, life: 1600 + Math.random() * 1600, tw: Math.random() * 6 });
  }
  const tick = t => {
    if (!t0) t0 = t; const e = t - t0 - delay; c.clearRect(0, 0, W, H); let alive = false;
    for (const p of ps) {
      const a = e - p.born; if (a < 0) { alive = true; continue; } if (a > p.life) continue; alive = true;
      const f = a / p.life, x = p.x + p.vx * a / 16, y = p.y + p.vy * a / 16 + .00002 * a * a;
      const o = Math.sin(Math.PI * f) * (.6 + .4 * Math.sin(p.tw + a / 120));
      const g = c.createRadialGradient(x, y, 0, x, y, p.r * 3); g.addColorStop(0, `rgba(255,240,200,${o})`); g.addColorStop(.4, `rgba(255,200,110,${o * .6})`); g.addColorStop(1, 'rgba(255,180,80,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, p.r * 3, 0, Math.PI * 2); c.fill();
    }
    if (alive) requestAnimationFrame(tick); else c.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(tick);
}

// ── 문이 열리는 장면(오프닝 ③): 값은 intro-timing.json(2026-10-09 사용자가 조절판으로 보면서 맞춘 값. 조절판은 지움) ──
// lightAt: 월화가 나타나기 시작한 뒤 문소리·빛까지(ms), spreadMs: 빛이 좌우로 벌어지는 시간, appearMs: 월화가 나타나는 시간, peak: 빛 밝기(0~1)
// DOOR_LIGHT: 'soft' 문틈 빛만 / 'full' 빛줄기·금빛 가루까지 / 'none' 빛 없이(2026-10-09 사용자: full은 과함 → soft)
const DOOR_LIGHT = 'soft';
const INTRO_T = { lightAt: 0, spreadMs: 900, fadeMs: 160, appearMs: 1600, peak: 0.3, glowPeak: 0.24, glowFadeMs: 160, core: '#fff1cf', edge: '#ffd98c', coreW: 4 };
// peak·fadeMs: 문틈 빛(좌우로 벌어지는 빛)의 밝기·밝아지는 시간, glowPeak·glowFadeMs: 문가 잔광(문 주변에 번지는 빛)의 밝기·밝아지는 시간   // core·edge: 빛 가운데(심지)·바깥 색, coreW: 심지 반폭(%)
const introTReady = fetch('intro-timing.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(j => { if (j.color && !j.edge) j.edge = j.color; delete j.color; Object.assign(INTRO_T, j); }).catch(() => {});
function doorColors(ov) { ov.style.setProperty('--door-core', INTRO_T.core); ov.style.setProperty('--door-edge', INTRO_T.edge); ov.style.setProperty('--door-core-w', INTRO_T.coreW + '%'); }
let doorTimers = [], doorSound = null, doorGen = 0;   // 문 장면 미리 보기를 멈출 때 쓰는 것(예약된 소리·재생 중인 소리·몇 번째 재생인지)
async function doorScene(ov, run, hold, stopAtPeak = false) {   // stopAtPeak: 미리 보기에서 빛이 가장 밝을 때 멈춤(색 고르기용)
  await introTReady; const gen = ++doorGen;
  const T = INTRO_T, ls = ov.querySelectorAll('img'), light = ov.querySelector('.intro-light'), door = ov.querySelector('.intro-door'), rays = ov.querySelector('.intro-rays');
  const peak = DOOR_LIGHT === 'full' ? 1 : T.peak, AT = T.lightAt;
  doorColors(ov);
  const glow = ov.querySelector('.intro-glow'), zoom = [{ transform: 'scale(1.03)' }, { transform: 'scale(1.09)' }], zoomT = { duration: 6500, easing: 'cubic-bezier(.25,.1,.5,1)' };
  if (!reduce) { run(ls[2], zoom, zoomT); run(glow, zoom, zoomT); }   // 빛도 그림과 똑같이 확대
  const appear = run(ls[2], [{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 1 : T.appearMs, easing: 'ease-in-out' });   // 월화가 나타남
  doorTimers.push(setTimeout(() => { doorSound = sfx('door'); }, AT));
  if (DOOR_LIGHT !== 'none') {
    // 문 가운데 가는 틈 → 좌우로 벌어짐(spreadMs). 밝아지는 것(fadeMs)은 따로: 투명 → 정한 밝기. 문가 잔광도 같은 시간에 밝아짐
    run(door, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(.05)', offset: .18 }, { transform: 'scaleX(1)' }], { duration: T.spreadMs, delay: AT, easing: 'cubic-bezier(.5,0,.3,1)' });
    var lit = run(door, [{ opacity: 0 }, { opacity: peak }], { duration: Math.max(1, T.fadeMs ?? 160), delay: AT, easing: 'ease-out' });
    var glowLit = run(light, [{ opacity: 0 }, { opacity: T.glowPeak ?? peak * .8 }], { duration: Math.max(1, T.glowFadeMs ?? T.fadeMs ?? 160), delay: AT, easing: 'ease-out' });
  }
  if (DOOR_LIGHT === 'full' && !reduce) {
    run(rays, [{ opacity: 0, transform: 'rotate(-6deg) scale(.85)' }, { opacity: .85, transform: 'rotate(2deg) scale(1)', offset: .35 }, { opacity: .85, transform: 'rotate(10deg) scale(1.05)' }], { duration: 3600, delay: AT + 250, easing: 'ease-out' });
    introDust(ov.querySelector('.intro-dust'), AT + 450);
  }
  try { await appear.finished; if (lit) await lit.finished; if (glowLit) await glowLit.finished; } catch { return; }   // 월화가 다 나타나고 빛도 다 밝아질 때까지(밝아지는 시간이 길면 그만큼). 미리 보기를 멈추면 여기서 끝
  await hold(DOOR_LIGHT === 'none' ? 0 : 200);   // 빛이 다 밝아진 뒤 잦아들기 시작
  if (gen !== doorGen || stopAtPeak) return;       // 그사이 멈췄거나 새로 재생했으면 앞 재생은 여기서 끝(미리 보기는 빛이 가장 밝을 때 멈춤)
  if (DOOR_LIGHT !== 'none') {
    run(door, [{ opacity: peak, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1.15)' }], { duration: 1300, easing: 'ease-in-out' });
    run(light, [{ opacity: T.glowPeak ?? peak * .8 }, { opacity: (T.glowPeak ?? peak * .8) * .5 }], { duration: 2000, easing: 'cubic-bezier(.2,0,.3,1)' });   // 문가에 은은하게 남는다(잔광 밝기의 절반)
  }
  if (DOOR_LIGHT === 'full') run(rays, [{ opacity: .85, transform: 'rotate(10deg) scale(1.05)' }, { opacity: 0, transform: 'rotate(16deg) scale(1.1)' }], { duration: 1800, easing: 'ease-in-out' });
}

async function intro() {
  const ov = $('#intro'), q = DEV_MODE ? new URLSearchParams(location.search).get('intro') : null;
  // 항상 오프닝부터(2026-10-09 사용자: [들어가기]로 들어오는 입장 장면, 급하면 '건너뛰기'). ?intro=0이면 건너뜀(자동 점검용)
  const srcs = q === '0' ? [] : await Promise.all([1, 2, 3].map(async k => (THEME && await loadImg(`assets/intro-${k}_${THEME}.webp`)) || loadImg(`assets/intro-${k}.webp`)));
  const anims = [];
  const end = (ms = 900) => new Promise(r => { ov.style.transitionDuration = ms + 'ms'; ov.classList.add('out'); $('#frame').classList.remove('intro-talk', 'intro-run'); setTimeout(() => { anims.forEach(a => a.cancel()); ov.hidden = true; r(); }, reduce || !srcs.length ? 0 : ms); });
  if (!srcs[0] || !srcs[2]) return end();                  // 첫 장과 문 열린 장이 없으면 건너뜀
  const ls = ov.querySelectorAll('img'), light = ov.querySelector('.intro-light');
  // 그림을 화면에 올리기 전에 미리 풀어(decode) 둔다: 보이는 순간 큰 그림을 푸느라 첫 프레임이 걸리던 것
  await Promise.all(srcs.map((s, k) => { if (!s) return; ls[k].src = s; return ls[k].decode().catch(() => {}); }));
  let skipped = false, next = null;
  const hold = ms => new Promise(r => { if (skipped) return r(); const t = setTimeout(() => { next = null; r(); }, ms); next = () => { clearTimeout(t); next = null; r(); }; });
  ov.onclick = e => { if (!e.target.closest('button') && next) next(); };
  $('#intro-skip').onclick = () => { skipped = true; if (next) next(); if (waiting) waiting(); if (waiting) waiting(); };   // 대사 중이면 글자 다 보이기 → 넘기기
  const run = (el, kf, o) => { const a = el.animate(kf, { fill: 'forwards', ...o }); anims.push(a); return a; };
  ls[0].style.opacity = 1;                     // 첫 그림을 버튼 화면 뒤에 미리 깔아 둔다(버튼 화면이 사라질 때 검은 화면이 보이지 않게)
  SOUND.cue('intro'); await gate(srcs[0]);   // [들어가기]를 누르면 오프닝 곡과 카메라 움직임이 같이 시작
  $('#frame').classList.add('intro-run');      // 건너뛰기가 보이는 동안(음소거 버튼이 그 왼쪽으로)
  // 카메라는 앞으로만 천천히 민다(장면이 바뀌어도 앞 그림을 되돌리지 않는다). 처음엔 살살, 갈수록 일정하게
  const push = (k, from, to) => { if (!reduce) run(ls[k], [{ transform: `scale(${from})` }, { transform: `scale(${to})` }], { duration: 6500, easing: 'cubic-bezier(.25,.1,.5,1)' }); };
  const fadeIn = (k, ms) => run(ls[k], [{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 1 : ms, easing: 'ease-in-out' });
  // transform과 opacity를 따로 움직이려고 같은 img에 두 애니메이션을 건다(서로 다른 속성이라 겹치지 않음)
  push(0, 1, 1.1);
  await hold(2300);                                          // ① 골목, 카드를 문 루나
  if (srcs[1] && !skipped) {                                 // ② 루나가 문으로 가며 돌아봄: 앞 그림 위로 천천히 겹쳐 나타남
    push(1, 1.02, 1.11); await fadeIn(1, 800).finished; await hold(1700);
  }
  if (!skipped) {                                            // ③ 문틈으로 빛이 새어 나오며 열리고, 빛 속에서 월화가 천천히 나타남
    await doorScene(ov, run, hold);
    await hold(200);
  }
  if (!skipped) { $('#frame').classList.add('intro-talk'); await say(LINES.introDoor(), { react: 'smile' }); }
  ov.onclick = null; sfx('doorClose'); SOUND.cue('introEnd');   // 문이 닫히고 잠기는 동안(2.2초) 오프닝 곡이 멀어지고, 잠금이 끝나면 살롱 곡
  if (skipped || reduce) return end();
  // 문이 닫히면 화면이 검게 → 잠그는 소리가 끝날 때까지 검은 화면 → 살롱이 서서히 밝아지며 월화가 나타남
  $('#frame').classList.remove('intro-talk', 'intro-run'); ov.classList.add('black'); $('#line').textContent = '';
  await new Promise(r => setTimeout(r, 2200));
  return end(1400);
}

async function pickCategory() {
  while (true) {
    const t = await chooseTopic();
    if (t.id === 'leave') return t;
    if (!t.open) {
      await say(LINES.lockedTopic(t.label.replace(/ · /g, '·')), { react: 'normal' });
      await say(LINES.lockedTopicNext(), { ask: true }); continue;
    }
    st.topic = t.id;                                    // 주제별 음악은 첫 카드를 뽑으려고 펼칠 때 바뀐다(ai-reading.js aiStory)
    if (!t.items) return { id: t.id };                  // 세부 주제가 없는 주제: 고른 한마디는 aiStory(질문 세트의 pickLine)나 todayStory가 한다
    await say((LINES[t.id + 'Ask'] || LINES.love)(), { react: 'amused', ask: true });   // 주제를 고른 한마디 + 지금 상황 묻기(love는 LINES.love)
    while (true) {
      const id = await choose([...t.items.map(o => ({ label: o.label, tag: o.open ? '' : '준비 중', value: o.id, lock: !o.open })), { label: '← 다른 거 볼래요', value: 'back', back: true }], { cols: 2 });
      if (id === 'back') break;
      const o = t.items.find(x => x.id === id);
      if (o.open) return { id };
      await say(LINES.lockedSub(o.word || o.label), { react: 'normal' });
      await say(LINES.lockedSubNext(), { ask: true });
    }
    await say(LINES.askTopicAgain(), { react: 'normal', ask: true });
  }
}

async function story() {
  if (!st.asked && /[?&](paid|payFail|resume|view)=/.test(location.search)) {   // 결제창에서 돌아옴: 뽑은 카드부터 이어 간다(ai-reading.js payBack, 그 파일이 다 읽힌 뒤)
    await new Promise(r => document.readyState === 'loading' ? addEventListener('DOMContentLoaded', r, { once: true }) : r());
    if (await payBack()) return;
  } else try { sessionStorage.removeItem('hdb-resume'); } catch {}   // 결제창에 갔다가 돌아오지 않은 값은 남기지 않는다(🔒)
  SOUND.topic(null, 0, true); SOUND.cue('start');     // 처음(또는 처음으로): 살롱 곡. 오프닝이 있으면 오프닝 신호가 골목 곡으로 바꾼다
  $('#log-btn').hidden = true; clearTable(); closeZoom();
  if (typeof hidePaper === 'function') { hidePaper(); closeWebtoon(); setProgress(null); }
  if (!st.asked) {                                       // 처음 한 번만 이름·성별을 묻는다(처음으로 돌아와도 다시 묻지 않음)
    await intro();
    await gate();                                       // 오프닝을 이미 봤으면 여기서 [들어가기]
    preloadQueue([...(typeof REACT_SRCS !== 'undefined' ? Object.values(REACT_SRCS).flat() : []), ...Object.values(FACE_SRCS).flat()]);   // 반응 컷(4MB)을 먼저, 그다음 대화 표정 그림
    if (st.payCanceled) { st.payCanceled = false; await say(LINES.payCanceled(), { react: 'worried' }); }   // 결제하고 돌아왔는데 이어 갈 카드가 없었음(다른 탭 등) → 취소했음을 먼저
    await say(LINES.greetFirst(), { react: 'smile' });
    await say(LINES.selfIntro(), { react: 'warm', ask: true });               // 누구인지 소개하고 이름을 묻는다
    st.name = await askName();
    await say(LINES.askGender(nim()), { react: 'smile', ask: true });          // '하루님, 반가워요.' + 성별 질문을 한 번에
    st.gender = await choose([{ label: '남자', value: '남성' }, { label: '여자', value: '여성' }], { cols: 2 });
    st.asked = true;
    await say(LINES.askTopic(), { react: 'normal', ask: true });               // 바로 주제로(질문을 두 번 잇지 않게)
  } else {
    TRAIT.visits++; st.returned = true;
    const secret = LINES.nightSecret(TRAIT.visits + 1);
    await say(LINES.welcomeBack(nim()), { react: 'tease', ask: !secret });
    if (secret) await say(secret, { react: 'think', ask: true });
  }
  const cat = await pickCategory();
  const AI_SPREAD = { single: 'newlove', some: 'crush', couple: 'couple', reunion: 'reunion', w_job: 'work_job', w_office: 'work_office', w_move: 'work_move', w_biz: 'work_biz', m_earn: 'money_earn', m_save: 'money_save', m_worry: 'money_worry', s_exam: 'study_exam', s_path: 'study_path', talk: 'talk' };   // 세부 주제 → 질문 세트(prompts/spreads.json). 썸·짝사랑은 '좋아하는 사람 있어요' 하나로 받음(2026-10-13)
  if (cat.id === 'leave') return leaveHome();   // 또 올게요 → 작별 인사 → 메인
  if (cat.id === 'today') return todayStory();        // 오늘의 운세: 미리 써 둔 156개에서 한 장(AI 비용 0)
  { const top = TOPICS.find(t => t.id === cat.id || t.items?.some(i => i.id === cat.id)), sub = top?.items?.find(i => i.id === cat.id); st.pathLabel = [top?.label, sub?.label].filter(Boolean).join(' › '); }   // 보고서 '전체 복사'의 맨 윗줄
  if (AI_SPREAD[cat.id] && typeof AI !== 'undefined' && AI.on) return aiStory(AI_SPREAD[cat.id]);
  // 카드 읽는 서버(AI)가 없을 때: 예전 조합식 풀이(2026-10-07 시안)는 2026-10-20에 지움
  await say('지금은 카드를 읽을 수가 없어요. 조금 있다가 다시 와 주세요.', { react: 'worried' });
  return story();
}

story();
