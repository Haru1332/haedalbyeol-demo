// AI 리딩 (질문마다 손님이 카드를 직접 뽑고, 질문 하나씩 AI가 답한다. 끝나면 총정리 보고서)
// 이 PC의 로컬 서버(app/server.mjs)가 있을 때만 켜진다. 미리보기 링크에서는 꺼진다.

const AI = { on: false, spread: null };
// 시간 기록(이 PC 시험용): 무엇을 언제 했는지만 서버(logs/)로 보낸다. 이름·고민·풀이 글은 보내지 않는다. 요약: node tools/trace-report.mjs
let RUN = '';
const trace = (ev, o = {}) => { if (AI.on) navigator.sendBeacon('/api/trace', JSON.stringify({ run: RUN, ev, t: +(performance.now() / 1000).toFixed(2), ...o })); };
document.addEventListener('click', e => {                          // 모든 탭: 어떤 버튼인지만(대사 넘기기는 'talk')
  const b = e.target.closest('button, .card, .sc'); if (!RUN) return;
  trace('tap', { what: b ? (b.id || b.className.split(' ')[0]) : 'talk', label: b?.matches('button') ? b.textContent.trim().slice(0, 12) : undefined });
}, true);
const MAJOR78 = ['바보', '마법사', '여사제', '여황제', '황제', '교황', '연인', '전차', '힘', '은둔자', '운명의 수레바퀴', '정의', '매달린 사람', '죽음', '절제', '악마', '탑', '별', '달', '태양', '심판', '세계'];
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const SUIT = { '완드': '불', '컵': '물', '소드': '바람', '펜타클': '흙' };
const DECK78 = [...MAJOR78, ...Object.keys(SUIT).flatMap(s => ['에이스', '2', '3', '4', '5', '6', '7', '8', '9', '10', '페이지', '나이트', '퀸', '킹'].map(r => `${s} ${r}`))];
const cardMark = name => { const i = MAJOR78.indexOf(name); return i >= 0 ? ROMAN[i] : SUIT[name.split(' ')[0]]; };

// 카드 앞면: 그림(assets/cards/<이름>.png)이 오기 전까지는 원소 색·숫자·장식으로 그린다
const SUIT_CLASS = { '완드': 'fire', '컵': 'water', '소드': 'air', '펜타클': 'earth' };
const RANK_MARK = { '에이스': 'A', '페이지': 'P', '나이트': 'N', '퀸': 'Q', '킹': 'K' };
function cardFace(c, size = 'm') {
  const major = MAJOR78.includes(c.name);
  const [suit, rank] = major ? [null, null] : c.name.split(' ');
  const cls = major ? 'major' : SUIT_CLASS[suit];
  const mark = major ? ROMAN[MAJOR78.indexOf(c.name)] : (RANK_MARK[rank] || rank);
  const sub = major ? '메이저 아르카나' : `${suit} · ${SUIT[suit]}의 원소`;
  return `<div class="tcard ${cls} ${size}${c.rev ? ' rev' : ''}" data-art="assets/cards/${encodeURIComponent(c.name)}.webp">
    <div class="tc-in"><span class="tc-sub">${sub}</span><span class="tc-mark">${mark}</span><span class="tc-orn"></span><span class="tc-name">${c.name}</span></div></div>`;
}
function useCardArt(root) {
  root.querySelectorAll('.tcard[data-art]').forEach(el => { const img = new Image(); img.onload = () => { el.style.backgroundImage = `url(${el.dataset.art})`; el.classList.add('has-art'); }; img.src = el.dataset.art; });
}

// 웹툰: 무대 위에 세로로 내려 읽는 칸. 열려 있는 동안 대화창·선택지는 숨긴다
// ── 진짜 웹툰: 꽉 찬 그림 칸 + 잉크선 말풍선·설명 상자. 긴 풀이는 맨 아래 '자세히 보기' ──
// 장면 그림 목록(AI가 고르는 이름과 같다). 그림이 없는 장면은 비슷한 장면 → 있는 장면 순으로 대신 쓴다
const SCENE_IDS = ['shuffle', 'spread', 'draw', 'reveal', 'read', 'surprise', 'smile', 'wink', 'worried', 'explain', 'think', 'timing', 'wedding', 'silhouette', 'meet-cafe', 'meet-office', 'meet-gathering', 'moon-time', 'rings', 'report'];
const SCENE_NEAR = { wink: 'smile', explain: 'read', think: 'read', draw: 'read', reveal: 'surprise', spread: 'read', shuffle: 'read', worried: 'surprise', report: 'smile', timing: 'think', wedding: 'smile' };
// 같은 장면의 다른 구도(scene-smile-2.webp …). 있으면 원본과 번갈아(무작위) 쓴다
const SCENE_VARIANTS = ['2', '3', '4'];
const SCENES_HAVE = new Set();
[...SCENE_IDS, ...SCENE_IDS.flatMap(id => SCENE_VARIANTS.map(v => `${id}-${v}`))].forEach(id => { if (hasAsset(`scene-${id}.webp`)) SCENES_HAVE.add(id); });   // 목록으로만 확인, 그림은 칸에 쓸 때 받음
let sceneTurn = 0, lastScene = '', lastFile = '';
// 월화가 나오는 장면(말하는 칸에 쓸 수 있는 그림). 같은 그림을 피해 바꿀 때도 이 안에서만 고른다
const WOLHWA_SCENES = ['read', 'surprise', 'smile', 'wink', 'worried', 'explain', 'think', 'reveal', 'timing', 'wedding'];
function sceneSrc(id) {
  const have = [...SCENES_HAVE].filter(x => SCENE_IDS.includes(x) && (WOLHWA_SCENES.includes(x) || x === id));
  let pick = SCENES_HAVE.has(id) ? id : SCENES_HAVE.has(SCENE_NEAR[id]) ? SCENE_NEAR[id] : have.length ? have[sceneTurn++ % have.length] : '';
  if (pick && pick === lastScene && have.length > 1) pick = have[(have.indexOf(pick) + 1) % have.length]; // 바로 앞 칸과 같은 장면은 피한다
  lastScene = pick;
  if (!pick) return 'assets/fox-card.png';
  const files = [pick, ...SCENE_VARIANTS.map(v => `${pick}-${v}`).filter(x => SCENES_HAVE.has(x))];
  const pool = files.length > 1 ? files.filter(f => f !== lastFile) : files;             // 같은 장면이 다시 나오면 다른 구도로
  lastFile = pool[Math.floor(Math.random() * pool.length)];
  return `assets/scene-${lastFile}.webp`;
}
// 장면마다 말풍선 자리를 고정한다(그림에서 사람·여우를 가리지 않는 빈 곳 + 꼬리는 말하는 사람 쪽).
// z: tl=왼쪽 위(꼬리 오른쪽), tr=오른쪽 위(꼬리 왼쪽), below=칸 아래에 매달림(꼬리 위로, tx=꼬리가 가리킬 가로 위치 %)
// tx가 없으면 말하는 사람이 화면 밖(손·소품 장면) → 꼬리 없음
const BUB_AT = {
  read: { z: 'tr' }, smile: { z: 'tl' }, worried: { z: 'tl' }, explain: { z: 'tl' }, think: { z: 'tl' }, report: { z: 'tl' },
  surprise: { z: 'below', tx: 55 }, wink: { z: 'below', tx: 60 }, reveal: { z: 'below', tx: 51 },
  shuffle: { z: 'below' }, spread: { z: 'below' }, draw: { z: 'below' }, rings: { z: 'below' }, 'moon-time': { z: 'below' },
  silhouette: { z: 'below' }, 'meet-cafe': { z: 'below' }, 'meet-office': { z: 'below' }, 'meet-gathering': { z: 'below' }
};
const foxHead = `<img class="wt-head-img" src="assets/fox-head.png" alt="">`;
// 카드 클로즈업: 앞면 그림이 오기 전까지는 카드 뒷면 + 금빛 이름표
function cardClose(cards) {
  return `<div class="wtp-art wtp-cards n${cards.length}">${cards.map((c, i) => `<figure style="--d:${0.15 + i * 0.3}s"><div class="cc${c.rev ? ' rev' : ''}" data-art="assets/cards/${encodeURIComponent(c.name)}.webp"><div class="cc-in"><i class="cc-front"></i><i class="cc-back"></i></div></div><figcaption><b>${c.name}</b><span>${c.rev ? '역방향' : '정방향'}</span></figcaption></figure>`).join('')}</div>`;
}
function useCloseArt(root) {
  root.querySelectorAll('.cc[data-art]:not(.has-art)').forEach(el => { const im = new Image(); im.onload = () => { el.querySelector('.cc-front').style.backgroundImage = `url("${el.dataset.art}")`; el.classList.add('has-art'); }; im.src = el.dataset.art; });
}
function bubble(text, at) {
  if (at.z !== 'below') return `<p class="wtp-bub bz-${at.z}">${esc(text)}</p>`;
  if (at.tx == null) return `<p class="wtp-bub bz-below no-tail" style="margin-left:24%">${esc(text)}</p>`;
  const left = Math.max(3, Math.min(45, at.tx - 26));            // 말풍선 폭 52%
  return `<p class="wtp-bub bz-below" style="margin-left:${left}%;--tail:${((at.tx - left) / 52 * 100).toFixed(0)}%">${esc(text)}</p>`;
}
const textBox = (kind, text, at) => kind === 'caption' ? `<p class="wtp-cap">${esc(text)}</p>` : bubble(text, at);
function scenePanel(p) {
  const src = sceneSrc(p.scene), id = (src.match(/scene-(.+)\.webp$/) || [])[1];
  const fixed = typeof BUB_POS !== 'undefined' && BUB_POS[id];
  if (fixed && p.kind !== 'caption') return `<figure class="wt-panel wtp pfig"><div class="wtp-art"><img src="${src}" alt=""></div>${bubHTML(esc(p.text), fixed)}</figure>`;
  const at = BUB_AT[id] || { z: 'below' };
  return `<figure class="wt-panel wtp${p.kind === 'caption' ? ' has-cap' : ''}${p.kind !== 'caption' && at.z !== 'below' ? ' bub-in' : ''}"><div class="wtp-art"><img src="${src}" alt=""></div>${textBox(p.kind, p.text, at)}</figure>`;
}
// 대기 말풍선: 무거운 카드면 단호하게(I), 좋은 카드면 가끔 설렘(E), 아니면 평소 말
function waitWords(cards) {
  const m = cardMood(cards);
  if (m === 'heavy' && TRAIT.try('serious')) return LINES.serious();
  if (m === 'good' && TRAIT.try('excited', 0.6)) return LINES.excited();
  return LINES.waitBubble();
}
function openWebtoon({ qi, total, q, cards, label, nextLabel }) {
  const job = qi < total ? 'q' + (qi + 1) : 'concern'; trace('wtOpen', { job });
  const wt = $('#webtoon'); $('#frame').classList.add('wt-open'); wt.hidden = false; wt.scrollTop = 0;
  sfx('page'); SOUND.cue('webtoon');
  wt.innerHTML = `<header class="wt-panel wt-title"><div class="wt-moons">${moons(qi, total)}</div><span class="wt-qno">${label || `질문 ${qi + 1} / ${total}`}</span><h2>${esc(q)}</h2></header>
    ${cards.length ? `<figure class="wt-panel wtp wtp-close">${cardClose(cards)}<p class="wtp-cap" id="close-cap" hidden></p></figure>` : ''}
    <figure class="wt-panel wtp wt-wait"><div class="wtp-art"><img src="${sceneSrc('read')}" alt=""></div><p class="wtp-bub bz-tr">${waitWords(cards)}<span class="wt-typing"><i></i><i></i><i></i></span></p></figure>`;
  useCloseArt(wt); revealPanels(wt);
  // 실시간으로 받은 만큼 그린다. 이미 그린 칸은 두고 새 칸만 '쓰는 중' 표시 앞에 붙인다
  const ls = { head: false, card: false, reacts: 0, readOn: false, secs: [], beats: [], closing: false, glided: false };
  let tail = null;                                                   // '월화가 이어서 쓰는 중' 표시(맨 끝)
  const add = html => { tail.insertAdjacentHTML('beforebegin', html); return tail.previousElementSibling; };
  const settle = () => { revealPanels(wt); if (typeof drawTails === 'function') requestAnimationFrame(() => drawTails(wt)); };
  // 결론 쪽으로 저절로 내려가지 않는다: 질문부터 보고 손님이 직접 내려 읽는다(2026-10-10 사용자: 질문을 다시 보러 올라가게 됨)
  const glideOnce = () => {                                          // (지금은 안 씀) 결론 상자가 화면 위쪽 1/5쯤 오도록 한 번만 미끄러진다
    if (ls.glided) return; ls.glided = true;
    const head = wt.querySelector('.wt-head');
    if (head) setTimeout(() => glideTo(wt, panelTop(wt, head) - wt.clientHeight * 0.2, 1000), MOTION ? 160 : 0);
  };
  return {
    live(R) {
      if (R.headline && !ls.head) {                                  // 1) 결론: '읽는 중' 칸 자리에
        ls.head = true; trace('wtHead', { job });
        wt.querySelector('.wt-wait').outerHTML = `<div class="wt-panel wt-head"><span>결론</span><p>${esc(R.headline)}</p></div>
          <p class="wt-writing" role="status"><span>풀이 중</span><span class="wt-typing"><i></i><i></i><i></i></span></p>`;
        tail = wt.querySelector('.wt-writing');
      }
      if (!ls.head) return;
      if (R.card && !ls.card) {                                      // 2) 카드 뜻: 카드 아래 설명 상자
        ls.card = true; const cap = $('#close-cap'); if (cap) { cap.textContent = R.card; cap.hidden = false;
        if (MOTION) cap.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: EASE }); }
      }
      while (ls.reacts < R.reacts.length) { const r = R.reacts[ls.reacts++]; add(scenePanel({ scene: r.scene, kind: 'bubble', text: r.text })); }
      if (R.sections.length && !ls.readOn) { ls.readOn = true; add(scenePanel({ scene: 'explain', kind: 'bubble', text: LINES.readOn() })); }
      R.sections.forEach((sec, i) => {                               // 3) 풀이 묶음: 쓰는 대로 글이 늘어난다
        if (!ls.secs[i]) ls.secs[i] = add(`<section class="wt-panel wt-read">${sec.title ? `<h3 class="wt-read-t">${esc(sec.title)}</h3>` : ''}<div class="wt-read-body"></div></section>`);
        const body = ls.secs[i].querySelector('.wt-read-body'), html = sec.open && !R.done ? paras(sec.text || ' ').replace(/<\/p>$/, '<span class="wt-caret"></span></p>') : paras(sec.text);
        if (body.innerHTML !== html) body.innerHTML = html;
        if (sec.beat?.text && !ls.beats[i]) { ls.beats[i] = true; add(scenePanel({ scene: sec.beat.scene, kind: 'bubble', text: sec.beat.text })); }
      });
      if (R.closing?.text && !ls.closing) { ls.closing = true; add(scenePanel({ scene: R.closing.scene, kind: 'bubble', text: R.closing.text })); }
      settle();
    },
    // 4) 다 쓰면: 핵심 → 다음 버튼. 버튼은 나타나는 즉시 눌린다
    finish(R) {
      this.live(R);
      tail?.remove();
      wt.insertAdjacentHTML('beforeend', `<div class="wt-panel wt-key"><span>핵심</span><p>${esc(R.keypoint || R.headline)}</p></div>
        <div class="wt-panel wt-end"><button type="button" class="wt-btn" id="wt-next">${MOON_SVG}<span>${nextLabel || (qi + 1 < total ? '다음 질문으로' : '총정리 보고서 받기')}</span>${!nextLabel && qi + 1 < total ? `<small>${qi + 2} / ${total}</small>` : ''}</button></div>`);
      // 형광펜 점검: 묶음 수와 칠한 구절 수, 화면에 새어 나온 '=='(말풍선·결론·핵심 포함)
      settle(); trace('wtNextShown', { job, chars: wt.textContent.replace(/\s+/g, '').length, secs: R.sections.length, hl: wt.querySelectorAll('mark.hl').length, hlLens: [...wt.querySelectorAll('mark.hl')].map(m => m.textContent.length), stray: wt.textContent.includes('=='), misuse: R.hlMisuse || 0 });
      return new Promise(res => { const b = $('#wt-next'); b.onclick = () => { trace('wtNext', { job, seen: +((wt.scrollTop + wt.clientHeight) / wt.scrollHeight).toFixed(2) }); b.onclick = null; b.disabled = true; sceneChange(closeWebtoon).then(res); }; });
    },
    error() {
      const bub = wt.querySelector('.wt-wait .wtp-bub'), msg = '어, 카드가 오늘따라 말이 없네요. 처음부터 다시 볼게요.';
      if (bub) bub.textContent = msg; else wt.insertAdjacentHTML('beforeend', `<p class="wt-panel wtp-cap in">${msg}</p>`);
    }
  };
}
// 풀이를 실시간으로 받는다: 서버가 한 줄에 하나씩 {t:'d', s:글조각} → {t:'end'}.
// 손님이 앞 풀이를 읽는 동안 뒤 풀이를 미리 받아 두므로, 받는 일(job)과 화면(watch)을 나눈다
// 같은 질문을 다른 요청이 만드는 중이거나 이미 만들었으면 서버가 409(2026-10-24 haru: 두 번 만들지 않기) → 보관함에 생길 때까지 5초마다 본다.
// 30초마다 다시 요청해 본다(앞 요청이 실패해 관문이 '만드는 중'을 놓아주면 그때 새로 만든다). 6분이 지나도 없으면 실패
const wait5 = () => new Promise(r => setTimeout(r, 5000));
async function kept(job) {
  if (!st.keep || !PAY.gate) return null;
  const k = encodeURIComponent(st.keep);
  try {
    if (job === 'plan') { const r = await fetch(`${PAY.gate}/api/keep/${k}/material`); return r.ok ? (await r.json()).material?.plan || null : null; }
    const r = await fetch(`${PAY.gate}/api/keep/${k}`); return r.ok ? (await r.json()).parts?.[job] ?? null : null;
  } catch { return null; }
}
async function fetchOrKept(path, init, job) {
  for (let i = 0; i < 12; i++) {
    const res = await fetch(path, init);
    if (res.status !== 409) return { res };
    trace('aiWaitKept', { job });
    for (let k = 0; k < 6; k++) { await wait5(); const got = await kept(job); if (got != null) return { got }; }
  }
  throw new Error('기다렸는데 풀이가 오지 않았어요');
}
function fetchJob(body, name, path = '/api/answer-stream') {   // body: 요청 내용, 또는 내용을 돌려주는 async 함수(설계도의 그 질문 몫이 나올 때까지 기다릴 때)
  const job = { text: '', done: false, err: null, subs: new Set() };
  const ping = () => job.subs.forEach(f => f());
  job.run = async () => {
    for (let t = 0; ; t++) try {
      job.retry = false;
      const b = typeof body === 'function' ? await body() : body;
      trace('aiStart', { job: name });
      job.retry = !!b.orderId && t === 0;   // 결제한 리딩: 글이 하나도 안 왔을 때만 한 번 더(이미 보인 글을 갈아엎지 않게)
      const { res, got } = await fetchOrKept(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }, name);
      if (got != null) { job.text = typeof got === 'string' ? got : got.text || ''; trace('aiKept', { job: name }); ping(); break; }   // 보관함에서 꺼냄(설계도는 글, 풀이는 칸의 원문)
      if (!res.ok || !res.body) throw new Error('연결 실패');
      const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const row = buf.slice(0, i); buf = buf.slice(i + 1); if (!row.trim()) continue;
          const m = JSON.parse(row);
          if (m.t === 'd') { if (!job.text) trace('aiFirst', { job: name }); job.text += m.s; ping(); } else if (m.t === 'err') throw new Error(m.msg);
        }
      }
      if (path === '/api/answer-stream') { const R = parseReading(job.text, true); if (!R.headline || !R.sections.length) throw new Error('풀이 형식이 맞지 않아요'); }
      else if (!job.text.trim()) throw new Error('설계도가 비었어요');
      break;
    } catch (e) { if (job.retry && !job.text) { trace('aiRetry', { job: name }); continue; } job.err = e; trace('aiErr', { job: name }); break; }
    trace('aiDone', { job: name, chars: job.text.length });
    job.done = true; ping();
  };
  return job;
}
// 설계도에서 질문 qi의 몫(@배정)이 다 써질 때까지 기다렸다가, 거기까지 자른 설계도를 돌려준다(2026-10-10: 기다림 줄이기).
// @반전이 아직 안 나왔으면(형식과 달리 끝에 쓴 경우) 설계도가 다 끝날 때까지 기다린다 — 그 경우엔 예전과 같다
function planPart(pj, qi) {
  return new Promise((res, rej) => {
    const check = () => {
      if (pj.err) { pj.subs.delete(check); return rej(pj.err); }
      const t = pj.text, m = t.match(new RegExp(`^@배정${qi + 1} .*\\n`, 'm'));
      if (pj.done) { pj.subs.delete(check); return res(t); }
      if (m && /^@반전 /m.test(t)) { pj.subs.delete(check); res(t.slice(0, m.index + m[0].length)); }
    };
    pj.subs.add(check); check();
  });
}
const planFull = pj => new Promise((res, rej) => { const c = () => { if (pj.done) { pj.subs.delete(c); pj.err ? rej(pj.err) : res(pj.text); } }; pj.subs.add(c); c(); });
// 정해진 순서대로, 동시에 두 개까지 받는다
function jobQueue(jobs, width = 2) {
  let next = 0;
  const worker = async () => { while (next < jobs.length) await jobs[next++].run(); };
  for (let i = 0; i < width; i++) worker();
}
// 받은 만큼 화면에 그리고, 다 받으면 결과를 돌려준다
function watch(job, onR) {
  return new Promise((res, rej) => {
    let queued = false;
    const draw = () => {
      queued = false;
      if (job.done) { job.subs.delete(kick); if (job.err) return rej(job.err); return res(parseReading(job.text, true)); }
      onR(parseReading(job.text, false));
    };
    const kick = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
    job.subs.add(kick); kick();
  });
}
// 웹툰 안에서 요소의 스크롤 위치(무대가 확대·축소돼 있어서 배율을 나눈다)
function panelTop(sc, el) { const k = $('#frame').getBoundingClientRect().width / 360; return (el.getBoundingClientRect().top - sc.getBoundingClientRect().top) / k + sc.scrollTop; }
// 부드러운 스크롤: 천천히 출발해 천천히 멈춘다. 손님이 손으로 스크롤하면 바로 멈춘다
function glideTo(sc, to, ms = 900) {
  to = Math.max(0, Math.min(to, sc.scrollHeight - sc.clientHeight));
  if (!MOTION) { sc.scrollTop = to; return Promise.resolve(); }
  sc.style.scrollBehavior = 'auto';                            // CSS의 smooth 스크롤과 겹치면 끊기므로 잠깐 끈다
  const from = sc.scrollTop, d = to - from; let t0 = null, stop = false;
  const cancel = () => { stop = true; }; ['wheel', 'touchstart', 'pointerdown'].forEach(e => sc.addEventListener(e, cancel, { once: true, passive: true }));
  return new Promise(res => {
    const done = () => { sc.style.scrollBehavior = ''; res(); };
    const f = t => { if (stop) return done(); t0 ??= t; const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; sc.scrollTop = from + d * e; k < 1 ? requestAnimationFrame(f) : done(); };
    requestAnimationFrame(f);
  });
}
const MOON_SVG = '<svg class="wt-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.4A7 7 0 0 1 15.5 3.5z"/></svg>';
function closeWebtoon() { const wt = $('#webtoon'); wt.hidden = true; wt.replaceChildren(); wt.classList.remove('rp-mode'); $('#frame').classList.remove('wt-open'); }

// 탁자 클로즈업 그림이 있으면 카드 고를 때 쓴다
// 탁자 그림: 받아 두기만 하면 처음 화면에 그릴 때 잠깐 늦어 흰 바탕이 비쳤다(첫 카드 섞기, 2026-10-09) → 그릴 준비(decode)까지 해 둔다
{ const im = new Image(); im.src = 'assets/set-table.webp'; im.decode().then(() => $('#frame').classList.add('has-table'), () => { im.onload = () => $('#frame').classList.add('has-table'); }); window.__tableImg = im; }

// 로컬 서버가 있는지 확인
const PAY = { gate: null }, PAY_KEY = 'hdb-resume';   // 결제 관문 주소(서버의 PAY_GATE, 없으면 결제 문 없이 지금처럼)
// 점검 버튼(보고서·웹툰·다 펼치기 바로)은 가짜 답 서버에서 주소에 ?dev=1을 붙였을 때만(2026-10-25 haru: 가짜 페이지에서도 없애 달라)
const STATUS = fetch('/api/status').then(r => r.ok ? r.json() : null).then(j => { if (j?.ai) AI.on = true; if (j?.payGate) PAY.gate = j.payGate; if (j?.mock) { window.WOLHWA_MOCK = true; if (/[?&]dev=1/.test(location.search)) { addDevReportButton(); addDevWebtoonButton(); addDevSpreadButton(); } } }).catch(() => {});

// ── 점검용(가짜 답 서버에서만): 8장을 저절로 뽑아 '다 펼치기' 장면으로 바로 간다(연애, 주제 곡) ──
function addDevSpreadButton() {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'dev-btn dev-shuf'; b.textContent = '점검: 다 펼치기 바로';
  b.onclick = e => {
    e.stopPropagation(); b.disabled = true;
    Object.assign(st, { asked: true, name: st.name || '하루', gender: st.gender || '남성', topic: 'love', concern: '' });
    $('#choices').hidden = true; if (typeof hidePaper === 'function') { hidePaper(); closeWebtoon(); }
    aiStory('newlove', 'spread').finally(() => { b.disabled = false; });   // 하던 대화는 그대로 버려진다(점검용)
  };
  $('#frame').append(b);
}

// ── 점검용(가짜 답 서버에서만): 인사·뽑기를 건너뛰고 질문 웹툰을 바로 연다. '다음'을 누르면 다음 질문(8번 뒤엔 1번) ──
function addDevWebtoonButton() {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'dev-btn dev-wt'; b.textContent = '점검: 웹툰 바로';
  b.onclick = async e => {
    e.stopPropagation(); b.disabled = true;
    const ov = $('#intro'); if (ov && !ov.hidden) { ov.hidden = true; $('#frame').classList.remove('intro-talk'); }
    try {
      const spreadId = 'newlove', Q = (await (await fetch('/api/spreads')).json())[spreadId].questions;
      for (let qi = 0; ; qi = (qi + 1) % Q.length) {
        const deck = shuffle(DECK78);
        const cards = Array.from({ length: Q[qi].cards || 1 }, () => ({ name: deck.pop(), rev: Math.random() < 0.3 }));
        const job = fetchJob({ spreadId, concern: '', qIndex: qi, cards, picks: [], plan: '' }); job.run();
        let view; await sceneChange(() => { view = openWebtoon({ qi, total: Q.length, q: Q[qi].q, cards, nextLabel: '다음 질문 (점검)' }); });
        const R = await watch(job, r => view.live(r));
        await view.finish(R);
      }
    } catch (err) { alert('점검용 웹툰 실패: ' + err.message); }
    b.disabled = false;
  };
  $('#frame').append(b);
}

// ── 점검용(가짜 답 서버에서만): 8문항을 건너뛰고 총정리 보고서를 바로 연다 ──
function addDevReportButton() {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'dev-btn'; b.textContent = '점검: 보고서 바로';
  b.onclick = async () => {
    b.disabled = true; b.textContent = '만드는 중…';
    try {
      const spreadId = 'newlove', spread = (await (await fetch('/api/spreads')).json())[spreadId];
      const deck = shuffle(DECK78);
      const items = spread.questions.map(q => ({ q: q.q, cards: Array.from({ length: q.cards || 1 }, () => ({ name: deck.pop(), rev: Math.random() < 0.3 })) }));
      const a = (await api('/api/answer', { spreadId, concern: '', qIndex: 0, cards: items[0].cards, prev: [] })).data;   // 가짜 답 서버에서만
      items.forEach(it => Object.assign(it, { headline: a.headline, keypoint: a.keypoint, body: a.body }));
      const rep = await api('/api/report', { spreadId, concern: '', items });
      st.aiReport = { spread, items, report: rep.data };
      await openReport();
    } catch (e) { alert('점검용 보고서 실패: ' + e.message); }
    b.disabled = false; b.textContent = '점검: 보고서 바로';
  };
  $('#frame').append(b);
}

async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || '실패'); return j;
}

// 탁자에 뒷면 카드 20장을 두 줄로 펼친다. 뽑은 자리는 남은 덱에서 채운다
// 탁자에서 카드를 펼칠 수 있는 높이(선택지 위까지)에 맞춰 카드 크기와 위치를 정한다
function fanGeom() {
  const avail = Math.max(120, $('#table').offsetHeight - 258 - 10);          // 탁자 위 ~ 선택지 위
  const H = Math.min(108, Math.max(74, (avail - 26) / 1.58)), W = Math.round(H * 0.667);
  const top = Math.max(6, (avail - 26 - H * 1.58) / 2 + 4);
  return { W, H: Math.round(H), top, rowGap: Math.round(H * 0.58), cx: 180 - W / 2, cy: top + H * 0.3, hintTop: top + H * 1.58 + 22 };
}
const cardArt = name => `assets/cards/${encodeURIComponent(name)}.webp`;
function layFan(state) {
  const box = $('#cards'); box.replaceChildren(); box.classList.remove('locked');
  const g = fanGeom(), cols = 10, step = (360 - 28 - g.W) / (cols - 1);
  box.dataset.ox = g.cx; box.dataset.oy = g.cy;
  state.fan.forEach((name, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card back'; b.setAttribute('aria-label', `카드 ${i + 1}`);
    const row = Math.floor(i / cols), col = i % cols, arc = (col - 4.5) ** 2 * 1.3;   // 가운데가 높고 양 끝이 내려가는 부채꼴
    Object.assign(b.style, { width: g.W + 'px', height: g.H + 'px', left: 14 + col * step + 'px', top: g.top + row * g.rowGap + arc + 'px', rotate: ((col - 4.5) * 4.2) + 'deg' });
    b.dataset.i = i; box.append(b);
  });
  preloadQueue(state.fan.map(cardArt), true);   // 깔린 20장의 앞면을 줄 맨 앞에(뽑으면 바로 뒤집히게)
  $('#table-hint').style.top = g.hintTop + 'px';
}
function pickFromFan(state, n) {
  $('#frame').classList.add('picking');
  return new Promise(res => {
    const picked = []; let locked = false;
    const upd = () => {};
    upd();
    $('#cards').querySelectorAll('.card').forEach(b => b.onclick = () => {
      if (locked) return;                                    // 다 고른 뒤의 연타는 무시
      const i = +b.dataset.i; const k = picked.indexOf(i);
      if (k >= 0) { picked.splice(k, 1); sfx('tap'); } else if (picked.length < n) { picked.push(i); loadNow(cardArt(state.fan[i])); sfx(picked.length === n ? 'pickLast' : 'pick'); const p = stagePoint(b); sparkle(p.x, p.y - 10, 7); }   // 마지막(한 장이면 그 한 장)은 '탁 스윽', 앞의 카드는 '탁'
      $('#cards').querySelectorAll('.card').forEach(c => { const o = picked.indexOf(+c.dataset.i); c.classList.toggle('picked', o >= 0); c.dataset.order = o >= 0 ? o + 1 : ''; });
      upd();
      if (picked.length === n) { locked = true; $('#cards').classList.add('locked'); } else return;
      setTimeout(async () => {
        const cards = picked.map(i => ({ name: state.fan[i], rev: Math.random() < 0.3 }));
        $('#table-hint').hidden = true;
        await liftPicked();
        state.refill = [...picked];
        picked.sort((a, b) => b - a).forEach(i => state.fan.splice(i, 1, state.deck.pop()));
        res(cards);
      }, 300);
    });
  });
}
function showPaper(html) { const p = $('#answer'); p.innerHTML = html; p.hidden = false; p.scrollTop = 0; }
const hidePaper = () => { $('#answer').hidden = true; };
const miniCards = cards => `<div class="pcards">${cards.map(c => `<span class="pc${c.rev ? ' rev' : ''}"><b>${cardMark(c.name)}</b>${c.name}<i>${c.rev ? '역방향' : '정방향'}</i></span>`).join('')}</div>`;
// ==구절== 은 AI가 묶음마다 고른 핵심 구절 → 형광펜. 아직 닫히지 않은 == (쓰는 중)는 지운다
const paras = t => t.split(/\n\s*\n|\n/).filter(Boolean).map(x => `<p>${esc(x).replace(/==([^=\n]{1,60}?)==/g, '<mark class="hl">$1</mark>').replace(/==/g, '')}</p>`).join('');

// 기다리는 동안 여우가 카드를 읽는 연출
function waitLine(text) {
  let k = 0; $('#name').textContent = '월화'; $('#next').hidden = true; setFox(null, '…');
  const t = setInterval(() => { setLine(text + ' ' + '·'.repeat(1 + (k++ % 3))); }, 450);
  return () => clearInterval(t);
}

// 진행 표시: 질문마다 달이 하나씩 차오른다(초승달 → 보름달). 끝낸 질문은 금빛, 지금 질문은 반짝임
function moons(done, total, just = -1) {
  return Array.from({ length: total }, (_, i) => `<i class="mo${i < done ? ' d' : i === done ? ' n' : ''}${i === just ? ' just' : ''}" style="--p:${Math.round((i + 1) * 8 / total)}"></i>`).join('');
}
const ORD = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째', '일곱 번째', '여덟 번째', '아홉 번째', '열 번째'];
function setProgress(done, total) {
  const p = $('#progress'); if (total == null) { p.hidden = true; p.dataset.done = ''; return; }
  const prev = p.dataset.done === '' || p.dataset.done == null ? -1 : +p.dataset.done;
  p.hidden = false; p.dataset.done = done;
  p.innerHTML = moons(done, total, done > prev && prev >= 0 ? done - 1 : -1) + `<b>${Math.min(done + 1, total)}/${total}</b>`;
  p.setAttribute('aria-label', `질문 ${Math.min(done + 1, total)} / ${total}`);
}
// 쟁반: 뽑은 카드를 질문 순서대로 엎어 둔다(내용은 아직 안 보여 준다)
function trayAdd(qi, cards) {
  const t = $('#tray'); t.hidden = false;
  t.insertAdjacentHTML('beforeend', `<div class="tg"><span>${cards.map(() => '<b class="tc"></b>').join('')}</span><i>${qi + 1}</i></div>`);
}
// 카드 앞면 그림을 입힌다(그림이 없으면 이름만). 1.5초 안에 못 받으면 이름으로
async function paintFace(c) {
  const has = await Promise.race([new Promise(r => { const im = new Image(); im.onload = () => im.decode().then(() => r(true), () => r(true)); im.onerror = () => r(false); im.src = c.dataset.art; }), new Promise(r => setTimeout(() => r(false), 1500))]);   // 받은 뒤 그릴 준비(decode)까지
  return () => { if (has) c.style.backgroundImage = `url("${c.dataset.art}")`; else { c.classList.add('noart'); c.textContent = c.dataset.name; } c.classList.toggle('rev', !!c.dataset.rev); };
}
async function flipCard(c, ready) {   // ready: 미리 받아 둔 앞면(paintFace 결과). 없으면 지금 받는다
  const face = await (ready || paintFace(c));
  sfx('flip', { vol: c.closest('#spread') ? 0.5 : 1 });   // 펼칠 때는 여러 장이라 작게
  if (!MOTION) return face();
  await c.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 150, easing: 'ease-in' }).finished; face();
  await c.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 180, easing: 'ease-out' }).finished;
}
// 방금 뽑은 카드를 가운데에 크게 놓고 뒤집어 보여 준다
async function showDrawn(cards) {
  const box = $('#showcase'); box.className = 'showcase n' + cards.length; box.hidden = false;
  box.innerHTML = cards.map(c => `<figure><b class="sc" data-art="assets/cards/${encodeURIComponent(c.name)}.webp" data-name="${esc(c.name)}" data-rev="${c.rev ? 1 : ''}"></b><figcaption><b>${esc(c.name)}</b><span>${c.rev ? '역방향' : '정방향'}</span></figcaption></figure>`).join('');
  const figs = [...box.querySelectorAll('figure')];
  figs.forEach(f => f.querySelector('figcaption').style.opacity = 0);
  if (MOTION) await Promise.all(figs.map((f, i) => f.animate([{ opacity: 0, transform: 'translateY(40px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 120, easing: EASE, fill: 'backwards' }).finished));
  for (const f of figs) {
    await flipCard(f.querySelector('.sc'));
    sfx('reveal'); const p = stagePoint(f.querySelector('.sc')); sparkle(p.x, p.y, 8);
    const cap = f.querySelector('figcaption'); cap.style.opacity = '';
    if (MOTION) cap.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
  }
}
// 보여 준 카드가 위쪽 쟁반 자리로 날아가 엎어진다
async function drawnToTray(qi, cards) {
  trayAdd(qi, cards); setTimeout(() => sfx('toTray'), MOTION ? 480 : 0);   // 카드가 쟁반에 닿는 순간 '탁'(날아가는 시간 0.56초)
  const box = $('#showcase'), g = $('#tray').lastElementChild, k = $('#frame').getBoundingClientRect().width / 360;
  if (MOTION) {
    g.style.visibility = 'hidden';
    const from = [...box.querySelectorAll('.sc')], to = [...g.querySelectorAll('.tc')];
    box.querySelectorAll('figcaption').forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
    await Promise.all(from.map((c, i) => {
      const a = c.getBoundingClientRect(), b = (to[i] || to[0]).getBoundingClientRect();
      const dx = (b.left + b.width / 2 - a.left - a.width / 2) / k, dy = (b.top + b.height / 2 - a.top - a.height / 2) / k, s = b.width / a.width;
      // 이동은 translate·scale 속성으로: 역방향 카드는 rotate:180deg라 transform 안의 translate가 거꾸로 적용돼 아래(탁자)로 날아갔다(2026-10-09)
      return c.animate([{ translate: '0px 0px', scale: '1', transform: 'none' }, { translate: `${dx * .5}px ${dy * .5}px`, scale: `${(1 + s) / 2}`, transform: 'scaleX(0)', offset: .5 }, { translate: `${dx}px ${dy}px`, scale: `${s}`, transform: 'none', backgroundImage: 'url(assets/card-back.webp)' }],
        { duration: 560, delay: i * 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished;
    }));
    g.style.visibility = '';
  }
  box.hidden = true; box.replaceChildren();
}
// 다 뽑은 뒤: 탁자에 질문 순서대로 펼치고 한 장씩 뒤집는다
async function spreadAll(picks, questions) {
  const t = $('#tray'), sp = $('#spread'); t.hidden = true; t.replaceChildren();
  sp.classList.remove('focus'); sp.hidden = false; sfx('spread');
  sp.innerHTML = picks.map(p => `<div class="sg${p.cards.length > 1 ? ' two' : ''}" data-q="${p.qIndex}"><span>${p.cards.map(c => `<b class="sc" data-art="assets/cards/${encodeURIComponent(c.name)}.webp" data-name="${esc(c.name)}" data-rev="${c.rev ? 1 : ''}"></b>`).join('')}</span><i>${p.qIndex + 1}</i></div>`).join('');
  const groups = [...sp.querySelectorAll('.sg')], scs = [...sp.querySelectorAll('.sc')];
  const faces = scs.map(paintFace);   // 내려오는 동안 앞면 그림을 한꺼번에 미리 받는다(한 장씩 받으며 뒤집으면 장마다 멈칫, 2026-10-09)
  if (MOTION) await Promise.all(groups.map((g, i) => g.animate([{ opacity: 0, transform: 'translateY(-90px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 90, easing: EASE, fill: 'backwards' }).finished));
  for (const [i, c] of scs.entries()) await flipCard(c, faces[i]);
}
function spreadFocus(qi) {
  const sp = $('#spread'); sp.classList.toggle('focus', qi != null);
  sp.querySelectorAll('.sg').forEach(g => g.classList.toggle('on', +g.dataset.q === qi));
}
// 기다리는 동안 월화가 혼잣말(4초마다 바뀜). stages = [[몇 초부터, 말 목록], …], t0부터 잰 시간에 맞는 단계에서 겹치지 않게 고른다.
// 대화창 아래에 작게 '월화가 카드를 읽는 중…'. 멈추는 함수를 돌려준다
function musing(stages, t0 = performance.now()) {
  let k = 0, used = new Set(); $('#name').textContent = '월화'; $('#next').hidden = true; $('#status').hidden = false;
  const show = () => {
    const sec = (performance.now() - t0) / 1000, lines = stages.filter(s => s[0] <= sec).at(-1)[1];
    let left = lines.filter(l => !used.has(l)); if (!left.length) { lines.forEach(l => used.delete(l)); left = lines; }
    const line = left[Math.floor(Math.random() * left.length)]; used.add(line);
    setLine(line); setFox(null, ['think', 'normal', 'amused'][k % 3]); luna(k++ % 4 < 2 ? 'luna-sleep' : 'luna-paw');   // 루나: 두 줄마다 졸기 ↔ 카드 톡톡
  };
  wol('wolhwa-read'); show(); const t = setInterval(show, 4200);
  return () => { clearInterval(t); $('#status').hidden = true; luna('luna-peek'); wol(null); };
}
const cardNames = cards => cards.map(c => `${c.name}${c.rev ? ' 역방향' : ''}`).reduce((a, b) => `${a}${josa(a, '과', '와')} ${b}`);

// ── 꼬마 스티커(2026-10-23 haru: 유화의 SD 스티커처럼, 원신·명조 이모티콘 연출) ──
// 그림 두 장을 번갈아 띄워 움직이는 것처럼. 루나는 탁자 화면(월화 얼굴이 안 보이는 곳)의 대화창 위 오른쪽에 앉아 있다: 고를 때 기웃 → 뽑으면 갸웃 → 기다릴 때 졸기·카드 톡톡.
// 보고서 끝은 월화+루나, 보관 링크를 복사하면 루나가 두루마리를 물고 간다. 움직임 줄이기면 한 장만 가만히. 누르는 데는 방해하지 않는다
// SD 월화(큰 월화 그림이 안 보이는 곳만): 기다릴 때 탁자 왼쪽에서 카드 읽기, 오늘의 운세 창 귀퉁이 윙크, 끝내 못 읽었을 때 꾸벅
const STICKERS = ['luna-peek', 'luna-curious', 'luna-sleep', 'luna-paw', 'luna-letter', 'duo-cheer', 'wolhwa-read', 'wolhwa-wink', 'wolhwa-bow', 'wolhwa-love', 'wolhwa-coin', 'wolhwa-color', 'wolhwa-scroll'];
const stkImgs = n => `<img src="assets/sticker-${n}-1.webp" alt=""><img src="assets/sticker-${n}-2.webp" alt="">`;
function stkAt(cls, n, extra = '') {
  let el = $(`#frame > .stk.${cls}`);
  if (!n) { el?.remove(); return; }
  if (!el) { $('#frame').insertAdjacentHTML('beforeend', `<div class="stk ${cls}" aria-hidden="true"></div>`); el = $(`#frame > .stk.${cls}`); }
  el.className = `stk ${cls} ${extra}`.trim();
  if (el.dataset.n !== n) { el.dataset.n = n; el.innerHTML = stkImgs(n); }
}
const luna = n => stkAt('luna', n), wol = (n, extra) => stkAt('wol', n, extra);
// 잠깐 다른 포즈를 보였다가 원래대로(링크 복사 → 두루마리)
function lunaFlash(n, ms = 2600) { const was = $('#frame > .stk.luna')?.dataset.n; luna(n); setTimeout(() => luna(was || null), ms); }
// 사과할 때 SD 월화 꾸벅(탁자가 아니어도 보인다)
async function sayBow(text) { wol('wolhwa-bow', 'any'); try { await say(text, { react: 'worried' }); } finally { wol(null); } }

// ── 결제 문(2026-10-23, ~/dev/haedalbyeol docs/결제 관문 연결 약속.md) ──
// 카드 뽑기까지는 무료(AI 0번), 펼치기(설계도) 직전에 결제. 결제창을 다녀오는 동안 이어 갈 값은 이 탭의 sessionStorage에만 두고(🔒 서버·기록·localStorage·쿠키에 두지 않음), 돌아오면 바로 지운다
const payPost = (path, body) => fetch(PAY.gate + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
async function payDoor(spreadId, picks, failed) {
  await say(failed ? LINES.payFail() : LINES.payDoor(), { react: failed ? 'normal' : 'warm', ask: true });
  for (;;) {
    await choose([{ label: '펼쳐서 읽기', value: 'go' }]);
    try {
      sessionStorage.setItem(PAY_KEY, JSON.stringify({ spreadId, picks, name: st.name, gender: st.gender, concern: st.concern, topic: st.topic, pathLabel: st.pathLabel }));   // 못 적으면(사생활 보호 창 등) 돌아와도 못 이어 가니 떠나지 않는다
      const r = await payPost('/api/pay/order', { shop: 'tarot', product: 'tarot', returnUrl: location.origin + location.pathname });   // 첫 리딩(tarot-first)은 누가 정할지 아직(관문과 정함)
      const j = await r.json();
      if (!r.ok || !j.payUrl) throw new Error(j.error || '주문을 못 만들었어요');
      trace('payGo'); location.href = j.payUrl;
      // 결제창으로 떠난다. 브라우저 '뒤로'로 이 화면이 그대로 돌아오면(bfcache) 버튼을 다시 보인다
      await new Promise(r => { const f = e => { if (e.persisted) { removeEventListener('pageshow', f); r(); } }; addEventListener('pageshow', f); });
      try { sessionStorage.removeItem(PAY_KEY); } catch {}
    } catch (e) {
      console.warn(e); try { sessionStorage.removeItem(PAY_KEY); } catch {}
      await say('결제 창이 안 열리네요. 조금 있다가 다시 눌러 주세요.', { react: 'worried', ask: true });
    }
  }
}
// 값은 관문이 날짜로 정한다(출시 기념가 기간이면 그 값, 2026-10-23 haru). 관문이 없거나 못 받으면 값 줄을 뺀다
async function payPrice() {
  await STATUS; if (!PAY.gate) return null;
  try { const j = await (await fetch(PAY.gate + '/api/pay/price?product=tarot')).json(); return Number.isFinite(j.amount) ? j.amount.toLocaleString('ko-KR') + '원' : null; } catch { return null; }
}
// 끝 알림: 보고서까지 받으면 ok:true, 다시 시도해도 실패하면 ok:false(관문이 전액 자동 취소)
// 실패 알림의 답: { state:'canceled' } 전액 취소 / { refused:'partly-delivered', resume:true } 풀이를 이미 건넴 → 보관 링크로 이어 받기(2026-10-23 haru)
async function payEnd(orderId, ok, reason) {
  try { sessionStorage.removeItem(PAY_KEY); } catch {}
  if (!orderId || !PAY.gate) return null;
  trace('payEnd', { ok });
  try { return await (await payPost('/api/pay/result', ok ? { orderId, ok } : { orderId, ok, reason })).json(); } catch (e) { console.warn(e); return null; }
}
// ── 결과 보관(2026-10-23 haru): 결제하면 관문이 보관 링크 열쇠를 준다(?keep=). 열쇠는 손님 것이라 우리 서버로 보내지 않고 화면에만(이 탭 sessionStorage) ──
const keepUrl = () => st.keep && PAY.gate ? `${PAY.gate}/r/${st.keep}` : '';
async function offerKeep() {
  if (!keepUrl()) return;
  if (await choose([{ label: '링크 복사', value: 'c' }, { label: '괜찮아요', value: 'n' }]) !== 'c') return;
  const ok = await copyText(keepUrl()); if (ok) lunaFlash('luna-letter');
  await say(ok ? LINES.keepCopied() : keepUrl(), { react: 'smile' });   // 복사가 안 되면 링크를 그대로 보여 준다
}
// 결제창에서 돌아왔을 때(?paid=주문번호 또는 ?payFail=코드): 뽑은 카드를 되살려 펼치기부터. 이어 갈 값이 없으면 false(처음부터)
async function payBack() {
  const q = new URLSearchParams(location.search), paid = q.get('paid'), keep = q.get('keep'), resume = q.get('resume'), view = q.get('view');
  history.replaceState(null, '', location.pathname);
  if (keep || resume || view) { st.keep = keep || resume || view; try { sessionStorage.setItem('hdb-keep', st.keep); } catch {} }
  if (resume) return keepResume(resume);
  if (view) return keepView(view);
  let s = null; try { s = JSON.parse(sessionStorage.getItem(PAY_KEY) || 'null'); sessionStorage.removeItem(PAY_KEY); } catch {}
  await STATUS;
  if (!s?.spreadId || !Array.isArray(s.picks) || !s.picks.length || !AI.on) {   // 다른 탭·브라우저로 돌아왔거나 값이 없음: 결제했으면 바로 취소하고 처음부터
    if (paid) { payEnd(paid, false, 'resume'); st.payCanceled = true; }
    return false;
  }
  Object.assign(st, { name: s.name || '', gender: s.gender || '', concern: s.concern || '', topic: s.topic || null, pathLabel: s.pathLabel || '', asked: true });
  trace('payBack', { paid: !!paid });
  await gate();                                                       // 페이지가 새로 열려서 한 번 눌러야 소리가 난다
  preloadQueue([...(typeof REACT_SRCS !== 'undefined' ? Object.values(REACT_SRCS).flat() : []), ...Object.values(FACE_SRCS).flat()]);
  aiStory(s.spreadId, false, { picks: s.picks, paid: paid || null });
  return true;
}
// 보고서 다시 보기(?view=열쇠, 2026-10-24): 보관된 풀이·보고서로 AI 없이 보고서 화면을 바로 연다. 카톡 같은 앱 안 브라우저에서 PDF가 안 될 때 바깥 브라우저로 넘겨 여는 곳
async function keepView(key) {
  await STATUS; if (!PAY.gate) return false;
  let k; try { const r = await fetch(`${PAY.gate}/api/keep/${encodeURIComponent(key)}`); if (!r.ok) return false; k = await r.json(); } catch { return false; }
  const P = k.parts || {}, R = P.report;
  if (!R?.spreadId) return false;
  const spread = (await (await fetch('/api/spreads')).json())[R.spreadId]; if (!spread) return false;
  const items = Object.keys(P).filter(j => /^q\d+$/.test(j)).sort((a, b) => a.slice(1) - b.slice(1)).map(j => ({ q: P[j].q, cards: P[j].cards || [], headline: P[j].headline, keypoint: P[j].keypoint, body: P[j].body }));
  const c = P.concern;
  Object.assign(st, { keep: key, name: '', concern: '', asked: true, topic: TOPIC_OF(R.spreadId) });
  st.aiReport = { spread, items, concern: c ? { headline: c.headline, keypoint: c.keypoint, body: c.body } : null, report: R };
  trace('keepView');
  await gate();
  await openReport();
  reportEnd();
  return true;
}
// 보관 페이지의 [이어서 받기](?resume=열쇠): 관문에 맡긴 재료(카드·성별·고민·설계도)와 이미 받은 풀이로 멈춘 곳부터. 이름은 맡기지 않아서 '손님'으로 부른다
const TOPIC_OF = id => /^work_/.test(id) ? 'work' : /^money_/.test(id) ? 'money' : /^study_/.test(id) ? 'study' : id === 'talk' ? 'talk' : 'love';
async function keepResume(key) {
  await STATUS; if (!AI.on || !PAY.gate) return false;
  let m, k;
  // 끊긴 직후 바로 오면 서버가 아직 재료를 맡기는 중일 수 있다(관문 inProgress에 있음) → 1분까지 기다린다(2026-10-24 시험에서 찾음)
  for (let i = 0; i < 12; i++) {
    try {
      const [a, b] = await Promise.all([fetch(`${PAY.gate}/api/keep/${encodeURIComponent(key)}/material`), fetch(`${PAY.gate}/api/keep/${encodeURIComponent(key)}`)]);
      if (!b.ok) return false;
      k = await b.json();
      if (a.ok) { m = await a.json(); break; }
      if (!k.inProgress?.length) return false;
    } catch { return false; }
    await wait5();
  }
  if (!m) return false;
  const mt = m.material;
  if (!mt?.spreadId || !Array.isArray(mt.picks) || !mt.plan || !k.canResume) return false;
  Object.assign(st, { name: '', gender: mt.gender || '', concern: mt.concern || '', topic: TOPIC_OF(mt.spreadId), pathLabel: '', asked: true });
  trace('keepResume', { parts: Object.keys(k.parts || {}).length });
  await gate();
  preloadQueue([...(typeof REACT_SRCS !== 'undefined' ? Object.values(REACT_SRCS).flat() : []), ...Object.values(FACE_SRCS).flat()]);
  aiStory(mt.spreadId, false, { picks: mt.picks, paid: m.orderId, plan: mt.plan, parts: k.parts || {} });
  return true;
}

async function aiStory(spreadId, jump = false, back = null) {   // jump(점검용): 'shuffle' 첫 카드 섞기로 바로, 'spread' 8장을 저절로 뽑아 다 펼치기로 바로. back: 결제창에서 돌아옴 { picks, paid }
  TRAIT.reset();
  const spread = (await (await fetch('/api/spreads')).json())[spreadId], Q = spread.questions, total = Q.length;
  const state = { deck: shuffle(DECK78), fan: [], items: [] };
  state.fan = state.deck.splice(0, 20);
  if (!jump && !back) {
    // 오늘 볼 질문을 먼저 소개하고, 그 밖에 더 궁금한 것을 받는다(질문과 겹치는 고민을 줄임, 2026-10-10 사용자)
    await say((LINES[spread.pickLine] || LINES.solo)(), { react: 'amused', ask: !!spread.concernFirst });   // 세부 주제를 골랐을 때의 한마디(solo·crush·…)
    if (spread.concernFirst) {                                     // 자유 고민: 고민이 곧 주제라 먼저 받는다(없으면 주제 고르기로)
      st.concern = await askText({ placeholder: '어떤 고민인지 편하게 적어 주세요', skip: '다른 거 볼래요', go: '이걸 봐 주세요' });
      if (!st.concern) return story();
      await say(LINES.concernAck(nim()), { react: 'think' });
    }
    await say(LINES.questionsIntro(['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][total] || total), { react: 'normal' });
    const pv = spread.preview || [], pvSet = Array.isArray(pv[0]) ? pv[Math.floor(Math.random() * pv.length)] : pv;   // 같은 정보를 다른 말투로 여러 벌(무작위 하나)
    for (const line of pvSet) await say(line, { react: 'smile' });
    { const price = await payPrice(); if (price) await say(LINES.pricePreview(price), { react: 'normal' }); }   // 값을 미리 알린다(다 뽑은 뒤 결제 문에서 놀라지 않게)
    if (!spread.concernFirst) {
      await say(LINES.askConcern(), { react: 'normal', ask: true });
      await say(LINES.concernOne(), { react: 'smile', ask: true });   // '하나만' 덧붙이기(여러 개 적으면 지침이 맨 앞 하나만 푼다)
      st.concern = await askText({ placeholder: '위 질문 말고 더 궁금한 게\n있으면 적어 주세요', skip: '그냥 볼게요', go: '이것도 봐 주세요' });
      if (st.concern) await say(LINES.concernAck(nim()), { react: 'think' });
      else await say(LINES.concernSkip(), { react: 'smile' });
    }
    SOUND.cue('concernDone');   // 마지막 버튼(지금은 그대로, sound-cues.json)
    SOUND.cue('questionsIntro');   // 여기서부터 살롱 곡이 8초 동안 25%까지 천천히 줄어듦 → 첫 질문 '몇 장으로 볼게요'에서 남은 소리를 1초 동안 마저 줄여 끔
    await say(LINES.startDraw(), { react: 'normal' });
  }
  dailyLoveFirst = { newlove: 'single', crush: 'some', couple: 'couple' }[spreadId] || null;
  preloadQueue(STICKERS.flatMap(n => [1, 2].map(f => `assets/sticker-${n}-${f}.webp`)));   // 꼬마 스티커(뒤에서 미리)
  RUN = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T'); trace('start', { spreadId, total, concern: !!st.concern, jump: jump || undefined });
  const base = { spreadId, concern: st.concern, name: st.name, gender: st.gender, run: RUN };
  const picks = [], notes = [], USE_NOTES = false;
  let noteChain = Promise.resolve(), planStarted = false;
  $('#tray').replaceChildren(); $('#spread').hidden = true;

  // 점검 'spread': 질문마다 카드를 저절로 뽑아 쟁반에 엎어 두고 탁자 화면에서 바로 다 펼치기로(주제 곡도 켬). 결제창에서 돌아왔을 때(back)는 뽑아 둔 카드로 같은 자리에
  const ready = jump === 'spread' || !!back;
  if (ready) {
    for (let qi = 0; qi < total; qi++) { const cards = back ? back.picks[qi]?.cards || [] : Array.from({ length: Q[qi].cards || 1 }, () => ({ name: state.deck.pop(), rev: Math.random() < 0.3 })); picks.push({ qIndex: qi, cards }); trayAdd(qi, cards); }
    SOUND.topic(st.topic || null, 0, true); SOUND.cue('firstShuffle');
    await sceneChange(() => { $('#frame').classList.add('picking'); }); luna('luna-peek');
  }
  // 1) 질문마다 카드를 뽑는다. 풀이는 아직 안 하고 쟁반에 엎어 둔다. 뒤에서는 카드마다 메모를 이어 쓴다
  for (let qi = ready ? total : 0; qi < total; qi++) {
    const q = Q[qi], n = q.cards || 1, qFace = drawFace('question');   // 질문 소개와 장 수 말은 한 표정으로(두 줄 사이에 그림이 또 바뀌면 튐)
    setProgress(qi, total);
    if (jump === 'shuffle' && qi === 0) {}                     // 점검: 질문·장 수 대사 없이 바로 섞기
    else if (qi === 0) {
      await say(LINES.question(ORD[qi] || (qi + 1) + '번째', q.q, qi === 0), { react: qFace });
      // 첫 질문 '몇 장으로 볼게요': 살롱 곡이 1초 동안 작아지며 꺼지고, 다 꺼지는 순간 탭 없이 저절로 넘어가 섞는다(그 전에 탭해도 꺼질 때까지 기다림)
      const quiet = Promise.resolve(SOUND.cue('cardsAnnounce'));
      const line = say(LINES.cards(['', '한', '두', '세'][n] || n, q.why), { react: qFace });
      quiet.then(() => { if (waiting) waiting(); if (waiting) waiting(); });   // 글자 다 보이기 → 넘기기
      await Promise.all([line, quiet]);
    } else { await say(LINES.question(ORD[qi] || (qi + 1) + '번째', q.q, qi === 0), { react: qFace }); await say(LINES.cards(['', '한', '두', '세'][n] || n, q.why), { react: qFace }); }
    $('#next').hidden = true;
    await sceneChange(() => { $('#frame').classList.add('picking'); setLine(qi === 0 ? LINES.shuffleFirst() : (TRAIT.try('luna', 0.3) ? LINES.luna() : LINES.redeal())); });
    if (qi === 0) { SOUND.topic(st.topic || null, 0, true); SOUND.cue('firstShuffle'); await shuffleMotion(); }   // 섞는 순간: 기본은 주제 곡(assets/bgm/<주제>.mp3)
    layFan(state); await dealMotion(); luna('luna-peek');
    setLine(LINES.pick(['', '한', '두', '세'][n] || n));
    const cards = await pickFromFan(state, n);
    trace('picked', { q: qi + 1, cards: cards.map(c => c.name + (c.rev ? '(역)' : '')) });
    picks.push({ qIndex: qi, cards });
    const sofar = picks.slice();
    // 뽑을 때마다 쓰던 숨은 메모는 2026-10-20부터 끔(USE_NOTES): 근거 검사의 설계도는 모두 메모 없이 같은 품질, 리딩 한 번 약 $0.42(호출 8번) 절약, 결제 전 AI 호출 0
    if (USE_NOTES) noteChain = noteChain.then(() => planStarted ? null : api('/api/note', { ...base, qIndex: qi, cards, picks: sofar, notes: notes.map(x => x || '(메모 없음)') }).then(r => { notes[qi] = r.text; }, e => console.warn(e)));
    // 뽑은 카드는 바로 보여 준다(뜻은 아직). 탭하면 위쪽 쟁반으로 가서 엎어진다
    clearTable();
    luna('luna-curious');
    await showDrawn(cards);
    if (qi === 0) resetCutIns();
    const reaction = drawFace(cardMood(cards));
    const closeCut = isBigCard(cards) ? cutIn(reaction) : reactCut(reaction);
    try { await say(LINES.drawn(cardNames(cards)), { react: reaction }); }   // 좋은 카드엔 설렘, 무거운 카드엔 진지하게
    finally { await closeCut(); }
    $('#next').hidden = true;
    await drawnToTray(qi, cards); luna('luna-peek');
    if (qi + 1 < total) await sceneChange(() => { $('#frame').classList.remove('picking'); reshuffleFaces(); });
  }
  setProgress(total, total);
  clearTable();
  if (!back) await say(LINES.allPicked(), { react: 'warm' });
  else if (back.plan) await say(LINES.keepResume(), { react: 'smile' });
  else if (back.paid) { await say(LINES.payBack(), { react: 'smile' }); if (keepUrl()) { await say(LINES.keepLink(), { react: 'warm', ask: true }); await offerKeep(); } }
  $('#next').hidden = true;
  // 결제 문: 관문이 켜져 있을 때만. 결제창에서 그냥 돌아왔으면(payFail) 같은 카드로 다시 문 앞
  await STATUS;
  const orderId = back?.paid || (PAY.gate ? await payDoor(spreadId, picks, !!back) : null);
  if (orderId) base.orderId = orderId;
  // 결제한 리딩이 끝내 실패: 아무것도 못 건넸으면 관문이 전액 취소, 하나라도 건넸으면 보관 링크로 이어 받기(2026-10-23 haru)
  const failPaid = async reason => {
    const r = await payEnd(orderId, false, reason);
    if (r?.refused === 'partly-delivered') { wol('wolhwa-bow', 'any'); await say(LINES.keepLater(), { react: 'worried', ask: !!keepUrl() }); wol(null); await offerKeep(); }
    else if (r?.state === 'canceled') await sayBow(LINES.payCanceled());
    else await sayBow('카드가 잘 안 읽히네요. 조금 있다가 다시 와 주세요.');
  };
  const doneJob = text => ({ text, done: true, err: null, subs: new Set(), run() {} });   // 이어 받기: 이미 받은 설계도·풀이

  // 2) 다 뽑으면 설계도를 만들기 시작하고, 그동안 카드를 전부 펼친다
  // 메모가 밀려 있어도 기다리지 않는다: 설계도는 모든 카드를 다시 보므로, 써 둔 메모만 참고로 넘긴다
  planStarted = true; trace('aiStart', { job: 'plan' }); const planT0 = performance.now();
  // 설계도는 써지는 대로 받는다(/api/plan-stream). 질문 몫(@배정N)이 나오는 대로 그 질문 풀이를 시작해서, 설계도가 다 끝날 때까지 기다리지 않는다
  const planJob = back?.plan ? doneJob(back.plan) : fetchJob({ ...base, picks, notes: Array.from({ length: total }, (_, i) => notes[i] || '(메모 없음)') }, 'plan', '/api/plan-stream');
  preloadQueue([...SCENES_HAVE].map(id => `assets/scene-${id}.webp`));   // 풀이를 기다리는 동안 웹툰 장면 그림
  planJob.run();
  await spreadAll(picks, Q);
  trace('spreadDone');
  // 설계도를 기다리는 동안 오늘의 운세 한 장(덤). 고르는 동안에도 설계도는 뒤에서 써진다
  if (!jump && !back?.plan) await dailyCard(picks);
  const stop = musing(LINES.planWait(nim()), planT0);
  try { await planPart(planJob, 0); } catch (e) { stop(); console.warn(e); if (orderId) { await failPaid('plan'); return story(); } await sayBow('카드가 잘 안 읽히네요. 처음부터 다시 볼게요.'); return story(); }
  stop(); trace('planQ1Ready');

  // 3) 풀이를 순서대로 미리 받아 둔다(동시에 세 개). 질문마다 설계도의 그 질문 몫까지 나오면 시작한다. 고민 정리·보고서는 설계도 전체를 쓴다
  const body = { ...base, picks };
  const had = job => back?.parts?.[job]?.text;   // 이어 받기: 보관에 있는 풀이는 다시 만들지 않는다
  const jobs = picks.map((p, i) => had('q' + (p.qIndex + 1)) ? doneJob(had('q' + (p.qIndex + 1))) : fetchJob(async () => ({ ...body, plan: await planPart(planJob, i), qIndex: p.qIndex, cards: p.cards }), 'q' + (p.qIndex + 1)));
  const concernCh = st.concern && !spread.concernFirst;   // 자유 고민은 질문 전체가 고민 풀이라 '고민 정리' 장을 따로 두지 않는다
  if (concernCh) jobs.push(had('concern') ? doneJob(had('concern')) : fetchJob(async () => ({ ...body, plan: await planFull(planJob), mode: 'concern' }), 'concern'));
  jobQueue(jobs, 3);
  // 풀이가 다 써지면 보고서도 뒤에서 바로 만든다(손님이 마지막 장을 읽는 동안)
  const ended = j => new Promise(r => { if (j.done) r(); else j.subs.add(() => j.done && r()); });
  const concernOf = () => { if (!concernCh || !jobs[total]) return null; const R = parseReading(jobs[total].text, true); return { headline: R.headline, keypoint: R.keypoint, body: R.body }; };   // 고민 정리 장도 보고서에 넣는다
  const reportCall = async () => { const { res, got } = await fetchOrKept('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reportBody()) }, 'report'); if (got != null) return { data: got }; const j = await res.json(); if (!res.ok) throw new Error(j.error || '실패'); return j; };
  const reportBody = () => ({ ...base, plan: planJob.text, concernAnswer: concernOf(), items: picks.map((p, i) => { const R = parseReading(jobs[i].text, true); return { q: Q[p.qIndex].q, cards: p.cards, headline: R.headline, keypoint: R.keypoint, body: R.body }; }) });
  const reportP = Promise.all([...jobs.map(ended), planFull(planJob)]).then(() => (trace('aiStart', { job: 'report' }), reportCall().catch(e => orderId ? (trace('aiRetry', { job: 'report' }), reportCall()) : Promise.reject(e)))).then(r => (trace('aiDone', { job: 'report' }), r));   // 결제한 리딩은 한 번 더
  reportP.catch(() => {});
  await say(LINES.planDone(), { react: 'smile' });

  // 4) 질문마다: 펼친 카드 중 그 질문 카드를 키우고 → 웹툰으로 풀이
  for (let qi = 0; qi < total; qi++) {
    const q = Q[qi], cards = picks[qi].cards;
    if (had('q' + (qi + 1))) { const R = parseReading(jobs[qi].text, true); state.items.push({ q: q.q, cards, headline: R.headline, keypoint: R.keypoint, body: R.body, sections: R.sections }); continue; }   // 이미 받은 질문은 건너뛴다(보관 링크에서 다시 볼 수 있음)
    setProgress(qi, total); spreadFocus(qi);
    await say(LINES.revealQ(ORD[qi] || (qi + 1) + '번째', cardNames(cards)), { react: 'think' });
    const last = qi + 1 === total;
    let view;
    await sceneChange(() => { view = openWebtoon({ qi, total, q: q.q, cards, nextLabel: last ? (concernCh ? '고민 정리 보기' : '총정리 보고서 받기') : null }); });
    let R;
    try { R = await watch(jobs[qi], r => view.live(r)); }
    catch (e) { console.warn(e); if (orderId) { closeWebtoon(); spreadFocus(null); await failPaid('q' + (qi + 1)); return story(); } view.error(); await new Promise(r => setTimeout(r, 2500)); closeWebtoon(); spreadFocus(null); return story(); }
    state.items.push({ q: q.q, cards, headline: R.headline, keypoint: R.keypoint, body: R.body, sections: R.sections });
    await view.finish(R);
  }
  setProgress(total, total); spreadFocus(null);

  // 5) 적어 준 고민이 있으면 마지막 장: 카드 풀이를 바탕으로 고민에 답한다
  if (concernCh && had('concern')) { const R = parseReading(jobs[total].text, true); state.concern = { headline: R.headline, keypoint: R.keypoint, body: R.body }; }
  else if (concernCh) {
    await say(LINES.concernIntro(), { react: 'warm' });
    let view;
    await sceneChange(() => { view = openWebtoon({ qi: total, total, q: short(st.concern, 70), cards: [], label: '고민 정리', nextLabel: '총정리 보고서 받기' }); });
    try { const R = await watch(jobs[total], r => view.live(r)); state.concern = { headline: R.headline, keypoint: R.keypoint, body: R.body }; await view.finish(R); }
    catch (e) { console.warn(e); closeWebtoon(); }
  }

  setProgress(null); $('#spread').hidden = true; $('#frame').classList.remove('picking'); clearTable(); luna(null);
  await say(LINES.done(nim()), { react: 'warm' });
  if (TRAIT.try('selfCard', LINES.selfCardChance())) await say(LINES.selfCard(), { react: 'amused' });
  trace('reportWait');
  const stopR = waitLine('정리하고 있어요');
  let rep;
  try { rep = await reportP; } catch (e) { stopR(); if (orderId) { await failPaid('report'); return story(); } await sayBow('정리하다가 뭔가 꼬였어요. 조금 있다가 다시 눌러 주세요.'); return; }
  stopR(); trace('reportReady'); payEnd(orderId, true);
  st.aiReport = { spread, items: state.items, concern: state.concern || null, report: rep.data };
  $('#log-btn').hidden = false; $('#log-btn').textContent = '총정리 보기';
  $('#log-btn').onclick = () => openReport();
  await openReport();
  return reportEnd();
}
// 보고서를 닫으면 월화가 마무리 인사 → [총정리 다시 보기]·[처음으로]·[해·달·별로]. 다시 보고 닫으면 또 이 메뉴
// (2026-10-25 haru: 보고서 안의 [처음으로]·[해·달·별로]는 닫은 뒤 메뉴와 같아서 빼고, 닫기 → 마무리 인사 → 고르기로)
async function reportEnd() {
  for (;;) {
    await say(LINES.afterReport(), { react: 'warm', ask: true });
    const e = await choose([{ label: '총정리 다시 보기', value: 'r' }, { label: '처음으로', value: 'a' }, ...(homeUrl() ? [{ label: '해·달·별로', value: 'h' }] : [])]);
    if (e === 'h') return leaveHome();
    if (e === 'a') { st.concern = ''; return story(); }
    await openReport();
  }
}

function openZoomCards(title, q, cards) {
  $('#chapter').textContent = title;
  $('#zoom-body').innerHTML = `<p class="scene-q">${esc(q)}</p><div class="trio">${cards.map(c => `<div class="mini${c.rev ? ' rev' : ''}"><span>${cardMark(c.name)}</span>${c.name}${c.rev ? '<small>(역)</small>' : ''}</div>`).join('')}</div>`;
  $('#zoom').hidden = false;
}

// PDF로 저장: 브라우저 인쇄 창을 연다(대상에서 'PDF로 저장'). 인쇄용 화면은 style.css의 @media print
// 원본 그림(카드 1024×1536 등)을 그대로 인쇄하면 PDF가 수십 MB가 되므로, 저장하는 동안만 인쇄 크기의 JPEG로 바꿔 넣는다
async function shrinkFor(url, w) {
  const im = new Image(); im.src = url; await im.decode();
  const k = Math.min(1, w / im.naturalWidth), c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .86);
}
// 인쇄 전용 문서: 화면의 웹툰 대신 A4에 맞춘 보고서 지면을 따로 만든다(여백·빈 페이지 없이 촘촘하게)
// 인연 프로필 항목의 태그(한눈에 보기용, 보고서 AI가 값에서 뽑은 짧은 낱말). 예전 보고서처럼 없으면 빈칸
const tagChips = p => { const t = (p.tags || []).map(x => String(x).trim()).filter(Boolean).slice(0, 4); return t.length ? `<span class="tg-row">${t.map(x => `<i class="tg">${esc(x)}</i>`).join('')}</span>` : ''; };
async function buildPrintDoc() {
  const { spread, items, concern, report: R } = st.aiReport, d = new Date();
  const date = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  const safe = async (url, w) => { try { return await shrinkFor(url, w); } catch { return null; } };
  const hero = await safe(sceneSrc('report'), 1400), face = await safe('assets/fox-head.png', 160);
  const art = {};
  for (const c of items.flatMap(it => it.cards)) if (!(c.name in art)) art[c.name] = await safe(`assets/cards/${encodeURIComponent(c.name)}.webp`, 220);
  const card = c => art[c.name]
    ? `<span class="pd-card${c.rev ? ' rev' : ''}"><img src="${art[c.name]}" alt=""></span>`
    : `<span class="pd-card pd-noart${c.rev ? ' rev' : ''}"><b>${cardMark(c.name)}</b><i>${esc(c.name)}</i></span>`;
  const cardNames = cs => cs.map(c => `${esc(c.name)}${c.rev ? ' (역)' : ''}`).join(' · ');
  return `<header class="pd-head">
      <div><p class="pd-kicker">월화 타로 · ${st.name ? esc(st.name) + '님의 ' : ''}총정리 보고서</p><h1>${esc(spread.title)}</h1>
        <p class="pd-meta">${date}</p></div>
      <img class="pd-sign" src="assets/sign.webp" alt="월화의 서명"></header>
    ${hero ? `<figure class="pd-hero"><img src="${hero}" alt=""></figure>` : ''}
    <section class="pd-say">${face ? `<img class="pd-face" src="${face}" alt="">` : ''}<div><p class="pd-label">월화의 총평</p><p>${esc(R.overview)}</p></div></section>
    <div class="pd-grid">
      <section class="pd-box pd-night"><p class="pd-label">${esc(spread.profile?.title || '인연 프로필')}</p><dl>${R.profile.map(p => `<dt>${esc(p.label)}${tagChips(p)}</dt><dd>${esc(p.value)}</dd>`).join('')}</dl></section>
      <section class="pd-box"><p class="pd-label">앞으로의 흐름</p><ol class="pd-flow">${R.flow.map(f => `<li><b>${esc(f.when)}</b> ${esc(f.what)}</li>`).join('')}</ol></section>
      <section class="pd-box"><p class="pd-label">지금부터 할 일</p><ul class="pd-todo">${R.todo.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section class="pd-box"><p class="pd-label">조심할 점</p><ul class="pd-watch">${R.watch.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
    </div>
    <blockquote class="pd-closing">${esc(R.closing)}<cite>— 월화</cite></blockquote>
    <h2 class="pd-h2">한눈에 보기</h2>
    <table class="pd-table">${items.map((it, i) => `<tr><td class="pd-no">${i + 1}</td><td class="pd-cards"><div class="pd-cs">${it.cards.map(card).join('')}</div></td>
      <td><b>${esc(it.q)}</b><span>${cardNames(it.cards)}</span><p>${esc(it.keypoint || it.headline)}</p></td></tr>`).join('')}</table>
    <h2 class="pd-h2">질문별 전체 풀이</h2>
    ${items.map((it, i) => `<article class="pd-q"><h3><em>${i + 1}</em>${esc(it.q)}</h3><p class="pd-cardline">${cardNames(it.cards)}</p>
      <p class="pd-headline">${esc(it.headline)}</p><div class="pd-body">${paras(it.body)}</div></article>`).join('')}
    ${concern ? `<article class="pd-q"><h3><em>✦</em>고민 정리</h3>${st.concern ? `<p class="pd-cardline">${esc(st.concern)}</p>` : ''}<p class="pd-headline">${esc(concern.headline)}</p><div class="pd-body">${paras(concern.body)}</div></article>` : ''}
    ${keepUrl() ? `<p class="pd-keep">다시 보기(1년): ${esc(keepUrl())}</p>` : ''}`;
}
// 카톡·인스타·네이버 같은 앱 안 브라우저는 인쇄(PDF로 저장)를 막아 둔다 → 같은 보고서를 기본 브라우저로 넘겨 연다(2026-10-24 haru: 「어디서도 다운로드 받을 수 있게」)
const INAPP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(navigator.userAgent);
function pdfOutside(btn) {
  const h = homeUrl(), u = keepUrl() ? `${location.origin}${location.pathname}?view=${encodeURIComponent(st.keep)}${h ? '&home=' + encodeURIComponent(h) : ''}` : location.origin + location.pathname;
  const label = btn.innerHTML;
  if (/KAKAOTALK/i.test(navigator.userAgent)) {   // 카톡이 기본 브라우저로 연다
    btn.lastChild.textContent = '브라우저로 여는 중…';
    const out = x => { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(x); };
    // 폰 시험 링크에서는 문지기가 기본 브라우저를 모르는 기기로 본다 → 한 번 쓰는 넘겨주기 표를 붙여 넘긴다(remote-gate.mjs /__handoff, 메인과 같은 방식)
    if (/\.trycloudflare\.com$/.test(location.hostname)) fetch('/__handoff', { method: 'POST' }).then(r => r.json()).then(({ t }) => { const x = new URL(u); x.searchParams.set('hand', t); out(x.href); }).catch(() => out(u));
    else out(u);
  }
  else btn.lastChild.textContent = '메뉴에서 다른 브라우저로 열어 주세요';
  setTimeout(() => { btn.innerHTML = label; }, 4000);
}
async function savePdf() {
  if (INAPP) return pdfOutside($('#rp-pdf'));
  const btn = $('#rp-pdf'), label = btn.innerHTML; btn.disabled = true; btn.lastChild.textContent = '준비 중…';
  let doc = $('#print-doc'); if (!doc) { doc = document.createElement('section'); doc.id = 'print-doc'; document.body.append(doc); }
  // 그림이 다 들어올 때까지 기다린다(숨긴 상자 안의 그림은 decode()가 끝나지 않을 수 있어 load 이벤트 + 3초 상한)
  const loaded = im => Promise.race([new Promise(r => im.complete ? r() : (im.onload = im.onerror = r)), new Promise(r => setTimeout(r, 3000))]);
  try { doc.innerHTML = await buildPrintDoc(); await Promise.all([...doc.querySelectorAll("img")].map(loaded)); }
  catch (e) { btn.disabled = false; btn.innerHTML = label; alert('PDF를 준비하지 못했어요: ' + e.message); return; }
  const title = document.title, d = new Date();
  document.title = `월화 타로 총정리 보고서 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;   // 저장 파일 이름
  const done = () => { document.title = title; doc.innerHTML = ''; btn.disabled = false; btn.innerHTML = label; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  print();
}

// 총정리 보고서: 웹툰처럼 내려 읽는 마무리 화면. 끝 버튼은 [PDF로 저장]·[닫기]뿐, 닫으면 돌아감(그다음 메뉴는 reportEnd)
// 오늘의 운세(재미로 보는 한 장, app/daily-data.js). 심심풀이는 시간을 보내려고 보는 것이라(2026-10-17 사용자)
// 손님이 직접 섞인 카드에서 한 장 뽑고 → 월화가 잠깐 보고 한 줄 뜻 → 총운·애정운·일·금전운·오늘의 색을 하나씩:
// 대화로 '~를 볼까요?' → 양피지에 그 운 하나 → 닫으면 다시 대화. 마지막에 다 모은 양피지를 한 번 더(2026-10-17 사용자: 대화창에 다 넣지 말 것)
// 하나씩 볼 때는 무대 위 작은 양피지 창(팝업), 다 모은 것만 전체 화면(2026-10-17 사용자)
// 오늘의 색: 운세 글의 색 이름(50개) → 화면에 보여 줄 색 견본. 이름이 표에 없으면 견본 없이 글만(2026-10-18 haru)
const COLOR_HEX = { '짙은 주황색': '#c85a12', '짙은 회갈색': '#6b5a4e', '옅은 남색': '#7d8cc4', '맑은 하늘색': '#7ec8ef', '연한 하늘색': '#b5dcf2', '탁한 하늘색': '#8eaebf',
  '밝은 레몬색': '#f6e65a', '선명한 진홍색': '#d0142f', '탁한 다홍색': '#b8573f', '옅은 은회색': '#d3d5d8', '연한 올리브색': '#b5b67a', '짙은 진홍색': '#8e0f24',
  '짙은 벽돌색': '#8a3a26', '짙은 자주색': '#5e1f55', '맑은 장밋빛 분홍색': '#f08aa6', '탁한 장밋빛 분홍': '#c48a96', '짙은 남색': '#1f2a5c', '따뜻한 호박색': '#e0a03a',
  '짙은 호박색': '#b9741a', '짙은 남회색': '#3c4558', '진한 호박색': '#c9821f', '짙은 먹색': '#2a2828', '짙은 와인색': '#5e1a2b', '밝은 해바라기색': '#f7c623',
  '옅은 귤색': '#f8c48a', '맑은 금빛 노란색': '#f2c94c', '탁한 금색': '#b39b5e', '선명한 주홍색': '#ef4a24', '탁한 주황색': '#c27a45', '밝은 주황색': '#ff9a3c',
  '따뜻한 주황색': '#ec8a3c', '선명한 주황색': '#ff7a12', '옅은 주황색': '#f9bd86', '옅은 하늘색': '#c7e6f7', '탁한 남색': '#4a5478', '흐린 하늘색': '#a9c4d4',
  '탁한 청회색': '#6f8290', '깊은 남색': '#18224a', '맑은 은회색': '#c4cad1', '연한 회청색': '#a7b6c4', '옅은 회색': '#cfcfcf', '차가운 은회색': '#b7c0c8',
  '옅은 회청색': '#b8c5d0', '흐린 회청색': '#93a3b0', '밝은 은회색': '#dfe3e7', '짙은 회색': '#4d4d4f', '짙은 회청색': '#46566a', '짙은 올리브색': '#59592b',
  '짙은 고동색': '#4a2e1c', '따뜻한 황토색': '#c48a3e' };
// 애정운은 세 경우(연애 중·썸·혼자)를 이름표와 함께 다 보여 준다. 본 리딩에서 고른 연애 상황이 있으면 그 줄을 맨 위로(2026-10-23 haru: 솔로가 빠져 있었다)
const LOVE_TAG = { couple: '연애 중', some: '썸', single: '혼자' };
let dailyLoveFirst = null;
const dailyText = (h, t) => typeof t === 'object'
  ? Object.keys(LOVE_TAG).sort((a, b) => (b === dailyLoveFirst) - (a === dailyLoveFirst)).filter(k => t[k]).map(k => `<p class="dlove"><b>${LOVE_TAG[k]}</b>${esc(t[k])}</p>`).join('')
  : (h === '오늘의 색' && COLOR_HEX[t] ? `<i class="dcolor" style="--c:${COLOR_HEX[t]}"></i>` : '') + `<p${t.length < 20 ? ' class="short"' : ''}>${esc(t)}</p>`;
// 운마다 SD 월화 포즈가 다르다(2026-10-24 haru): 총운 윙크 · 애정운 손하트 · 일·금전운 금화 · 오늘의 색 팔레트 · 다 모은 운세 두루마리
const DAILY_STK = { '총운': 'wolhwa-wink', '애정운': 'wolhwa-love', '일·금전운': 'wolhwa-coin', '오늘의 색': 'wolhwa-color' };
function dailyPop(c, [h, t]) {
  const pop = document.createElement('div'); pop.className = 'dpop';
  pop.innerHTML = `<div class="dpop-sheet"><p class="dpop-kick">오늘의 운세 · ${esc(c.name)}${c.rev ? ' 역방향' : ''}</p>
    <div class="rp-box"><h3>${esc(h)}</h3>${dailyText(h, t)}</div><button type="button" class="choice">다음</button><div class="stk wink" aria-hidden="true">${stkImgs(DAILY_STK[h] || 'wolhwa-wink')}</div></div>`;
  $('#frame').append(pop); sfx('page');
  return new Promise(res => { pop.querySelector('button').onclick = () => { pop.classList.add('out'); setTimeout(() => { pop.remove(); res(); }, 220); }; });
}
// 다 모은 운세: 같은 작은 창, 안에서 스크롤, 닫기는 머리 줄 오른쪽 ✕(2026-10-18 haru — 전체 화면 장은 맨 아래 닫기 버튼이 비뚤었다)
function dailySummary(c, parts) {
  const pop = document.createElement('div'); pop.className = 'dpop dsum';
  pop.innerHTML = `<div class="dpop-sheet">
    <div class="dsum-head"><img class="dsum-card${c.rev ? ' rev' : ''}" src="assets/cards/${encodeURIComponent(c.name)}.webp" alt=""><div><p class="dpop-kick">오늘의 운세</p><h2>${esc(c.name)} ${c.rev ? '역방향' : '정방향'}</h2></div><button type="button" class="dsum-x" aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="rp-box dsum-body">${parts.map(([h, t]) => `<h3>${esc(h)}</h3>${dailyText(h, t)}`).join('')}</div><div class="stk wink scroll" aria-hidden="true">${stkImgs('wolhwa-scroll')}</div></div>`;
  $('#frame').append(pop); sfx('page');
  return new Promise(res => { pop.querySelector('.dsum-x').onclick = () => { pop.classList.add('out'); setTimeout(() => { pop.remove(); res(); }, 220); }; });
}
async function dailyRitual(pool) {
  const deck = shuffle(pool), dst = { fan: deck.slice(0, 20), deck: deck.slice(20) };
  const sp = $('#spread'), had = !sp.hidden; sp.hidden = true;            // 기다리는 동안이면 펼쳐 둔 본 리딩 카드는 잠시 치운다
  $('#next').hidden = true;
  await sceneChange(() => { $('#frame').classList.add('picking'); setLine(LINES.dailyShuffle()); });
  await shuffleMotion(); layFan(dst); await dealMotion();
  setLine(LINES.dailyPick());
  const [c] = await pickFromFan(dst, 1);
  trace('dailyPicked', { card: c.name + (c.rev ? '(역)' : '') });
  clearTable(); await showDrawn([c]);
  const e = DAILY[c.name]?.[c.rev ? '역' : '정'];
  if (!had) resetCutIns();   // 덤 운세는 본 리딩 횟수를 이어 쓴다
  const reaction = drawFace(cardMood([c]));
  const closeCut = isBigCard([c]) ? cutIn(reaction) : reactCut(reaction);
  try { await say(LINES.dailyDrawn(c.name + (c.rev ? ' 역방향' : '')), { react: reaction }); }
  finally { await closeCut(); }
  if (e) {
    await say(LINES.dailyMuse(), { react: 'think' });
    await say(`“${e.card}”`, { react: 'amused' });
    $('#showcase').hidden = true; $('#showcase').replaceChildren();
    const parts = [['총운', e.total, LINES.dailyTotal, 'normal'], ['애정운', e.love, LINES.dailyLove, 'amused'], ['일·금전운', e.work, LINES.dailyWork, 'normal'], ['오늘의 색', e.color, LINES.dailyColor, 'smile']];
    for (const [h, t, line, react] of parts) { await say(line(), { react }); await dailyPop(c, [h, t]); }
    trace('dailyAll'); await say(LINES.dailyAll(), { react: 'smile' });
    await dailySummary(c, parts.map(([h, t]) => [h, t]));
  }
  $('#showcase').hidden = true; $('#showcase').replaceChildren();
  if (had) sp.hidden = false; else await sceneChange(() => { $('#frame').classList.remove('picking'); });
  trace('dailyDone');
}
// 오늘의 운세 글(daily-data.js, 약 220KB)은 운세를 볼 때만 받는다(2026-10-20, 첫 화면 가볍게)
let dailyLoad = null;
const loadDaily = () => dailyLoad ||= new Promise(r => { if (typeof DAILY !== 'undefined') return r(); const sc = document.createElement('script'); sc.src = 'daily-data.js'; sc.onload = sc.onerror = () => r(); document.head.append(sc); });
// 기다리는 동안 덤으로 한 장: 이번 리딩에 나온 카드는 빼고 무작위, 역방향 30%
async function dailyCard(picks) {
  await loadDaily();
  const used = new Set(picks.flatMap(p => p.cards.map(c => c.name)));
  const pool = Object.keys(typeof DAILY !== 'undefined' ? DAILY : {}).filter(n => !used.has(n));
  if (!pool.length) return;
  await say(LINES.dailyOffer(), { react: 'smile', ask: true });
  if (await choose([{ label: '볼게요', value: 'y' }, { label: '그냥 기다릴게요', value: 'n' }]) !== 'y') { trace('dailySkip'); await say(LINES.dailySkip(), { react: 'normal' }); return; }
  await dailyRitual(pool);
  await say(LINES.dailyAfter(), { react: 'warm' });
}
// 오늘의 운세(주제 메뉴에서 고른 경우): 미리 써 둔 156개에서 한 장 → 운세 화면 → 다른 주제로. AI를 부르지 않는다(2026-10-13 초안)
async function todayStory() {
  dailyLoveFirst = null; preloadQueue(['wink', 'love', 'coin', 'color', 'scroll'].flatMap(n => [1, 2].map(f => `assets/sticker-wolhwa-${n}-${f}.webp`)));
  await loadDaily();
  const pool = Object.keys(typeof DAILY !== 'undefined' ? DAILY : {});
  if (!pool.length) return story();
  trace('todayStart');
  await say(LINES.today(), { react: 'smile' });
  await dailyRitual(pool);
  await say(LINES.todayAfter(), { react: 'warm', ask: true });
  await choose([{ label: '다른 것도 볼래요', value: 'a' }]);
  story();
}
// 시험용 '전체 복사'(2026-10-23 haru: 여러 기기에서 돌린 리딩을 한 번에 복사해 Claude에게 주면 비교 자료가 쌓임). 서버에는 아무것도 저장하지 않는다.
// 출시 전 뺄 것(PROGRESS 코드 정리 C): TEST_COPY = false
const TEST_COPY = true;
function readingText() {
  const { spread, items, concern } = st.aiReport, at = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16);
  const body = t => String(t || '').replace(/==/g, '').trim();
  return [`[월화 타로 시험 리딩] ${at} · 시작 ${RUN || '?'}`, `주제: ${st.pathLabel || '?'} (${spread.title})`, st.concern ? `고민: ${st.concern}` : '고민: 없음', '',
    ...items.flatMap((it, i) => [`${i + 1}. ${it.q}`, `카드: ${it.cards.map(c => c.name + (c.rev ? '(역)' : '')).join(' + ')}`, `결론: ${body(it.headline)}`, body(it.body), '']),
    ...(concern ? [`고민 정리 · ${st.concern}`, `결론: ${body(concern.headline)}`, body(concern.body)] : [])].join('\n');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
  }
}
async function copyAll(b) {
  const ok = await copyText(readingText());
  b.textContent = ok ? '복사했어요 ✓' : '복사가 안 됐어요'; setTimeout(() => { b.textContent = '전체 복사 (시험용)'; }, 2000);
}
function openReport() {
  const { spread, items, concern, report: R } = st.aiReport, wt = $('#webtoon');
  const build = () => {
  $('#frame').classList.add('wt-open'); wt.classList.add('rp-mode'); wt.hidden = false; wt.scrollTop = 0;
  sfx('seal'); SOUND.cue('report');   // 보고서: 책 드르륵 → 탁 닫힘(봉인)
  wt.innerHTML = `
    <div class="wt-panel wt-title rp-title"><span class="wt-qno">${st.name ? esc(st.name) + '님의 ' : ''}총정리 보고서</span><h2>${esc(spread.title)}</h2></div>
    <figure class="wt-panel wtp"><div class="wtp-art"><img src="${sceneSrc('report')}" alt=""></div></figure>
    <div class="wt-panel wt-say">${foxHead}<p class="wt-bubble">${esc(R.overview)}</p></div>
    <div class="wt-panel rp-box"><h3>한눈에 보기</h3>
      ${items.map((it, i) => `<div class="rp-row"><div class="rp-cards">${it.cards.map(c => cardFace(c, 's')).join('')}</div><div class="rp-txt"><span>질문 ${i + 1}</span><b>${esc(it.q)}</b><p>${esc(it.keypoint || it.headline)}</p></div></div>`).join('')}
    </div>
    <div class="wt-panel rp-profile"><div class="rp-ph">${foxHead}<div><span>${esc(spread.profile?.kicker || '다가올 인연')}</span><b>${esc(spread.profile?.title || '인연 프로필')}</b></div></div>
      <dl>${R.profile.map(p => `<dt>${esc(p.label)}${tagChips(p)}</dt><dd>${esc(p.value)}</dd>`).join('')}</dl></div>
    <div class="wt-panel rp-box"><h3>앞으로의 흐름</h3><ol class="rp-flow">${R.flow.map(f => `<li><b>${esc(f.when)}</b><p>${esc(f.what)}</p></li>`).join('')}</ol></div>
    <div class="wt-panel rp-box"><h3>지금부터 할 일</h3><ul class="rp-todo">${R.todo.map((t, i) => `<li><label><input type="checkbox" id="todo-${i}"><span>${esc(t)}</span></label></li>`).join('')}</ul>
      <h3>조심할 점</h3><ul class="rp-watch">${R.watch.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <div class="wt-panel wt-say">${foxHead}<p class="wt-bubble big">${esc(R.closing)}</p></div>
    <div class="wt-panel rp-sign"><img src="assets/sign.webp" alt="월화의 서명"><div class="stk duo" aria-hidden="true">${stkImgs('duo-cheer')}</div></div>
    <div class="wt-panel rp-box"><h3>질문별 전체 풀이</h3>${items.map((it, i) => `<details><summary><span>${i + 1}. ${esc(it.q)}</span><em class="fold"></em></summary><h4>${esc(it.headline)}</h4>${paras(it.body)}</details>`).join('')}${concern ? `<details><summary><span>고민 정리${st.concern ? ' · ' + esc(st.concern) : ''}</span><em class="fold"></em></summary><h4>${esc(concern.headline)}</h4>${paras(concern.body)}</details>` : ''}${TEST_COPY ? '<button type="button" class="rp-copy" id="rp-copy">전체 복사 (시험용)</button>' : ''}</div>
    ${keepUrl() ? `<div class="wt-panel rp-box rp-keep"><h3>다시 보기</h3><p>이 링크로 1년 동안 다시 볼 수 있어요.</p><button type="button" class="rp-copy" id="rp-keep">보관 링크 복사</button><div class="stk letter" aria-hidden="true">${stkImgs('luna-letter')}</div></div>` : ''}
    <div class="wt-panel wt-end rp-end"><button type="button" class="choice rp-pdf" id="rp-pdf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>PDF로 저장</button><button type="button" class="choice" id="rp-close">닫기</button></div>`;
  // 서명이 써지기 시작할 때 반짝 소리(도장 대신, 2026-10-09)
  wt.querySelector('.rp-sign > img').addEventListener('animationstart', () => sfx('reveal'), { once: true });
  useCardArt(wt); revealPanels(wt);
  };
  // 버튼은 화면이 만들어지는 즉시 연결한다(전환 효과 중에 눌러도 받게). 두 번 눌러도 한 번만
  return new Promise(res => sceneChange(() => {
    build(); trace('reportOpen');
    let done = false; const end = v => () => { if (done) return; done = true; trace('reportClose', { how: v, seen: +((wt.scrollTop + wt.clientHeight) / wt.scrollHeight).toFixed(2) }); sceneChange(closeWebtoon).then(() => res(v)); };
    $('#rp-pdf').onclick = savePdf; $('#rp-close').onclick = end('close');
    if (TEST_COPY) $('#rp-copy').onclick = e => copyAll(e.currentTarget);
    if (keepUrl()) $('#rp-keep').onclick = async e => { const b = e.currentTarget, ok = await copyText(keepUrl()); b.textContent = ok ? '복사했어요 ✓' : keepUrl(); if (ok) { const k = b.closest('.rp-keep').querySelector('.stk'); k?.classList.remove('go'); void k?.offsetWidth; k?.classList.add('go'); } };
  }));
}
