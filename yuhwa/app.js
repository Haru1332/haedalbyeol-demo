// 유화 별자리 — 대화(미연시) → 생일·시간·곳 → 차트 → 질문 소개·고민 → 설계도 → 별마다 웹툰 풀이(실시간) → 고민 → 총정리 보고서.
// 혜화 사주 app.js를 바탕으로 다시 짰다(2026-10-22). 오프닝·소리·오늘의 별자리 운세·별 잇기 연출은 아직(다음 단계).
// 🔒 손님 정보(이름·성별·생년월일·시·태어난 곳·고민)는 이 페이지 메모리에만 두고 저장하지 않는다. 서버에도 요청마다 보내고 서버는 저장하지 않는다.
const $ = s => document.querySelector(s);
const st = {name: '', gender: '', birth: null, concern: '', plan: '', chart: null, stars: [], answers: [], now: 0};
const nim = () => st.name ? `${st.name}님` : '';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
// 핵심 구절 형광펜(공통 기준 7장): AI가 ==구절==로 감싼 곳. 아직 닫히지 않은 ==는 그대로 둔다(실시간으로 받는 중)
const hl = h => h.replace(/==([^=]{1,40}?)==/g, '<mark class="hl">$1</mark>');
// 토막 말 고침: 자주 나오는 명사 + '요.'로 끝난 문장을 '~예요/이에요.'로(지침을 어긴 경우만, 실시간 화면에서)
const FRAG = /(곳|사이|때|쪽|편|것|거|사람|자리|마음|힘|일|길|날|순간|관계|방식|모습)(?:이)?요([.!?])(?=\s|$)/g;
const fixFrag = t => t.replace(FRAG, (m, w, p) => w + ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? '이에요' : '예요') + p);
const unhl = t => String(t || '').replace(/==([^=]{1,40}?)==/g, '$1');

// ── 무대 맞추기: 360×640을 화면에 맞춰 키우고 줄인다(세로로 긴 화면은 아래를 늘려 채움) ──
let lastW = 0;
function fit() {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && innerWidth === lastW) return;   // 키보드가 올라와 높이만 줄면 그대로
  lastW = innerWidth;
  const s = Math.min(innerWidth / 360, innerHeight / 640), h = Math.max(640, Math.floor(innerHeight / s)), frame = $('#frame');
  frame.style.setProperty('--frame-h', h + 'px');
  frame.style.setProperty('--shift', Math.round((h - 640) * 0.55) + 'px');
  frame.style.transform = `scale(${s})`;
  $('#fit').style.width = 360 * s + 'px'; $('#fit').style.height = h * s + 'px';
}
addEventListener('resize', fit); fit();

// ── 계절·시간대·행사(2026-10-23, 혜화 seasonNow·themeSrc 방식) ──
// 유화의 시간은 해 질 녘~첫 별이지만 월화·혜화처럼 하루 종일 지금 시각의 하늘로(2026-10-24 haru 아침·낮 그림 추가): 한국 시각 06~10시 아침, 11~16시 낮,
// 17시 노을, 18~19시 푸른 황혼, 20~21시 첫 별, 22~05시 별밤. 별 잇기 밤하늘은 아침·낮에도 밤하늘(별이 보여야 해서). 설·추석 같은 날(app/theme-dates.js, 혜화 복사)은 행사판이 먼저.
// 가짜 답 서버(8787, window.ASTRO_MOCK)에서만 ?theme=winter-night·christmas, ?at=2026-12-24T21:00 으로 바꿔 볼 수 있다(점검용)
const DEV = !!window.ASTRO_MOCK;   // 가짜 답 서버가 index.html에 심는 표시
function seasonNow() {
  const q = new URLSearchParams(location.search), at = DEV && q.get('at'), d = at ? new Date(at + (/[+Z]/.test(at.slice(10)) ? '' : '+09:00')) : new Date();
  const k = new Date(d.getTime() + 9 * 36e5), m = k.getUTCMonth() + 1, h = k.getUTCHours();
  const now = {season: m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter',
    time: h >= 6 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h === 17 ? 'sunset' : h >= 18 && h < 20 ? 'bluehour' : h >= 20 && h < 22 ? 'firststar' : 'night',
    event: typeof THEME_DATES === 'undefined' || Number.isNaN(k.getTime()) ? null : THEME_DATES[k.toISOString().slice(0, 10)] || null};
  const t = DEV && q.get('theme');
  if (/^(spring|summer|autumn|winter)-(morning|day|sunset|bluehour|firststar|night)$/.test(t)) { [now.season, now.time] = t.split('-'); now.event = null; }
  else if (/^(seol|chuseok|newyear|christmas|dongji|daeboreum|halloween)$/.test(t)) now.event = t;
  return now;
}
const themeNow = seasonNow(), themeOrder = [themeNow.event, `${themeNow.season}-${themeNow.time}`].filter(Boolean);
// 그림 목록(tools/import-assets.mjs가 씀): themes.json = 테마마다 있는 그림, sets.json = 대화·장면·반응·밤하늘 세트. 그림을 내려받아 떠보지 않고 목록으로 고른다
const IMG = 'webp';
let themes = {}, sets = {};
const themesReady = fetch('assets/themes.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : {}).then(j => { themes = j || {}; }).catch(() => {});
const setsReady = fetch('assets/sets.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : {}).then(j => { sets = j || {}; }).catch(() => {});
const hasTheme = (t, name) => Array.isArray(themes[t]) && themes[t].includes(name);
const themeSrc = name => { const t = themeOrder.find(x => hasTheme(x, name)); return `assets/${name}${t ? '_' + t : ''}.${IMG}`; };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
// 별 잇기·오늘의 운세 밤하늘 배경: 지금 시간대(노을·푸른 황혼·첫 별·별밤)의 두 장 중 하나. 한 번 방문하는 동안은 같은 장
let skyBgUrl = '';
const skyBg = el => { if (!skyBgUrl) { const a = sets.sky?.[themeNow.time]; skyBgUrl = a?.length ? `assets/sky-${themeNow.time}-${pickOne(a)}.${IMG}` : `assets/sky-night-1.${IMG}`; } el.style.setProperty('--sky-bg', `url(${skyBgUrl})`); warmStickers(); };

// ── 대화 배경: 별 탑에 앉은 유화. 대사마다 표정 그림(vn-<표정>)을 바꾼다. 한 번 방문하는 동안은 한 세트(자세가 튀지 않게) ──
// 오늘 테마에 여덟 표정이 다 있으면 그 계절·행사판, 없으면 기본 세트(자세 셋) 중 무작위
const FACES = ['smile', 'laugh', 'excited', 'surprised', 'pout', 'puff', 'serious', 'smug'], faceOk = new Set();
let vnSet = '', vnTheme = null;
const vnName = f => `assets/vn-${f}${vnTheme ? '_' + vnTheme : vnSet}.${IMG}`;
const loadOk = src => new Promise(r => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = src; });
let shownFace = '';
const vnReady = (async () => {
  await Promise.all([themesReady, setsReady]);
  vnTheme = themeOrder.find(t => FACES.every(f => hasTheme(t, 'vn-' + f))) || null;
  if (!vnTheme) vnSet = pickOne(sets.vn?.length ? sets.vn : ['']);
  for (const f of FACES) if (await loadOk(vnName(f))) { faceOk.add(f); if (f === 'smile' && !shownFace) setFace('smile'); }
})();
function setFace(f) { if (!faceOk.has(f)) f = 'smile'; if (!faceOk.has(f) || f === shownFace) return; shownFace = f; crossFace(vnName(f)); }
// 웹툰 장면(answer-system.md의 장면 이름과 같게). 장면마다 있는 세트(sets.json, 망원경 4·생각 3·나머지 2)를 차례로 돌려 쓴다.
// 반응(@반응) 칸은 그 장면에 맞는 가까이 찍은 반응 컷(react-*, 세로 3:4)을 번갈아 섞는다(2026-10-23 haru 「적재적소에」)
const SCENES = ['read', 'explain', 'think', 'smile', 'surprise', 'worried', 'reveal', 'stella', 'timing', 'telescope', 'back'];
const sceneSrc = (sc, n) => { const k = SCENES.includes(sc) ? sc : 'read', a = sets.scene?.[k]?.length ? sets.scene[k] : ['', '-2']; return `assets/scene-${k}${a[n % a.length]}.${IMG}`; };
const REACT_OF = {surprise: ['surprised'], smile: ['delight', 'tease'], think: ['think'], worried: ['worried', 'flustered'], reveal: ['awe', 'smug'], explain: ['tease'], timing: ['think']};
const reactSrc = (sc, n) => { const ks = (REACT_OF[sc] || []).filter(k => sets.react?.[k]?.length); if (!ks.length) return null; const k = ks[n % ks.length], a = sets.react[k]; return `assets/react-${k}-${a[Math.floor(n / ks.length) % a.length]}.${IMG}`; };

// ── 대화창 ──
let tapResolve = null, lastLine = '';
// text가 비면(같은 질문의 다음 칸) 앞 대사를 그대로 둔다
function talk(text, who = '유화') {
  $('#talk').hidden = false;
  if (!text && who === '유화') return Promise.resolve();
  lastLine = text;
  if (who === '유화' && text) setFace(lastFace);
  $('#name').textContent = who; $('#name').classList.toggle('me', who !== '유화');
  return typeLine($('#line'), text);
}
// 유화가 말하고, 손님이 누르면 다음으로
function say(text, who = '유화') {
  $('#choices').hidden = true; $('#next').hidden = true;
  const typed = talk(text, who);
  return new Promise(r => { typed.then(() => { $('#next').hidden = false; tapResolve = r; }); });
}
$('#talk').addEventListener('click', () => { if (finishTyping()) return; if (tapResolve) { const r = tapResolve; tapResolve = null; $('#next').hidden = true; r(); } });
$('#talk').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#talk').click(); } });
// 유화가 묻고 손님이 버튼으로 답한다 → 고른 값
// 고르기: 월화처럼 한 줄에 하나씩 위→아래(긍정이 위). 두 칸은 남자·여자처럼 나란한 것만(2026-10-23 haru: 맞아요 같은 버튼 좌우·색이 화면마다 달라짐)
function ask(text, options, cols = 0, who = '유화') {
  talk(text, who); $('#next').hidden = true;
  const box = $('#choices'); box.className = 'choices' + (cols === 2 ? ' two-col' : cols === 3 ? ' three-col' : ''); box.innerHTML = ''; box.hidden = false;
  return new Promise(r => options.forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.textContent = o.label;   // 고르는 버튼은 모두 같은 색(월화 choose와 같음 — 색 버튼은 입력칸의 완료 버튼만)
    b.onclick = () => { box.hidden = true; r('value' in o ? o.value : o.label); };   // value: null(몰라요)도 그대로 돌려준다 — 전엔 ?? 때문에 '몰라요' 글자가 와서 해외 칸으로 갔다(2026-10-23 haru)
    box.append(b);
  }), riseIn(box.children));
}
// 입력칸 + 버튼들. 예시 문구(placeholder)는 넣지 않는다(공통 기준 3장). read(box)가 undefined면 그대로, ''면 칸을 흔든다
function form(text, html, buttons, read, setup) {
  talk(text); $('#next').hidden = true;
  const box = $('#choices'); box.className = 'choices'; box.innerHTML = `<div class="field">${html}</div>`; box.hidden = false;
  const row = document.createElement('div'); row.className = 'choices' + (buttons.length === 2 ? ' two-col' : ''); row.style.cssText = 'position:static;padding:0';
  box.append(row); setup?.(box);
  // 건너뛰기(몰라요 등)는 왼쪽, 완료(go)는 오른쪽(월화·혜화와 같은 순서)
  return new Promise(r => [...buttons.filter(o => o.skip), ...buttons.filter(o => !o.skip)].forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice' + (o.go ? ' go' : ''); b.textContent = o.label;
    b.onclick = () => { const v = o.skip ? null : read(box); if (v === undefined) return; if (v === '') { nudge(box); return; } box.hidden = true; r(v); };
    row.append(b);
  }), riseIn(box.children));
}
function nudge(box) {
  const f = box.querySelector('input,textarea,select'); if (!f) return;
  f.focus(); f.classList.add('need');
  if (MOTION) f.animate([{transform: 'translateX(0)'}, {transform: 'translateX(-5px)'}, {transform: 'translateX(5px)'}, {transform: 'translateX(-3px)'}, {transform: 'translateX(0)'}], {duration: 300, easing: 'ease-out'});
  f.addEventListener('input', () => f.classList.remove('need'), {once: true});
}
const opts = (from, to, sel, unit = '') => Array.from({length: Math.abs(to - from) + 1}, (_, i) => from < to ? from + i : from - i).map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${v}${unit}</option>`).join('');
async function getJ(path) { const r = await fetch(path); if (!r.ok) throw new Error(r.status); return r.json(); }
async function post(path, payload) {
  const r = await fetch(path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.code || j.error || r.status), {code: j.code, choices: j.choices});
  return j;
}
const FAST = DEV && new URLSearchParams(location.search).get('fast') === '1';   // 가짜 답 서버: ?fast=1이면 기다림 없이(자동 점검용), 아니면 실제처럼 기다린다
const who = () => ({name: st.name, gender: st.gender, birth: st.birth, concern: st.concern, now: st.now, ...(st.orderId ? {orderId: st.orderId} : {}), ...(FAST ? {fast: true} : {})});   // 결제한 풀이: 주문번호

// ── 생일·시간·곳 ──
const birthText = b => {
  const d = `${b.calendar === 'lunar' ? (b.leap ? '음력 윤' : '음력 ') : ''}${b.year}년 ${b.month}월 ${b.day}일`;
  const t = b.time ? `${b.time.hour < 12 ? '오전' : '오후'} ${b.time.hour % 12 || 12}시${b.time.minute ? ' ' + b.time.minute + '분' : ''}` : '태어난 시간 모름';
  return [d, t, b.place ? b.place.label : '태어난 곳 모름'];
};
async function askDate() {
  const cal = await ask(pickLine('askCalendar'), [{label: '양력이에요', value: 'solar'}, {label: '음력이에요', value: 'lunar'}, {label: '음력 윤달이에요', value: 'leap'}]);
  const now = new Date().getFullYear();
  const date = await form(pickLine('askBirthDate'),
    `<div class="row"><select id="f-y" aria-label="년">${opts(now, 1900, 1995, '년')}</select><select id="f-m" aria-label="월">${opts(1, 12, 1, '월')}</select><select id="f-d" aria-label="일">${opts(1, 31, 1, '일')}</select></div>`,
    [{label: '이날이에요', go: true}], box => ({year: +box.querySelector('#f-y').value, month: +box.querySelector('#f-m').value, day: +box.querySelector('#f-d').value}));
  return {calendar: cal === 'solar' ? 'solar' : 'lunar', leap: cal === 'leap', ...date};
}
// 해 별자리(날짜만으로) — 시간 묻는 대사의 {sign}. 경계 날이면 null(별자리 이름 없는 줄만 나옴)
async function sunSignOf(d) { try { return (await post('/api/chart', {birth: {...d, time: null, place: null}})).sunSign; } catch (e) { throw e; } }
async function askTime(sign) {
  const t = await form(pickLine('askBirthTime', {sign}),
    `<div class="row"><select id="f-ap" aria-label="오전 오후"><option value="am">오전</option><option value="pm">오후</option></select><select id="f-h" aria-label="시">${opts(1, 12, 9, '시')}</select><select id="f-mi" aria-label="분">${opts(0, 59, 0, '분')}</select></div>`,
    [{label: '이 시간이에요', go: true}, {label: '몰라요', skip: true}], box => {
      const h12 = +box.querySelector('#f-h').value % 12, pm = box.querySelector('#f-ap').value === 'pm';
      return {hour: h12 + (pm ? 12 : 0), minute: +box.querySelector('#f-mi').value};
    });
  if (!t) await say(pickLine('timeUnknown'));
  return t;
}
// 태어난 곳: 국내(시·도 → 시·군·구) / 해외(나라 → 도시 검색) / 몰라요. 대사 askBirthPlace 설명대로
async function askPlace() {
  const kind = await ask(pickLine('askBirthPlace'), [{label: '한국이에요', value: 'kr'}, {label: '해외에서 태어났어요', value: 'world'}, {label: '몰라요', value: null}]);
  if (!kind) return null;
  if (kind === 'kr') {
    const sido = await getJ('/api/places/sido');
    return form('', `<div class="row"><select id="f-sido" aria-label="시·도">${sido.map(s => `<option>${esc(s)}</option>`).join('')}</select><select id="f-sgg" aria-label="시·군·구"></select></div>`,
      [{label: '여기예요', go: true}, {label: '처음부터', skip: true}],
      box => { const sd = box.querySelector('#f-sido').value, sg = box.querySelector('#f-sgg').value; return {kind: 'kr', sido: sd, sigungu: sg, label: [sd, sg].filter(Boolean).join(' ')}; },
      box => { const s1 = box.querySelector('#f-sido'), s2 = box.querySelector('#f-sgg');
        const load = async () => { const l = await getJ('/api/places/sigungu?sido=' + encodeURIComponent(s1.value)); s2.innerHTML = `<option value="">시·군·구는 모름</option>` + l.map(s => `<option>${esc(s)}</option>`).join(''); s2.hidden = !l.length; };
        s1.onchange = load; load(); }).then(v => v ?? askPlace());
  }
  const cs = await getJ('/api/places/countries');
  let found = [];
  return form('', `<div class="row"><select id="f-cc" aria-label="나라">${cs.map(c => `<option value="${c.cc}">${esc(c.name)}</option>`).join('')}</select></div><div class="row"><input id="f-city" maxlength="30" autocomplete="off" aria-label="도시"></div><div class="city-list" id="f-cities" role="listbox"></div>`,
    [{label: '여기예요', go: true}, {label: '처음부터', skip: true}],
    box => { const sel = box.querySelector('.city.on'); if (!sel) return ''; const c = found[+sel.dataset.i]; return {kind: 'world', lat: c.lat, lon: c.lon, tz: c.tz, label: c.label}; },
    box => { const cc = box.querySelector('#f-cc'), q = box.querySelector('#f-city'), list = box.querySelector('#f-cities');
      const search = async () => { found = await getJ(`/api/places/cities?cc=${cc.value}&q=${encodeURIComponent(q.value)}`);
        list.innerHTML = found.map((c, i) => `<button type="button" class="city" data-i="${i}">${esc(c.label)}</button>`).join('') || `<p class="city-none">${esc(pickLine('placeNotFound'))}</p>`; };
      list.onclick = e => { const b = e.target.closest('.city'); if (!b) return; list.querySelectorAll('.city').forEach(x => x.classList.toggle('on', x === b)); };
      cc.onchange = search; let t; q.oninput = () => { clearTimeout(t); t = setTimeout(search, 200); }; search(); }).then(v => v ?? askPlace());
}
// 차트 계산이 실패하면 장면 대사로 알리고 다시 묻는다. 서머타임으로 두 번 있는 시각은 손님에게 고르게 한다(결정 기록 2026-10-20)
async function askBirth() {
  for (;;) {
    const d = await askDate();
    let sign;
    try { sign = await sunSignOf(d); } catch (e) { await say(pickLine(e.code === 'INVALID_DATE' ? 'badDate' : 'dateRange')); continue; }
    const time = await askTime(sign);
    const place = await askPlace();
    st.birth = {...d, time, place};
    const [a, b, c] = birthText(st.birth);
    $('#stage').innerHTML = `<div class="paper birth"><h3>${esc(a)}</h3><p>${esc(b)}</p><p>${esc(c)}</p></div>`;
    const ok = await ask(pickLine('confirmInput'), [{label: '맞아요', value: true}, {label: '다시 할게요', value: false}]);
    $('#stage').innerHTML = '';
    if (!ok) continue;
    for (;;) {
      try { st.chart = await post('/api/chart', who()); return; }
      catch (e) {
        if (e.code === 'AMBIGUOUS_TIME') {   // 서머타임 때문에 같은 시각이 두 번 있었던 날(대사 dstAmbiguous)
          st.birth.choice = await ask(pickLine('dstAmbiguous'), [{label: '앞의 시각이에요', value: 0}, {label: '뒤의 시각이에요', value: 1}]); continue;
        }
        if (e.code === 'NONEXISTENT_TIME') { await say(pickLine('dstMissing')); break; }
        await say(pickLine({INVALID_DATE: 'badDate', FUTURE_DATE: 'dateRange', OUT_OF_RANGE: 'dateRange', PLACE_NOT_FOUND: 'placeNotFound'}[e.code] || 'badDate')); break;
      }
    }
  }
}

// ── 차트 펼치기 의식: 12별자리 원판이 그려지고, 태어난 순간의 천체가 하나씩 제자리에 내려앉는다(위치는 코드가 계산한 황경 그대로) ──
const SIGN_KO = ['양', '황소', '쌍둥이', '게', '사자', '처녀', '천칭', '전갈', '사수', '염소', '물병', '물고기'];
// 차트 원판 그림 세트(2026-10-24 haru 「천체도 각각에 맞춰서 세트로」 → 셋 비교 뒤 A 놋쇠 천문판): 천체 13·가운데 지구
// 행성이 아닌 점(키론·릴리스·교점)은 조금 작게
const WHEEL_ART = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'lilith', 'node']), WHEEL_POINT = new Set(['chiron', 'lilith', 'node']);
function wheelHTML(c) {
  const R = 112, cx = 150, cy = 150, asc = c.bodies.find(b => b.key === 'asc');
  const rot = asc ? 180 - asc.lon : 180;   // 상승궁을 왼쪽(9시)에 두는 차트 관례. 시간을 모르면 양자리 0°를 왼쪽에
  const P = (lon, r) => { const a = (rot + lon) * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  // 판 바탕 그림(2026-10-24 haru 「판이 안예뻐서」 → 놋쇠 천문판 A로 확정). 그림의 빈 띠(반지름 약 86%)에 별자리 이름이 오게 크기를 맞춘다.
  // 칸·글자는 코드가 그린다(그림 AI는 30°씩 정확히 못 나눔). 천체·가운데 지구도 같은 판 그림체(wheel-a-*)
  const plate = 'a', PR = (R - 13) / .86, PS = PR * 2;   // 판 그림은 원에 딱 맞게 잘라 둠
  let g = `<image href="assets/wheel-plate-${plate}.${IMG}" x="${cx - PS / 2}" y="${cy - PS / 2}" width="${PS}" height="${PS}" class="wh-plate"/>`;
  for (let k = 0; k < 12; k++) {
    const [x1, y1] = P(k * 30, R - 26), [x2, y2] = P(k * 30, R), [tx, ty] = P(k * 30 + 15, R - 13);
    g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wh-tick"/><text x="${tx}" y="${ty}" class="wh-sign">${SIGN_KO[k]}</text>`;
  }
  const show = c.bodies.filter(b => !['asc', 'mc'].includes(b.key));
  // 지평선(상승궁–하강점 축): 태어난 순간 땅과 하늘의 경계를 판을 가르는 금선으로. 상승궁(뜨는 곳)이 없으면 그리지 않는다(지어내지 않음)
  if (asc) {
    const L = R - 26, [x1, y1] = P(asc.lon, L), [lx, ly] = P(asc.lon, R + 22), [dx, dy] = P(asc.lon + 180, R + 22);   // 뜨는 곳·지는 곳 글자는 원판 바깥(안쪽은 천체 이름과 겹친다)
    // 지평선은 그림 대신 판을 반으로 가르는 금빛 선(2026-10-24 haru 「그냥 반을 가르는게 나으려나? 금색선으로?」)
    const [x2, y2] = P(asc.lon + 180, L);
    g += `<g class="wh-axis pre"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wh-horizon"/><circle cx="${x1}" cy="${y1}" r="2.6" class="wh-horizon-end"/><circle cx="${x2}" cy="${y2}" r="2.6" class="wh-horizon-end"/>`
      + `<text x="${lx}" y="${ly + 3}" class="wh-rise">뜨는 곳</text><text x="${dx}" y="${dy + 3}" class="wh-rise">지는 곳</text></g>`;
  }
  // 가운데 = 손님이 서 있는 곳(차트는 여기서 올려다본 하늘). 지구·별 탑을 비교해 haru가 지구로(2026-10-24, 「사이즈를 줄여도」 44 → 32)
  g += `<image href="assets/wheel-${plate}-earth.${IMG}" x="${cx - 16}" y="${cy - 16}" width="32" height="32" class="wh-center"/>`;
  // 천체: 이름은 늘 그림 바로 위(2026-10-24 haru 「이름은 항상 위에」). 겹치면 이름을 옮기지 않고 천체 자리를 안쪽 고리로 내리거나 몇 도 옆으로 비킨다
  // (가까이 모인 천체를 펼쳐 그리는 차트 관례 — 별자리 칸 안에서 몇 도만, 실제 자리는 보고서·풀이가 쓴다)
  const hit = (q, list) => list.reduce((t, r) => t + Math.max(0, Math.min(q[2], r[2]) - Math.max(q[0], r[0])) * Math.max(0, Math.min(q[3], r[3]) - Math.max(q[1], r[1])), 0);
  const placed = [[cx - 18, cy - 18, cx + 18, cy + 18]];   // 가운데 그림(지구)
  if (asc) placed.push([cx - R + 26, cy - 2, cx + R - 26, cy + 2]);   // 지평선 금선(대략)
  const items = [];
  for (const b of [...show].sort((p, q) => p.lon - q.lon)) {
    const art = WHEEL_ART.has(b.key), h = art ? (WHEEL_POINT.has(b.key) ? 6 : 8.5) : 3.2, w = b.name.length * 9 + 2;
    let best = null;
    for (const r of [R - 36, R - 54, R - 72]) for (const da of [0, 4, -4, 8, -8, 12, -12]) {
      if (da && Math.floor(((b.lon + da) % 360 + 360) % 360 / 30) !== Math.floor(b.lon / 30)) continue;   // 비켜도 같은 별자리 칸 안에서만
      const [x, y] = P(b.lon + da, r), box = [Math.min(x - h, x - w / 2), y - h - 12, Math.max(x + h, x + w / 2), y + h];
      const cost = hit(box, placed) * 10 + Math.abs(da) * 2 + (R - 36 - r) * .6;
      if (!best || cost < best.cost) best = {x, y, box, cost};
    }
    placed.push(best.box); items.push({b, art, h, x: best.x, y: best.y});
  }
  // 이름표 자리까지 겹치지 않게 골랐으니 그림이 이름을 가리지 않는다
  // 그림을 먼저 다 그리고 이름은 맨 위 층에 따로(뒤에 그린 천체 그림이 앞 천체 이름을 덮지 않게 — 2026-10-24 haru 폰 「글자가 행성 그림에 가려져서」)
  items.forEach(({b, art, h, x, y}) => { g += `<g class="wh-body pre${b.boundary ? ' dim' : ''}" data-k="${b.key}">${art ? `<image href="assets/wheel-${plate}-${b.key}.${IMG}" x="${x - h}" y="${y - h}" width="${h * 2}" height="${h * 2}"/>` : `<circle cx="${x}" cy="${y}" r="3.2"/>`}</g>`; });
  items.forEach(({b, h, x, y}) => { g += `<g class="wh-body wh-lab pre${b.boundary ? ' dim' : ''}" data-k="${b.key}"><text x="${x}" y="${y - h - 2}" text-anchor="middle">${esc(b.name)}</text></g>`; });
  const pick = k => c.bodies.find(b => b.key === k);
  const sum = ['sun', 'moon', 'asc'].map(pick).filter(Boolean).map(b => `${b.name} ${b.sign}`).join(' · ');
  return `<div class="paper chart-astro"><h3>${esc(nim() || '나')}의 하늘</h3><svg viewBox="0 0 300 300" class="wheel" role="img" aria-label="출생 차트">${g}</svg><p class="wh-sum">${esc(sum)}</p>${c.timeKnown && c.placeKnown ? '' : '<p class="dim">태어난 시간·곳을 몰라 상승궁은 비워 뒀어요</p>'}</div>`;
}
async function raiseChart(c) {
  $('#stage').innerHTML = wheelHTML(c);
  if (MOTION) await $('.wheel').animate([{opacity: 0, transform: 'rotate(-30deg) scale(.9)'}, {opacity: 1, transform: 'none'}], {duration: 700, easing: EASE}).finished;
  for (const el of document.querySelectorAll('.wh-body:not(.wh-lab)')) {
    el.classList.remove('pre'); document.querySelector(`.wh-lab[data-k="${el.dataset.k}"]`)?.classList.remove('pre');   // 이름은 그 천체와 같이 나타난다
    if (MOTION) { el.animate([{opacity: 0, transform: 'translateY(-8px)'}, {opacity: 1, transform: 'none'}], {duration: 260, easing: EASE}); await wait(110); }
  }
  document.querySelector('.wh-axis')?.classList.remove('pre');
}
const starLabel = s => st.name ? s.label.replace(/\*\*하루님\*\*/g, nim()) : (s.labelNoName ?? s.label.replace(/\*\*하루님\*\*\s*/g, ''));
function showTopics() {
  $('#stage').innerHTML = `<div class="paper"><h3>오늘 볼 별</h3><ol class="qlist">${st.stars.map(s => `<li>${esc(starLabel(s))}</li>`).join('')}</ol></div>`;
}

async function main() {
  st.stars = await getJ('/api/questions');
  await vnReady;
  if (!st.greeted && !AGAIN) await say(pickLine('greetFirst'));   // 오프닝에서 이미 인사했으면 건너뜀
  // 보고서 뒤 '처음으로'로 왔으면 오프닝·인사·자기소개 없이 이름부터(2026-10-25)
  st.name = await form(pickLine(AGAIN ? 'anotherSky' : 'selfIntro'), `<input id="f-name" maxlength="8" autocomplete="off" aria-label="불러 드릴 이름" placeholder="이름">`,
    [{label: '이렇게 불러 주세요', go: true}, {label: '이름 없이 볼게요', skip: true}], box => box.querySelector('#f-name').value.trim()) || '';
  lineName = nim();
  await say(pickLine(st.name ? 'nameAck' : 'nameSkip'));
  st.gender = await ask(pickLine('askGender'), [{label: '남자', value: '남성'}, {label: '여자', value: '여성'}], 2);
  await askBirth();
  await raiseChart(st.chart);   // 차트를 펼친 채로 '첫 별' 대사(반전)
  await say(pickLine('chartOpen'));
  await say(pickLine('chartWheel', {sign: st.chart.sunSign}));   // 태양이 별자리 경계면 이름 없는 줄만
  showTopics();
  await say(pickLine('questionsIntro', {count: '여덟'}));
  $('#stage').innerHTML = '';
  await say(pickLine('concernOne'));   // '하나만' 덧붙이기(2026-10-25, 월화와 같음 — 여러 개 적으면 지침이 맨 앞 하나만 푼다)
  st.concern = await form(pickLine('askConcern'), `<textarea id="f-c" maxlength="300" aria-label="궁금한 것"></textarea>`,
    [{label: '적었어요', go: true}, {label: '없어요', skip: true}], box => box.querySelector('#f-c').value.trim()) || '';
  // 🔒 위험 신호: 풀이보다 전문 상담(109) 안내가 먼저. 손님이 계속/그만을 고른다(2026-10-21 haru)
  if (st.concern && (await post('/api/concern-check', {concern: st.concern})).risk) {
    await say(pickLine('concernRisk'));
    const go = await ask('', [{label: '계속 볼게요', value: true}, {label: '오늘은 그만할게요', value: false}]);
    if (!go) { if (homeUrl()) return leaveShop(); await say(pickLine('afterReport')); location.reload(); return; }   // 메인을 거쳐 왔으면 작별 인사 뒤 메인으로(약속 문서 9절)
  }
  await say(pickLine(st.concern ? 'concernAck' : 'concernSkip'));
  st.now = Date.now();
  await STATUS;
  if (PAY.gate) await payDoor(false);   // 결제 문(관문이 켜진 서버만): 결제창으로 떠났다가 돌아오면 payReturn이 여기부터 이어 간다
  await readOn();
}
// 설계도 → 별 잇기·풀이 → 보고서. back: 결제·이어 받기로 돌아왔을 때 {plan, parts}(이미 받은 것은 다시 만들지 않는다)
async function readOn(back = null) {
  st.answers = []; st.plan = null; st.planText = ''; jobs.clear(); st.queued = false; st.reportP = null; st.planFail = false;
  if (back?.plan) {
    st.plan = back.plan; st.planText = back.plan; st.planFull = Promise.resolve();
    for (let i = 0; i <= lastIndex(); i++) { const x = back.parts?.[jobName(i)]; if (x) { const text = partText(x); jobs.set(i, {text, done: true, err: null, subs: new Set()}); st.answers[i] = itemOf(i, parseReading(text, true)); skyDone.add(i); } }   // 이미 받은 별은 다시 만들지 않고 보고서 '별마다 전체 풀이'에도
  } else {
    await makePlan();
    // 결제한 풀이: 설계도가 끝내 안 나오면 한 번만 더 조용히, 그래도 안 되면 관문에 알린다(아무것도 못 건넸으니 전액 자동 취소 — 약속 문서 5절)
    if (st.planFail && st.orderId) { st.planFail = false; await makePlan(); }
    if (st.planFail) { $('#sky').hidden = true; $('#frame').classList.remove('daily-talk'); waitStk(true); }
    if (st.planFail && st.orderId) { await payFailed('plan'); await ask('', [{label: '처음부터 볼게요', value: 1}]); location.reload(); return; }
    await say(pickLine('waitDone'));
  }
  $('#talk').hidden = true;
  openSky();
}

// 설계도를 기다리는 동안: 먼저 오늘의 별자리 운세를 권하고(대사 dailyOffer, AI 없음), 그 뒤엔 혼잣말이 시간 단계별로 바뀐다(waitStart → 32초 waitMid → 48초 waitLong)
async function streamPlan(onPart) {
  const r = await fetch('/api/plan-stream', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(who())});
  if (r.status === 409) { const t = await keepWait(m => m.material?.plan, '/material'); onPart(t); return t; }   // 설계도를 다른 요청이 만드는 중·이미 만듦: 보관함 재료에서
  if (!r.ok || !r.body) throw Object.assign(new Error('NET ' + r.status), {code: r.status === 402 ? 'UNPAID' : 'NET'});
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
  for (;;) {
    const {value, done} = await reader.read(); if (done) break;
    buf += dec.decode(value, {stream: true}); let k;
    while ((k = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, k)); buf = buf.slice(k + 1); if (m.t === 'd') { text += m.s; onPart(text); } if (m.t === 'err') throw new Error(m.msg); }
  }
  if (!text) throw new Error('EMPTY');
  return text;
}
// 기다림 밤하늘: 별자리 별을 하나씩 띄우고(밝은 별부터) 이어진 두 별이 다 뜨면 선을 긋는다. 다 그리면 별들이 천천히 반짝이며 기다린다.
// 별 자리는 별 잇기(openSky)와 같은 skyLayout이라 기다림이 끝나면 같은 하늘에서 별 잇기가 시작된다. 돌려주는 함수로 멈춘다(밤하늘은 남겨 둔다)
function waitSky(t0) {
  const sky = $('#sky'), sign = st.chart.sunSign || st.chart.sunSigns[0], c = ZODIAC[sign], H = $('#frame').offsetHeight || 640, pos = skyLayout(c, H);
  let g = '', seed = sign.length * 977 + 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 70; n++) g += `<circle cx="${(rnd() * SKY.W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${(rnd() * .7 + .3).toFixed(2)}" class="sk-dust" opacity="${(rnd() * .3 + .1).toFixed(2)}"/>`;
  c.edges.forEach(([a, b, dot], k) => { const [x1, y1] = pos[a], [x2, y2] = pos[b]; g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sk-edge${dot ? ' dot fill' : ''} wl" data-a="${a}" data-b="${b}" style="--len:${Math.hypot(x2 - x1, y2 - y1).toFixed(1)}"/>`; });
  c.stars.forEach((s, id) => { const [x, y] = pos[id]; g += `<circle cx="${x}" cy="${y}" r="${Math.max(1.4, 3.6 - s[2] * .45).toFixed(2)}" class="sk-small ws" data-id="${id}"/>`; });
  sky.innerHTML = `<svg viewBox="0 0 ${SKY.W} ${H}" class="sk-svg">${g}</svg><div class="sk-hud"><b>${esc(sign)}</b><span></span></div>`;
  skyBg(sky); sky.hidden = false; $('#frame').classList.add('daily-talk');
  $('#talk').hidden = false; $('#status').hidden = false;
  const order = c.stars.map((s, id) => [s[2], id]).sort((a, b) => a[0] - b[0]).map(x => x[1]), lit = new Set();
  let i = 0; const reveal = () => { if (i >= order.length) return; const id = order[i++]; lit.add(id);
    sky.querySelector(`.ws[data-id="${id}"]`)?.classList.add('on');
    sky.querySelectorAll('.wl').forEach(l => { if (!l.classList.contains('on') && lit.has(+l.dataset.a) && lit.has(+l.dataset.b)) l.classList.add('on', 'fresh'); }); };
  const starT = setInterval(reveal, MOTION ? 1100 : 10);
  const WAIT_STK = ['yuhwa-telescope', 'yuhwa-book', 'yuhwa-think', 'yuhwa-cocoa'];   // 꼬마 유화(2026-10-24 haru 「기다림용은 유화가 나와야」)
  let n = 0; const muse = () => { const sec = (Date.now() - t0) / 1000; if (n > 0) talk(pickLine(sec < 45 ? 'waitMid' : 'waitLong')); setStk(waitStk(), WAIT_STK[n++ % WAIT_STK.length]); };
  muse(); const museT = setInterval(muse, 8000);
  return () => { clearInterval(starT); clearInterval(museT); $('#status').hidden = true; };   // 꼬마 유화는 별 잇기로 넘어갈 때까지 남긴다(openSky가 치움, 2026-10-24 haru)
}
// 기다릴 때 꼬마 유화 자리(대화창 위 왼쪽). off면 치운다
function waitStk(off) { let el = $('#frame > .stk.wait'); if (off) { el?.remove(); return null; } if (!el) { $('#frame').insertAdjacentHTML('beforeend', '<div class="stk wait" aria-hidden="true"></div>'); el = $('#frame > .stk.wait'); } return el; }
async function makePlan() {
  const t0 = Date.now();
  let done = false;
  // 설계도는 실시간으로 받는다: @배정1이 끝나면(@별2가 나오면) 별 1 풀이를 먼저 시작할 수 있다. 나머지 별은 설계도가 다 온 뒤에
  st.planText = ''; st.planFull = null;
  let first; const firstReady = new Promise(r => { first = r; });
  // 풀이 미리 받기(2026-10-24 haru 「별을 고르는 곳에서 유화가 하는중… 완료하고 별을 누르면 바로 페이지가 나오게」): 전에는 별 잇기 화면이 열려야 풀이를 받기 시작해서
  // 첫 별을 누르면 웹툰에서 또 기다렸다. 이제 설계도가 다 오는 즉시 모든 별을 받기 시작한다(오늘의 운세를 보는 동안에도).
  // 첫 별도 다 나온 설계도로 쓴다(haru 「대기했다가 하면 되잖아 손님이 기다려도」 — 내용 손해 0을 고름)
  st.planFull = streamPlan(t => { st.planText = t; if (/\n@별2[\s]/.test(t)) first(); }).then(t => { st.plan = t; first(); startAll(); }, () => { st.plan = ''; st.planFail = true; first(); }).finally(() => { done = true; });
  // 기다림은 여기서(haru 「별을 누를 때 대기시간은 없어야」): 설계도에 이어 첫 별 풀이까지 다 써진 뒤에 별 잇기로 넘어간다
  const planP = st.planFull.then(() => st.planFail ? null : ended(fetchAnswer(0)));
  talk(pickLine('waitStart')); $('#status').hidden = false; $('#status').innerHTML = '유화가 하늘을 읽는 중<span class="wt-typing st-dots"><i></i><i></i><i></i></span>';   // 뒤에 점 세 개가 차례로 깜빡(혜화와 같음)
  warmStickers();   // 별 잇기 스티커를 기다리는 동안 미리 받아 둔다(첫 비행부터 바로 보이게)
  await wait(1800);
  if (!done) await dailyFortune(() => done);
  // 기다리는 동안(오늘의 운세를 다 봤거나 안 봤을 때)은 밤하늘에서(2026-10-24 haru 「하늘화면에서 하면 스티커 유화가 실제 유화랑 겹치지 않고 실제 하늘을 보는 연출」):
  // 손님 별자리의 별이 하나씩 떠오르고 선이 그어진다 → 별 잇기 화면이 같은 하늘·같은 자리라 그대로 이어진다. 꼬마 유화는 망원경·별 책·생각·코코아를 번갈아, 유화가 몇 초마다 한마디
  const stopSky = done && st.planFail ? null : waitSky(t0);
  try { await planP; } finally { stopSky?.(); }
  if (st.planFail) await say(pickLine('readFail'));
}
// 오늘의 별자리 운세(2026-10-21 haru: 반짝이는 별을 누르면 한 줄 → 2026-10-23 월화처럼 나눠서: 별 넷 = 총운·연애·금전·오늘의 색, 다 열면 한 장에 모아 정리).
// 문장 표 app/daily-data.js(DAILY 총운, DAILY_PARTS 연애·금전·색), 열쇠는 서버가 오늘 달의 자리로 계산. AI 없음
async function dailyFortune() {
  let key;
  try { key = await post('/api/daily', who()); } catch { return; }
  if (key.none || typeof DAILY === 'undefined' || !DAILY[key.sign]?.[key.pos]) return;
  const pick = t => t?.[key.sign]?.[key.pos]?.[key.variant] ?? t?.[key.sign]?.[key.pos]?.[0];
  const P = typeof DAILY_PARTS === 'undefined' ? {} : DAILY_PARTS, col = P.colors?.[key.moonSign];
  const parts = [
    {h: '총운', t: pick(DAILY), line: 'dailyTotal'},
    // 연애운은 솔로·연애 중 둘 다(2026-10-23 haru 「연애는 연애중과 솔로 두가지로」 — 보여 주는 방식은 대사 고르기 5의 질문, 우선 추천안: 한 카드에 둘 다)
    P.loveSingle ? {h: '연애운', t: pick(P.loveSingle), t2: pick(P.loveCouple), line: 'dailyLove'} : {h: '연애운', t: pick(P.love), line: 'dailyLove'},
    {h: '금전운', t: pick(P.money), line: 'dailyMoney'},
    col && {h: '오늘의 색', t: col.lines[key.variant] ?? col.lines[0], line: 'dailyColor', color: col},
  ].filter(x => x && x.t);
  const yes = await ask(pickLine('dailyOffer'), [{label: '볼래요', value: true}, {label: '그냥 기다릴게요', value: false}]);
  if (!yes) { await say(pickLine('dailySkip')); return; }
  const sky = $('#sky'), H = $('#frame').offsetHeight || 640, y = Math.round(H * .15), xs = parts.map((_, k) => Math.round(360 * (k + 1) / (parts.length + 1)));
  const dy = k => (k % 2 ? -14 : 8);   // 별자리처럼 살짝 지그재그
  const lineSeg = xs.slice(1).map((x, k) => `<line x1="${xs[k]}" y1="${y + dy(k)}" x2="${x}" y2="${y + dy(k + 1)}" class="sk-edge dot" data-k="${k + 1}"/>`).join('');
  sky.innerHTML = `<svg viewBox="0 0 360 ${H}" class="sk-svg art">${lineSeg}${parts.map((p, k) => `<g class="sk-q daily locked" data-k="${k}" role="button" tabindex="0" aria-label="${p.h} 별"><circle cx="${xs[k]}" cy="${y + dy(k)}" r="14" class="sk-halo"/><circle cx="${xs[k]}" cy="${y + dy(k)}" r="5" class="sk-core"/>${starArt(xs[k], y + dy(k), 24)}<circle cx="${xs[k]}" cy="${y + dy(k)}" r="26" fill="transparent"/><text x="${xs[k]}" y="${y + dy(k) + 28}" class="sk-label">${p.h}</text></g>`).join('')}</svg>
    <div class="sk-hud"><b>${esc(key.signKo)}</b><span>${esc(key.date.slice(5).replace('-', '월 '))}일</span></div>`;
  skyBg(sky); sky.hidden = false; $('#frame').classList.add('daily-talk');   // 유화 말이 밤하늘 위에 보이게
  $('#talk').hidden = false; talk(pickLine('dailyShown', {sign: key.signKo}));
  const tapStar = k => new Promise(r => {
    const g = sky.querySelector(`.daily[data-k="${k}"]`); g.classList.remove('locked'); g.querySelector('.sk-halo').classList.add('next');
    const go = () => { sparkleAt(g.querySelector('.sk-core'), 10); g.classList.add('done'); g.querySelector('.sk-halo').classList.remove('next'); sky.querySelector(`.sk-edge[data-k="${k}"]`)?.classList.add('on'); r(); };
    g.addEventListener('click', go, {once: true}); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); }, {once: true});
  });
  // 운마다 작은 양피지 창(월화 dailyPop·혜화와 같은 틀, 2026-10-24 haru 「월화랑 혜화를 보고 오늘의 운세UI틀을 맞춰야겠어」) + 창 귀퉁이에 운마다 다른 꼬마 유화
  const DAY_STK = {dailyTotal: 'yuhwa-day-star', dailyLove: 'yuhwa-day-love', dailyMoney: 'yuhwa-day-coin', dailyColor: 'yuhwa-day-color'};
  const text = p => p.color ? `<i class="dcolor" style="--c:${p.color.hex}"></i><p class="short">${esc(p.color.name)}</p><p>${esc(p.t)}</p>`
    : p.t2 ? `<p class="dlove"><b>솔로라면</b>${esc(p.t)}</p><p class="dlove"><b>연애 중이라면</b>${esc(p.t2)}</p>` : `<p>${esc(p.t)}</p>`;
  const close = (pop, r) => { pop.classList.add('out'); setTimeout(() => { pop.remove(); r(); }, 220); };
  const pop1 = p => new Promise(r => {
    const pop = document.createElement('div'); pop.className = 'dpop';
    pop.innerHTML = `<div class="dpop-sheet"><p class="dpop-kick">오늘의 운세 · ${esc(key.signKo)}</p><div class="rp-box"><h3>${p.h}</h3>${text(p)}</div><button type="button" class="choice">다음</button><div class="stk day" aria-hidden="true">${stkImgs(DAY_STK[p.line])}</div></div>`;
    $('#frame').append(pop); pop.querySelector('button').onclick = () => close(pop, r);
  });
  for (let k = 0; k < parts.length; k++) {
    await tapStar(k);
    const p = parts[k];
    await say(pickLine(p.line, {sign: key.signKo}));
    await pop1(p);
  }
  await say(pickLine('dailyAll'));
  await new Promise(r => {   // 다 모은 운세: 같은 작은 창, 안에서 스크롤, 닫기는 머리 줄 오른쪽 ✕
    const pop = document.createElement('div'); pop.className = 'dpop dsum';
    pop.innerHTML = `<div class="dpop-sheet"><div class="dsum-head"><span class="dsign"><img src="assets/sticker-star-gold-1.${IMG}" alt=""></span><div><p class="dpop-kick">오늘의 운세 · 오늘 달은 ${esc(key.moonSign)}에</p><h2>${esc(key.signKo)}</h2></div><button type="button" class="dsum-x" aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="rp-box dsum-body">${parts.map(p => `<h3>${p.h}</h3>${text(p)}`).join('')}</div><div class="stk day sum" aria-hidden="true">${stkImgs('yuhwa-day-scroll')}</div></div>`;
    $('#frame').append(pop); pop.querySelector('.dsum-x').onclick = () => close(pop, r);
  });
  sky.innerHTML = ''; skyBg(sky);   // 밤하늘은 그대로 둔다(아직 기다려야 하면 이 하늘에서 이어서 기다림 연출, 2026-10-24 haru)
  await say(pickLine('dailyAfter'));
}

// ── 결제 문·결과 보관·메인으로 나가는 문(2026-10-24, ~/dev/haedalbyeol docs/결제 관문 연결 약속.md — 혜화 app.js 방식) ──
// 고민까지는 무료(AI 0번, 오늘의 운세도 무료), 설계도 직전에 결제. 서버에 관문(PAY_GATE)이 없으면 결제 문 없이 지금처럼(haru 시험 8786·가짜 답 8787).
// 🔒 결제창을 다녀오는 동안 이어 갈 값(이름·성별·생일·태어난 곳·고민)은 이 탭의 sessionStorage에만, 돌아오면 바로 지운다.
// 보관 열쇠(keep)는 손님 것이라 서버로 보내지 않고 화면에서 링크로만 보여 준다
const PAY = {gate: null}, PAY_KEY = 'hdb-resume';
const STATUS = fetch('/api/status').then(r => r.ok ? r.json() : null).then(j => { if (j?.payGate) PAY.gate = j.payGate; }).catch(() => {});
const payPost = (path, body) => fetch(PAY.gate + path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), keepalive: true});
const dropResume = () => { try { sessionStorage.removeItem(PAY_KEY); } catch {} };
const keepUrl = () => PAY.gate && st.keep ? `${PAY.gate}/r/${encodeURIComponent(st.keep)}` : '';
const jobName = i => i === MAIN().length ? 'concern' : 'q' + (i + 1);   // 관문의 질문 이름(별 1~7 = q1~q7, 고민 = concern)
// 보관함의 풀이 한 칸 → 화면이 읽는 글 모양(장면 그림 칸 없이 결론·글·핵심)
const partText = x => `@결론 ${x?.headline || ''}\n@소제목 \n${x?.body || ''}\n@핵심 ${x?.keypoint || ''}`;
// 같은 질문을 다른 요청이 만드는 중이거나 이미 만들었으면(서버 409, 약속 문서 6절) 다시 만들지 않고 보관함에서 기다렸다 꺼낸다.
// pick(보관함 답)이 값을 주면 끝, 5초마다 다시 보고 5분 넘으면 포기(관문은 4분 뒤 잡은 걸 저절로 푼다)
async function keepWait(pick, sub = '') {
  if (!PAY.gate || !st.keep) throw Object.assign(new Error('NO_KEEP'), {code: 'NO_KEEP'});
  for (const t0 = Date.now(); Date.now() - t0 < 300000; await wait(5000)) {
    try { const r = await fetch(`${PAY.gate}/api/keep/${encodeURIComponent(st.keep)}${sub}`); if (r.ok) { const v = pick(await r.json()); if (v) return v; } } catch {}
  }
  throw Object.assign(new Error('KEEP_TIMEOUT'), {code: 'AI_FAIL'});
}
const taken = e => e?.code === 'IN_PROGRESS' || e?.code === 'ALREADY_DONE';
// 결제 대사: haru가 고른 줄이 들어오기 전에는 '안내' 이름표로 사실만. 값(가격)은 아직 정하지 않아서(priceTbd) 말하지 않는다 — 임시 문구(출시 전 점검표)
const PAY_PLAIN = {
  pay_door: '여기부터는 결제한 뒤에 풀이를 써 드려요.',
  pay_fail: '결제가 끝나지 않았어요. 다시 하시려면 아래 단추를 눌러 주세요.',
  pay_open: '결제 창이 열리지 않았어요. 조금 있다가 다시 눌러 주세요.',
  pay_back: '결제가 끝났어요. 이어서 풀이를 시작할게요.',
  pay_canceled: '풀이를 만들지 못해서 결제를 취소했어요. 돈은 나가지 않아요.',
  pay_partial: '풀이가 중간에 멈췄어요. 위 링크로 나중에 이어서 받을 수 있어요.',
  pay_resume: '멈췄던 곳부터 이어서 받을게요.',
  pay_lost: '이어 갈 내용을 찾지 못했어요. 처음부터 다시 볼게요.',
};
const paySay = k => say(PAY_PLAIN[k], '안내');
async function payDoor(failed) {
  for (let k = failed ? 'pay_fail' : 'pay_door'; ; k = 'pay_open') {
    await ask(PAY_PLAIN[k], [{label: '풀이 받기', value: 1}], 0, '안내');
    try {
      // 못 적으면(사생활 보호 창 등) 돌아와도 못 이어 가니 떠나지 않는다
      sessionStorage.setItem(PAY_KEY, JSON.stringify({name: st.name, gender: st.gender, birth: st.birth, concern: st.concern, now: st.now}));
      const r = await payPost('/api/pay/order', {shop: 'astro', product: 'astro-natal', returnUrl: location.origin + location.pathname});
      const j = await r.json();
      if (!r.ok || !j.payUrl) throw new Error(j.error || 'ORDER');
      location.href = j.payUrl;
      // 결제창으로 떠난다. 브라우저 '뒤로'로 이 화면이 그대로 돌아오면(bfcache) 단추를 다시 보인다
      await new Promise(r => addEventListener('pageshow', function f(e) { if (e.persisted) { removeEventListener('pageshow', f); r(); } }));
      dropResume();
    } catch (e) { console.warn(e); dropResume(); }
  }
}
// 끝 알림: 보고서까지 받으면 ok:true. 실패면 ok:false — 관문이 아무것도 못 건넨 주문은 전액 취소, 건넨 게 있으면 취소 없이 이어 받기
async function payEnd(ok, reason) {
  const id = st.orderId; st.orderId = null; dropResume();
  if (!id || !PAY.gate) return null;
  try { return await (await payPost('/api/pay/result', ok ? {orderId: id, ok} : {orderId: id, ok, reason})).json(); } catch { return null; }
}
async function payFailed(reason) {
  const r = await payEnd(false, reason); $('#status').hidden = true;
  if (r?.refused === 'partly-delivered' && keepUrl()) { keepCard(); await paySay('pay_partial'); }
  else await paySay('pay_canceled');
}
// 보관 링크 종이: 결제 직후·이어 받기 안내 때. 보고서 끝(그리고 PDF)에도 같은 링크가 들어간다
function keepCard() {
  const u = keepUrl(); if (!u) return;
  $('#stage').innerHTML = `<div class="paper keep"><h3>다시 보기 링크</h3><p>이 링크로 1년 동안 다시 볼 수 있어요</p><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a><button type="button" class="keep-copy">링크 복사</button></div>`;
  $('.keep-copy').onclick = async e => { const b = e.currentTarget; let ok = false; try { await navigator.clipboard.writeText(u); ok = true; } catch {} b.textContent = ok ? '복사했어요 ✓' : '길게 눌러 복사해 주세요'; };
}
// 메인('해·달·별')으로 돌아가는 문(약속 문서 9절): 메인이 ?home=<메인 주소>를 붙여 보낸다. 허용된 모양(이 PC 8796 · trycloudflare 링크)일 때만
// 이 탭에 두고 주소창에서 지운다(엉뚱한 곳으로 보내는 링크 막기). 없으면(유화를 바로 연 경우) 나가는 문을 숨긴다.
// 자리: 보고서 끝 버튼 줄, 위험 신호에서 '오늘은 그만할게요' 뒤(2026-10-24 haru, 버튼 이름 「다음에 또 올게요 이런걸로」)
const HOME_KEY = 'hdb-home', HOME_LABEL = '해·달·별로';   // 2026-10-25 haru: 보고서에서 나온 뒤 [보고서 다시 보기 · 처음으로 · 해·달·별로]
const PAY_Q = new URLSearchParams(location.search), PAY_BACK = ['paid', 'payFail', 'resume', 'view'].some(k => PAY_Q.has(k));   // view = 보고서 다시 보기(2026-10-25)
(() => {
  const h = PAY_Q.get('home'); if (h === null) return;
  try { const u = new URL(h), ok = (u.protocol === 'http:' && ['127.0.0.1:8796', 'localhost:8796'].includes(u.host)) || (u.protocol === 'https:' && u.hostname.endsWith('.trycloudflare.com'));
    if (ok) sessionStorage.setItem(HOME_KEY, u.href); } catch {}
  PAY_Q.delete('home'); history.replaceState(null, '', location.pathname + (PAY_Q.size ? '?' + PAY_Q : ''));
})();
const homeUrl = () => { try { return sessionStorage.getItem(HOME_KEY) || ''; } catch { return ''; } };
// 해·달·별로 — 월화 leaveHome과 같게(2026-10-25 월화 세션이 전한 haru 「아 작별인사 한번 더 하고 나가얒.. 유화도 맞추라고 해줘. 타이밍도 맞춰줘, 유화도 3번도 맞춰줘」):
// 작별 인사 한 줄(마무리 대사와 다른 'leave') → 검은 막 0.7초 → 다 검어진 뒤 문 닫히는 소리(월화와 같은 파일) + 음악 1.8초에 걸쳐 줄임 → 2초 뒤 메인
async function leaveShop() {
  await say(pickLine('leave'));
  if (!homeUrl()) return;
  const k = document.createElement('div'); k.className = 'leave-black'; document.body.append(k);
  void k.offsetWidth; k.classList.add('on');
  await new Promise(r => setTimeout(r, 700));
  sfx('doorClose'); BGM.out(1800);
  await new Promise(r => setTimeout(r, 2000));
  location.href = homeUrl();
}
addEventListener('pageshow', e => { if (e.persisted) document.querySelectorAll('.leave-black').forEach(k => k.remove()); });   // 메인에서 뒤로 오면 검은 막을 걷음(월화와 같음)
// 처음으로: 저장한 것이 없으니 가게를 새로 열되(개인정보를 남기지 않음) 오프닝·첫 인사 없이 방에서 이름부터. 결제에서 돌아온 표시는 떼고 연다
const AGAIN_KEY = 'yh-again';
const AGAIN = (() => { try { const v = sessionStorage.getItem(AGAIN_KEY); sessionStorage.removeItem(AGAIN_KEY); return v === '1'; } catch { return false; } })();
function restartShop() {
  try { sessionStorage.setItem(AGAIN_KEY, '1'); } catch {}
  const q = new URLSearchParams(location.search); ['paid', 'payFail', 'resume', 'view'].forEach(k => q.delete(k));
  location.href = location.pathname + (q.size ? '?' + q : '');
}
// 결제창·보관 링크에서 돌아옴(?paid=&keep= · ?payFail= · ?resume=): [들어가기]를 누른 뒤 오프닝 없이 여기서 이어 간다
// 보고서 다시 보기(?view=열쇠, 2026-10-25 월화 0229bf3와 같게): 관문에 보관된 별 풀이·보고서로 AI 없이 보고서 화면을 바로 연다.
// 카톡 같은 앱 안 브라우저에서 PDF가 안 될 때 바깥 브라우저로 넘겨 여는 곳. 보관 글엔 이름이 없어 '나의 하늘'·'손님'으로 보인다
async function keepView(key) {
  if (!PAY.gate) return false;
  let k; try { const r = await fetch(`${PAY.gate}/api/keep/${encodeURIComponent(key)}`); if (!r.ok) return false; k = await r.json(); } catch { return false; }
  const P = k.parts || {};
  if (!P.report) return false;
  st.keep = key;
  st.answers = Object.keys(P).filter(j => /^q\d+$/.test(j)).sort((a, b) => a.slice(1) - b.slice(1)).map(j => ({title: P[j].q, headline: P[j].headline, keypoint: P[j].keypoint, body: P[j].body}));
  if (P.concern) st.answers.push({title: P.concern.q || '따로 궁금한 것', headline: P.concern.headline, keypoint: P.concern.keypoint, body: P.concern.body});
  st.reportP = Promise.resolve({data: P.report});
  openReport();
  return true;
}
// 카톡·인스타·네이버 같은 앱 안 브라우저는 인쇄(PDF로 저장)를 막아 둔다 → 같은 보고서를 기본 브라우저로 넘겨 연다(월화와 같음, haru 「유화도 브라우저 해결해」)
const INAPP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(navigator.userAgent);
function pdfOutside(btn) {
  const h = homeUrl(), u = keepUrl() ? `${location.origin}${location.pathname}?view=${encodeURIComponent(st.keep)}${h ? '&home=' + encodeURIComponent(h) : ''}` : location.origin + location.pathname;
  const label = btn.textContent;
  if (/KAKAOTALK/i.test(navigator.userAgent)) {   // 카톡이 기본 브라우저로 연다
    btn.textContent = '브라우저로 여는 중…';
    const out = x => { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(x); };
    // 폰 시험 링크에서는 문지기가 기본 브라우저를 모르는 기기로 본다 → 한 번 쓰는 넘겨주기 표를 붙여 넘긴다(remote-gate.mjs /__handoff)
    if (/\.trycloudflare\.com$/.test(location.hostname)) fetch('/__handoff', {method: 'POST'}).then(r => r.json()).then(({t}) => { const x = new URL(u); x.searchParams.set('hand', t); out(x.href); }).catch(() => out(u));
    else out(u);
  } else btn.textContent = '메뉴에서 다른 브라우저로 열어 주세요';
  setTimeout(() => { btn.textContent = label; }, 4000);
}
async function payReturn() {
  history.replaceState(null, '', location.pathname);   // 주소창에서 주문번호·열쇠를 지운다
  await STATUS;
  st.stars = await getJ('/api/questions');
  await vnReady;
  const paid = PAY_Q.get('paid'), resume = PAY_Q.get('resume'), view = PAY_Q.get('view');
  if (view && await keepView(view)) return;
  let s = null, back = null;
  if (resume && PAY.gate) {   // 보관 링크의 [이어서 받기]: 재료(이름 없음)와 이미 받은 칸을 관문에서 받는다
    try {
      const k = encodeURIComponent(resume), [m, keep] = await Promise.all([`/api/keep/${k}/material`, `/api/keep/${k}`].map(async u => { const r = await fetch(PAY.gate + u); if (!r.ok) throw new Error(r.status); return r.json(); }));
      const M = m.material || {};
      s = {name: '', gender: M.gender, birth: M.birth, concern: M.concern || '', now: M.now};
      st.orderId = m.orderId; st.keep = resume;
      back = {plan: M.plan, parts: keep.parts || {}};
    } catch (e) { console.warn(e); s = null; }
  } else {
    try { s = JSON.parse(sessionStorage.getItem(PAY_KEY) || 'null'); } catch {}
    dropResume();
    if (s && paid) { st.orderId = paid; st.keep = PAY_Q.get('keep') || null; }
  }
  if (!s?.birth) {   // 다른 탭·브라우저로 돌아왔거나 값이 없음: 결제했으면 바로 취소하고 처음부터
    if (paid && PAY.gate) { st.orderId = paid; await payEnd(false, 'resume'); }
    await paySay('pay_lost'); st.orderId = null; st.keep = null;
    return main();
  }
  Object.assign(st, {name: s.name || '', gender: s.gender, birth: s.birth, concern: s.concern || '', now: s.now || Date.now()});
  lineName = nim();
  try { st.chart = await post('/api/chart', who()); } catch { await paySay('pay_lost'); return main(); }
  if (PAY_Q.has('payFail')) { await payDoor(true); return readOn(); }   // 결제창을 닫음: 같은 고민으로 다시 문 앞
  if (back) await paySay('pay_resume');
  else { keepCard(); await paySay('pay_back'); $('#stage').innerHTML = ''; }
  await readOn(back);
}

// ── 웹툰 풀이: 별 하나씩, AI가 쓰는 대로 보여 준다 ──
const MAIN = () => st.stars.filter(s => s.key !== 'concern');
function openWebtoon(i) { sceneChange(() => openWebtoonNow(i)); }
function openWebtoonNow(i) {
  const wt = $('#webtoon'), main = MAIN(); wt.hidden = false; wt.classList.remove('rp-mode'); wt.scrollTop = 0; wt.dataset.i = String(i);
  const concern = i === main.length, s = concern ? null : main[i];
  $('#progress').hidden = false; $('#progress').textContent = concern ? '따로 궁금한 것' : `${i + 1} / ${main.length}`;
  wt.innerHTML = `<div class="wt-top">나의 별자리</div><div class="wt-title"><div class="wt-suns" aria-hidden="true">${main.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'n' : ''}"></i>`).join('')}</div><div class="wt-qno">${concern ? '따로 궁금한 것' : `별 ${s.n} / ${main.length}`}</div><h2>${esc(concern ? st.concern : starLabel(s))}</h2></div><div id="wt-body"><div class="wt-typing"><i></i><i></i><i></i></div></div><div class="wt-end" id="wt-end"></div>`;
  streamAnswer(i, concern);
}
function renderReading(R) {
  let n = 0;
  // 반응 칸은 홀수 번째마다 가까이 찍은 반응 컷(있는 장면만), 나머지는 장면 그림
  const bubble = b => { if (!b?.text) return ''; const i = n + (R.seed || 0), rc = i % 2 ? reactSrc(b.scene, i) : null;
    return `<figure class="wt-panel${rc ? ' react' : ''}"><img src="${rc || sceneSrc(b.scene, i)}" alt="" loading="lazy" onerror="this.src='${sceneSrc('read', 0)}'"><figcaption class="wt-pb">${esc(b.text)}</figcaption></figure>${(n++, '')}`; };
  let h = '';
  if (R.headline) h += `<div class="wt-head"><span class="lbl">결론</span><p>${esc(R.headline)}</p></div>`;
  if (R.basis) h += `<p class="wt-basis">${esc(R.basis)}</p>`;
  h += R.reacts.map(bubble).join('');
  for (const s of R.sections) {
    h += `<div class="wt-sec"><h3>${esc(s.title)}</h3>${s.text.split(/\n\s*\n/).filter(Boolean).map(p => `<p>${hl(esc(fixFrag(p.replace(/\n/g, ' '))))}</p>`).join('')}</div>`;
    h += bubble(s.beat);
  }
  h += bubble(R.closing);
  if (R.keypoint) h += `<div class="wt-key"><span class="lbl">핵심</span><p>${esc(R.keypoint)}</p></div>`;
  if (!R.done) h += '<div class="wt-typing"><i></i><i></i><i></i></div>';
  return h;
}
// 실시간으로 받는 동안 바뀐 칸만 갈아 끼운다(그림 칸이 매번 다시 그려져 깜빡이지 않게)
function patch(el, html) {
  const t = document.createElement('div'); t.innerHTML = html;
  const next = [...t.children], cur = [...el.children];
  next.forEach((n, k) => {
    const h = n.outerHTML; n.dataset.h = h;
    if (!cur[k]) el.append(n);
    else if (cur[k].dataset.h !== h) { if (cur[k].classList.contains('in')) n.classList.add('rv', 'in'); cur[k].replaceWith(n); }
  });
  cur.slice(next.length).forEach(c => c.remove());
}
// 풀이 미리 받기(공통 기준 7장, 2026-10-23 월화 방식으로): 별 잇기가 열리면 모든 별을 순서대로 3개씩 동시에 받고,
// 다 받으면 총정리 보고서도 뒤에서 바로 만든다(손님이 읽는 동안). 손님이 아직 안 받은 별을 누르면 그 별은 바로 시작
const jobs = new Map();
const lastIndex = () => MAIN().length - (st.concern ? 0 : 1);
function fetchAnswer(i) {
  if (jobs.has(i) || i > lastIndex()) return jobs.get(i);
  const job = {text: '', done: false, err: null, subs: new Set()}; jobs.set(i, job);
  const tell = () => job.subs.forEach(f => f());
  (async () => {
    try {
      await st.planFull;   // 모든 별은 설계도가 다 온 뒤에(첫 별도, 2026-10-24 haru)
      const plan = st.plan || st.planText;
      const r = await fetch('/api/answer-stream', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({...who(), plan, qIndex: i})});
      // 다른 요청이 만드는 중·이미 만듦: 보관함에 생기면 그 글로. 만들던 쪽이 멈춰(탭을 닫음·서버 끊김) 관문이 잡은 걸 풀면(4분) 그때 새로 만든다
      if (r.status === 409) { const x = await keepWait(k => k.parts?.[jobName(i)] || (Array.isArray(k.inProgress) && !k.inProgress.includes(jobName(i)) && 'free'));
        if (x === 'free') { jobs.delete(i); const j2 = fetchAnswer(i); j2.subs = job.subs; await ended(j2); Object.assign(job, {text: j2.text, done: j2.done, err: j2.err}); tell(); return; }
        job.text = partText(x); job.done = true; tell(); return; }
      if (!r.ok || !r.body) throw Object.assign(new Error('NET ' + r.status), {code: r.status === 402 ? 'UNPAID' : 'NET'});
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const {value, done} = await reader.read(); if (done) break;
        buf += dec.decode(value, {stream: true}); let k;
        while ((k = buf.indexOf('\n')) >= 0) {
          const m = JSON.parse(buf.slice(0, k)); buf = buf.slice(k + 1);
          if (m.t === 'd') { job.text += m.s; tell(); }
          if (m.t === 'err') throw new Error(m.msg);
        }
      }
      if (!job.text) throw new Error('EMPTY');
      job.done = true;
    } catch (e) { job.err = e; }
    tell();
  })();
  return job;
}
const ended = j => new Promise(r => { if (j.done || j.err) r(); else j.subs.add(() => (j.done || j.err) && r()); });
function startAll() {
  if (st.queued) return; st.queued = true;
  const order = Array.from({length: lastIndex() + 1}, (_, i) => i); let next = 0;
  const worker = async () => { while (next < order.length) { const job = fetchAnswer(order[next++]); if (job) await ended(job); } };
  for (let w = 0; w < 3; w++) worker();
  // 풀이가 다 써지면 보고서도 바로(실패하면 보고서 버튼을 누를 때 다시 받는다)
  const all = order.map(i => fetchAnswer(i));
  st.reportP = Promise.all(all.map(ended)).then(() => {
    if (all.some(j => j.err)) throw new Error('ANSWER_FAIL');
    return post('/api/report', {...who(), plan: st.plan, items: all.map((j, i) => itemOf(i, parseReading(j.text, true)))}).catch(e => taken(e) ? keepWait(k => k.parts?.report).then(data => ({data})) : Promise.reject(e));
  });
  st.reportP.catch(() => {});
}
const itemOf = (i, R) => ({title: i === MAIN().length ? '따로 궁금한 것: ' + st.concern : starLabel(MAIN()[i]), headline: R.headline, body: R.body});
function streamAnswer(i, concern) {
  fetchAnswer(i);
  const body = $('#wt-body'), end = $('#wt-end'), job = jobs.get(i), main = MAIN();
  const draw = () => {
    if ($('#webtoon').dataset.i !== String(i)) return job.subs.delete(draw);
    if (job.err) {
      job.subs.delete(draw); jobs.delete(i);
      body.insertAdjacentHTML('beforeend', `<p class="wt-err">${esc(pickLine(navigator.onLine ? 'readFail' : 'netFail'))}</p>`);
      if (keepUrl()) body.insertAdjacentHTML('beforeend', `<p class="wt-err">나중에 이어서 받으려면: <a href="${esc(keepUrl())}" target="_blank" rel="noopener">다시 보기 링크</a></p>`);   // 결제한 풀이
      end.innerHTML = `<button class="wt-btn" type="button">다시 볼게요</button>`; end.firstChild.onclick = () => openWebtoon(i); return;
    }
    const R = parseReading(job.text, job.done); R.seed = i; patch(body, renderReading(R)); revealPanels($('#webtoon'));
    if (!job.done) return;
    job.subs.delete(draw);
    st.answers[i] = itemOf(i, R);   // 보고서 AI에게는 server가 ==를 지워 보낸다
    // 다 본 별은 별 지도로 돌아가 선이 이어진다(별 잇기). 다음 별은 미리 받기 시작
    end.innerHTML = `<button class="wt-btn" type="button">별 지도로 돌아가기</button>`;
    end.firstChild.onclick = () => { skyDone.add(i); $('#webtoon').hidden = true; $('#progress').hidden = true; openSky(i); };
  };
  job.subs.add(draw); draw();
}

// ── 총정리 보고서(양피지 문서) ──
// 시험용 '전체 복사'(2026-10-23 haru, 월화 ai-reading.js 따라): 실제 풀이를 글로 복사해 Claude에게 주면 '차트와 상관없이 같은 말'을 센다(tools/phrase-count.mjs 모양).
// 이름·생년월일·태어난 곳·고민 글은 넣지 않는다(검사 자료로 남으니까). 서버에는 아무것도 저장하지 않는다. 출시 전 TEST_COPY = false
const TEST_COPY = true;
function readingText() {
  const at = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Seoul'}).slice(0, 16);
  const hide = t => { t = String(t || '').replace(/==/g, '').trim(); return st.name ? t.split(st.name + '님').join('○○님').split(st.name + ' 님').join('○○ 님') : t; };   // '○○님' 꼴만(이름이 '하루'면 낱말 '하루'까지 지워졌다 — 2026-10-24 haru 복사 글에서 찾음)
  return [`[유화 별자리 시험 리딩] ${at}`, `태어난 시: ${st.birth?.time ? '앎' : '모름'} · 따로 궁금한 것: ${st.concern ? '있음' : '없음'}`, '',
    ...st.answers.filter(Boolean).flatMap((x, k) => [`${k + 1}. ${x.title.startsWith('따로 궁금한 것') ? '따로 궁금한 것' : hide(x.title)}`, hide(x.headline), hide(x.body), ''])].join('\n');
}
async function copyAll(b) {
  const t = readingText(); let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; } catch {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.append(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch {} ta.remove();
  }
  b.textContent = ok ? '복사했어요 ✓' : '복사가 안 됐어요'; setTimeout(() => { b.textContent = '전체 복사 (시험용)'; }, 2000);
}
// 보고서를 닫은 뒤(2026-10-25 haru 「보고서에는 닫기만 두고 보고서에서 나오면 유화가 마무리 대사 하면서 보고서 다시보기, 처음으로, 해달별로」):
// 유화의 방(대화 곡)에서 마무리 한 줄과 함께 고른다. 해·달·별로는 메인을 거쳐 왔을 때만
async function afterClose() {
  BGM.play('talk', 1200);
  const v = await ask(pickLine('afterReport'), [{label: '보고서 다시 볼게요', value: 'report'}, {label: '처음으로', value: 'again'}, ...(homeUrl() ? [{label: HOME_LABEL, value: 'home'}] : [])]);
  if (v === 'report') { sfx('seal'); BGM.play('report', 1200); return sceneChange(() => { const wt = $('#webtoon'); wt.hidden = false; wt.scrollTop = 0; $('#progress').hidden = false; $('#talk').hidden = true; }); }   // 닫을 때 가려 둔 보고서 그대로(AI를 다시 부르지 않음)
  if (v === 'home') return leaveShop();
  restartShop();
}
function openReport() { sfx('seal'); BGM.play('report', 1200); sceneChange(reportSkeleton).then(fillReport); }   // 보고서: 책 드르륵 → 탁(월화와 같은 소리) + 보고서 곡
function reportSkeleton() {
  const wt = $('#webtoon'); wt.hidden = false; wt.classList.add('rp-mode'); wt.scrollTop = 0; wt.dataset.i = 'report'; $('#progress').hidden = false; $('#progress').textContent = '총정리';
  wt.innerHTML = `<div class="wt-top">나의 별자리</div><div class="rp-title"><h2>${esc(nim() || '나')}의 하늘</h2><p>유화가 정리한 타고난 별자리</p></div><div id="rp-body"><div class="wt-typing"><i></i><i></i><i></i></div></div>`;
}
async function fillReport() {
  const wt = $('#webtoon');
  try {
    // 뒤에서 미리 만든 보고서가 있으면 그것을, 없거나 실패했으면 지금 받는다
    const pre = st.reportP; st.reportP = null;
    const again = () => post('/api/report', {...who(), plan: st.plan, items: st.answers.filter(Boolean)}).catch(e => taken(e) ? keepWait(k => k.parts?.report).then(data => ({data})) : Promise.reject(e));   // 보고서를 다른 요청이 만드는 중·이미 만듦이면 보관함에서
    const {data: d} = await (pre ? pre.catch(again) : again());
    const table = a => `<dl class="rp-table">${a.map(x => `<dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd>`).join('')}</dl>`;
    const paras = t => (t || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${hl(esc(p.replace(/\n/g, ' ')))}</p>`).join('');
    $('#rp-body').innerHTML = `
      <div class="rp-hello"><img class="rp-face" src="assets/yuhwa-head.${IMG}" alt=""><p class="rp-bub">${esc(d.overview)}</p></div>
      <section class="rp-box"><h3 class="lbl">타고난 성향</h3>${table(d.nature)}</section>
      <section class="rp-box"><h3 class="lbl">분야별 모습</h3>${table(d.areas)}</section>
      <section class="rp-box"><h3 class="lbl">지금 부는 바람</h3><ol class="rp-time">${(d.now || []).map(m => `<li><b>${esc(m.when)}</b><span>${esc(m.what)}</span></li>`).join('')}</ol></section>
      <section class="rp-box"><h3 class="lbl">해 볼 일</h3><ul class="rp-check">${d.todo.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section class="rp-box"><h3 class="lbl">오래 챙길 점</h3><ul class="rp-list">${d.watch.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section class="rp-box"><h3 class="lbl">별마다 전체 풀이</h3>${st.answers.filter(Boolean).map((x, k) => `<details class="rp-acc"><summary><span>${k + 1}. ${esc(x.title)}</span><em>펼치기</em></summary>${x.headline ? `<p class="rp-acc-head">${esc(x.headline)}</p>` : ''}${paras(x.body)}</details>`).join('')}${TEST_COPY ? '<button type="button" class="rp-copy" id="rp-copy">전체 복사 (시험용)</button>' : ''}</section>
      <div class="rp-hello rp-closing"><img class="rp-face" src="assets/yuhwa-head.${IMG}" alt=""><p class="rp-bub">${esc(d.closing)}</p></div>
      <div class="rp-sign"><img src="assets/yuhwa-sign.${IMG}" alt="유화의 서명"><div class="stk duo" aria-hidden="true">${stkImgs('duo-banzai')}</div></div>
      ${keepUrl() ? `<section class="rp-box rp-keep"><h3 class="lbl">다시 보기</h3><p>이 링크로 1년 동안 다시 볼 수 있어요</p><a href="${esc(keepUrl())}" target="_blank" rel="noopener">${esc(keepUrl())}</a></section>` : ''}
      <div class="rp-actions"><button class="wt-btn" type="button" id="rp-pdf">PDF로 저장</button><button class="rp-ghost" type="button" id="rp-close">닫기</button></div>`;
    if (st.orderId) payEnd(true);   // 보고서까지 건넴(관문은 이미 서버의 기록으로 이어 만들기 재료를 지웠다)
    $('.rp-sign > img').addEventListener('animationstart', () => sfx('reveal'), {once: true});   // 서명이 써지기 시작할 때 반짝 소리(월화와 같음, 2026-10-25 haru)
    revealPanels(wt);   // 서명도 화면에 들어올 때 써지기 시작한다(월화처럼 — 미리 붙이면 손님이 내려오기 전에 다 써져 버린다)
    $('#rp-pdf').onclick = e => INAPP ? pdfOutside(e.currentTarget) : print();
    if (TEST_COPY) $('#rp-copy').onclick = e => copyAll(e.currentTarget);
    $('#rp-close').onclick = () => sceneChange(() => { wt.hidden = true; $('#progress').hidden = true; }).then(afterClose);   // 겹치기 동안엔 화면만 바꾸고, 말은 그 뒤에(손님 탭을 기다리면 전환이 멈춘다)
  } catch { $('#rp-body').innerHTML = `<p class="wt-err">${esc(pickLine('reportFail'))}</p><div class="wt-end"><button class="wt-btn" type="button" id="rp-retry">다시 받기</button></div>`; $('#rp-retry').onclick = openReport; }
}

// ── 오프닝: 스텔라를 따라 탑 계단 → 탑 꼭대기 문 → 창가에 선 유화가 돌아보며 첫 인사 → 앉은 유화로 바뀌며 대화(손님은 그리지 않는다) ──
// 카메라는 앞으로만, 다음 그림은 앞 그림 위로 겹쳐 나타난다(혜화 오프닝 원칙). 그림이 없으면 건너뛴다. ?intro=0 이면 오프닝 없이(자동 점검용)
const OPEN_SHOTS = [{name: 'intro-1', hold: 1800, to: 1.08}, {name: 'intro-2', hold: 1600, to: 1.07}, {name: 'intro-3', hold: 900, to: 1.04}];   // 그림은 오늘 테마판(themeSrc)
const SKIP_INTRO = AGAIN || new URLSearchParams(location.search).get('intro') === '0' || ['paid', 'payFail', 'resume', 'view'].some(k => new URLSearchParams(location.search).has(k));   // 결제창·보관 링크에서 돌아오면 오프닝 없이
const decodeSrc = src => new Promise(r => { const im = new Image(); im.src = src; im.decode().then(() => r(im), () => r(null)); });
const openStage = (async () => {
  if (SKIP_INTRO) return null;
  await themesReady;
  const ims = await Promise.all(OPEN_SHOTS.map(o => decodeSrc(themeSrc(o.name))));
  if (!ims[0]) return null;
  const ov = $('#intro'); ims[0].className = 'shot on'; ov.prepend(ims[0]); ov.hidden = false; $('#gate').classList.add('over-intro');   // 시작 화면 = 탑 아래 계단(스텔라)
  return {ov, ims};
})();
async function opening() {
  const stage = await openStage;
  if (!stage) { BGM.play('talk'); return false; }   // 오프닝 그림이 없거나 ?intro=0이면 바로 대화 곡
  const {ov, ims} = stage, fr = $('#frame'), last = ims.length - 1;
  fr.classList.add('intro-run');
  let skipped = false, next = null;
  const hold = ms => new Promise(r => { if (skipped) return r(); const t = setTimeout(() => { next = null; r(); }, ms); next = () => { clearTimeout(t); next = null; r(); }; });
  ov.onclick = e => { if (!e.target.closest('button') && next) next(); };
  // 건너뛰기 = 유화가 처음 나타나는 장면(창가에 선 유화)으로 바로(2026-10-24 haru 「처음 유화가 등장하는 시점으로 건너뛰는거라서」). 거기서 첫 인사를 하고 손님이 눌러야 넘어간다
  const anims = [];
  const showLast = () => { anims.forEach(x => x.cancel()); ov.querySelectorAll('img.shot').forEach(i => { if (i !== ims[last]) i.remove(); });
    if (ims[last]) { ims[last].className = 'shot on'; if (!ims[last].isConnected) ov.insertBefore(ims[last], $('#intro-skip')); } };
  $('#intro-skip').onclick = () => { if (skipped) return; skipped = true; if (next) next(); showLast(); fr.classList.remove('intro-run'); };
  const push = (im, to) => MOTION && anims.push(im.animate([{transform: 'scale(1)'}, {transform: `scale(${to})`}], {duration: 6000, easing: 'cubic-bezier(.25,.1,.5,1)', fill: 'forwards'}));
  push(ims[0], OPEN_SHOTS[0].to); await hold(OPEN_SHOTS[0].hold);
  for (let k = 1; k < ims.length; k++) {
    if (skipped || !ims[k]) break;
    const im = ims[k]; im.className = 'shot'; ov.insertBefore(im, $('#intro-skip')); push(im, OPEN_SHOTS[k].to);
    const f = im.animate([{opacity: 0, filter: 'blur(3px)'}, {opacity: 1, filter: 'blur(0)'}], {duration: MOTION ? 700 : 1, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards'}); anims.push(f);
    await f.finished.catch(() => {}); if (skipped) break;
    await hold(OPEN_SHOTS[k].hold);
  }
  if (skipped) showLast();
  // 첫 인사는 창가에 선 유화 그림 위에서(대화창이 아래에서 올라온다). 건너뛰었어도 여기서 멈추고 손님이 눌러야 넘어간다
  fr.classList.remove('intro-run'); fr.classList.add('intro-talk');
  await say(pickLine('greetFirst'));
  await vnReady;
  // 월화처럼: 화면이 천천히 어두워졌다가(오프닝 곡이 같이 멀어짐) 앉은 유화의 방이 밝아지며 나타난다
  fr.classList.remove('intro-talk'); $('#line').textContent = '';
  BGM.out(1600);
  const blk = ov.querySelector('.intro-black') || ov.appendChild(Object.assign(document.createElement('i'), {className: 'intro-black'}));
  if (MOTION) { await blk.animate([{opacity: 0}, {opacity: 1}], {duration: 1100, easing: 'ease-in', fill: 'forwards'}).finished; await wait(500); }
  ov.querySelectorAll('img.shot').forEach(i => i.remove());
  BGM.play('talk');   // 방이 밝아지기 시작할 때 대화 곡(앞 곡은 이미 꺼짐)
  if (MOTION) await ov.animate([{opacity: 1}, {opacity: 0}], {duration: 1200, easing: 'ease-out', fill: 'forwards'}).finished;
  ov.hidden = true; ov.getAnimations().forEach(x => x.cancel()); blk.getAnimations().forEach(x => x.cancel()); blk.remove();
  ov.onclick = null;
  return true;
}
$('#gate-go').addEventListener('click', e => { e.currentTarget.disabled = true; if (PAY_BACK) { BGM.play('talk'); $('#gate').classList.add('out'); setTimeout(() => { $('#gate').hidden = true; }, 450); payReturn(); return; } BGM.play('opening'); $('#gate').classList.add('out'); setTimeout(() => { $('#gate').hidden = true; }, 450); opening().then(g => { st.greeted = g; main(); }); });

// ── 별 잇기(시안 docs/페이지/별-잇기-시안.html, 2026-10-21 haru 해석 확정): 손님 해 별자리의 진짜 모양이 뜨고, 질문 별(노란 별 7 + 고민 분홍 별)이
//    차례대로 반짝인다. 누르면 그 별의 풀이(웹툰)가 열리고, 다 보고 돌아오면 선이 이어진다. 다 이으면 별자리 완성 → 보고서.
//    별 위치는 공개 별 자료(app/zodiac.js, d3-celestial BSD-3)의 실제 좌표.
const skyDone = new Set();
const SKY = {W: 360, top: 112, bot: 250, pad: 40};   // top 112: 별이 위쪽 'n번째 별 준비됐어요' 글자(62~80px)와 겹치지 않게(2026-10-25 haru, 게자리 맨 위 별), 전 70   // bot 250: 아래쪽은 말 상자와 유화 스티커 자리(2026-10-23, 전 150)
function skyLayout(c, H) {
  const ras = c.stars.map(s => s[0]), decs = c.stars.map(s => s[1]);
  const ra0 = ras[0], unwrap = r => { let d = r - ra0; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };   // 0°/360° 넘는 별자리(물고기 등)
  const dec0 = (Math.min(...decs) + Math.max(...decs)) / 2, cos = Math.cos(dec0 * Math.PI / 180);
  const xs = ras.map(r => -unwrap(r) * cos), ys = decs.map(d => -d);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = SKY.W - 2 * SKY.pad, h = H - SKY.top - SKY.bot;
  const k = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1));
  const ox = (SKY.W - (maxX - minX) * k) / 2, oy = SKY.top + (h - (maxY - minY) * k) / 2;
  const pos = xs.map((x, i) => [ox + (x - minX) * k, oy + (ys[i] - minY) * k]);
  // 별 위치는 실제 하늘 그대로지만, 누를 별끼리 너무 붙으면(물고기자리 2·3번 등) 폰에서 손가락으로 고르기 어려워 서로 조금씩 밀어 띄운다(2026-10-23 haru)
  const MIN = 36, q = c.q;
  for (let it = 0; it < 40; it++) for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) {
    const a = pos[q[i]], b = pos[q[j]], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || .01;
    if (d >= MIN) continue;
    const m = (MIN - d) / 2, ux = dx / d, uy = dy / d; a[0] -= ux * m; a[1] -= uy * m; b[0] += ux * m; b[1] += uy * m;
  }
  return pos;
}
// 꼬마 스티커(2026-10-23 haru): 그림 두 장을 번갈아 띄워 움직이는 것처럼(게임 스티커 연출). 움직임 줄이기면 한 장만 가만히. 누르는 데는 방해하지 않는다.
// 유화: 처음엔 손 흔들기, 별을 보고 돌아오면 별마다 다른 포즈(YU_POSE), 차례 아닌 별을 누르면 '아직이에요', 다 이으면 스텔라와 만세(보고서 버튼 위).
// 스텔라: 화면 밖(돌아올 땐 방금 본 별)에서 다음 차례 별까지 활공 → 별 옆에 앉아 꼬리 살랑, 별을 누르면 그 별을 꼭 안는다. 별도 반짝이는 스티커
const STK = ['yuhwa-wave', ...['cheer', 'telescope', 'book', 'heart', 'cocoa', 'point', 'think', 'clap'].map(n => 'yuhwa-' + n), 'yuhwa-oops', ...['star', 'love', 'coin', 'color', 'scroll'].map(n => 'yuhwa-day-' + n), 'duo-banzai', 'stella-glide', 'stella-perch', 'stella-hug', 'star-gold', 'star-pink'];
let stkWarm = false;
const warmStickers = () => { if (stkWarm) return; stkWarm = true; STK.forEach(n => [1, 2].forEach(f => { new Image().src = `assets/sticker-${n}-${f}.${IMG}`; })); };   // 밤하늘이 처음 열릴 때 미리 받아 두어 바뀔 때 깜빡이지 않게
const stkImgs = name => `<img src="assets/sticker-${name}-1.${IMG}" alt=""><img src="assets/sticker-${name}-2.${IMG}" alt="">`;
const stk = (name, cls) => `<div class="stk ${cls}" aria-hidden="true">${stkImgs(name)}</div>`;
const setStk = (el, name) => { if (el && el.dataset.n !== name) { el.dataset.n = name; el.classList.remove('ok'); el.innerHTML = stkImgs(name); } };
// 두 장이 다 받아진 뒤에만 번갈아 바꾼다(.ok). 전에는 첫 비행 때 2장째가 아직 안 와서 반 박자마다 스텔라가 사라졌다 나타났다(2026-10-24 haru)
document.addEventListener('load', e => { const b = e.target.closest?.('.stk'); if (b && e.target.tagName === 'IMG' && [...b.querySelectorAll('img')].every(i => i.complete && i.naturalWidth)) b.classList.add('ok'); }, true);
// 별 스티커(SVG 안): 크기는 별 밝기대로, 고민 별은 분홍
const starArt = (x, y, size, pink) => { const n = pink ? 'star-pink' : 'star-gold', h = size / 2;
  return `<g class="sk-art"><image href="assets/sticker-${n}-1.${IMG}" x="${x - h}" y="${y - h}" width="${size}" height="${size}"/><image class="f2" href="assets/sticker-${n}-2.${IMG}" x="${x - h}" y="${y - h}" width="${size}" height="${size}"/></g>`; };
// 별 하나 보고 돌아올 때마다 유화 포즈가 바뀐다(2026-10-23 haru: 하나 고정 말고 다양하게, 별이 8개)
const HAT_OF = {'양자리': 'aries', '황소자리': 'taurus', '쌍둥이자리': 'gemini', '게자리': 'cancer', '사자자리': 'leo', '처녀자리': 'virgo', '천칭자리': 'libra', '전갈자리': 'scorpio', '사수자리': 'sagittarius', '궁수자리': 'sagittarius', '염소자리': 'capricorn', '물병자리': 'aquarius', '물고기자리': 'pisces'};
const HAT_HAVE = new Set(Object.values(HAT_OF));   // 12별자리 모자 모두(2026-10-24, 각 별자리 대표 색)
const YU_POSE = ['cheer', 'telescope', 'book', 'heart', 'cocoa', 'point', 'think', 'clap'];
function stickers(sky, star, from, all, doneK) {
  // 별 잇기가 처음 열릴 때는 손님 별자리 모자를 쓴 꼬마 유화가 손을 흔든다(2026-10-24 haru, 맛보기 게·사자 — 그림이 있는 별자리만, 가짜 답에서 ?hat=leo로 바꿔 보기)
  const hatKey = (DEV && new URLSearchParams(location.search).get('hat')) || HAT_OF[st.chart.sunSign || st.chart.sunSigns?.[0]];
  const pose = all ? 'duo-banzai' : from ? 'yuhwa-' + YU_POSE[doneK % YU_POSE.length] : HAT_HAVE.has(hatKey) ? 'yuhwa-hat-' + hatKey : 'yuhwa-wave';
  sky.insertAdjacentHTML('beforeend', stk(pose, 'yuhwa' + (all ? ' hi' : '')) + (star ? stk('stella-glide', 'stella') : ''));
  const yu = sky.querySelector('.stk.yuhwa'); yu.dataset.n = yu.dataset.base = pose;
  const sq = sky.querySelector('.stk.stella'); if (!sq) return;
  sq.dataset.n = 'stella-glide';
  const b = sky.getBoundingClientRect(), k = b.width / sky.offsetWidth || 1;   // 화면 배율(무대 확대·축소)을 빼고 무대 좌표로
  const at = el => { const q = el.getBoundingClientRect(); return [(q.left + q.width / 2 - b.left) / k, (q.top + q.height / 2 - b.top) / k]; };
  const [sx, sy] = at(star), W = sky.offsetWidth, others = [...sky.querySelectorAll('.sk-core')].filter(e => e !== star).map(at);
  // 별 네 귀퉁이 중 다른 별에서 가장 먼 자리에 앉는다(별을 가리지 않고 화면 안에서)
  const cand = [[10, -74], [-78, -74], [10, 6], [-78, 6]].map(([dx, dy]) => [Math.min(W - 72, Math.max(4, sx + dx)), Math.min(sky.offsetHeight - 220, Math.max(64, sy + dy))]);
  const room = ([x, y]) => Math.min(...others.map(([ox, oy]) => Math.hypot(ox - (x + 34), oy - (y + 34))), 999);
  const [x, y] = cand.reduce((m, c) => room(c) > room(m) ? c : m);
  const land = () => setStk(sq, 'stella-perch');
  if (!MOTION) { sq.style.transform = `translate(${x}px,${y}px)`; land(); return; }
  const [fx, fy] = from ? at(from).map(v => v - 34) : [-90, sky.offsetHeight * .55];
  sq.style.transform = `translate(${fx}px,${fy}px) rotate(${fx < x ? -12 : 12}deg)` + (fx > x ? ' scaleX(-1)' : '');   // 왼쪽으로 날 땐 좌우를 뒤집는다
  requestAnimationFrame(() => requestAnimationFrame(() => { sq.classList.add('fly'); sq.style.transform = `translate(${x}px,${y}px)`; }));
  sq.addEventListener('transitionend', land, {once: true});
}
// 별을 누르면 스텔라가 그 별로 가서 꼭 안는다
function stellaHug(sky, star) {
  const sq = sky.querySelector('.stk.stella'); if (!sq) return;
  const b = sky.getBoundingClientRect(), k = b.width / sky.offsetWidth || 1, q = star.getBoundingClientRect();
  const x = (q.left + q.width / 2 - b.left) / k - 34, y = (q.top + q.height / 2 - b.top) / k - 40;
  setStk(sq, 'stella-hug'); sq.classList.remove('fly'); sq.classList.add('hop'); sq.style.transform = `translate(${x}px,${y}px)`;
}
function openSky(justDone = null) {
  $('#frame').classList.remove('daily-talk'); waitStk(true);   // 기다림 밤하늘에서 넘어올 때(꼬마 유화는 여기서 퇴장)
  const sign = st.chart.sunSign || st.chart.sunSigns[0], c = ZODIAC[sign], main = MAIN(), total = main.length + (st.concern ? 1 : 0);
  const H = $('#frame').offsetHeight || 640, pos = skyLayout(c, H), sky = $('#sky');
  const qOf = id => c.q.indexOf(id), isQ = id => { const k = qOf(id); return k >= 0 && k < total; };
  const nextK = [...Array(total).keys()].find(k => !skyDone.has(k));
  const lit = id => isQ(id) ? skyDone.has(qOf(id)) : false;
  // 작은 별은 선으로 이어진 질문 별 중 하나라도 다 보면 켜진다
  const nb = id => c.edges.filter(e => e[0] === id || e[1] === id).map(e => e[0] === id ? e[1] : e[0]);
  const smallLit = id => nb(id).some(lit) || nb(id).some(m => !isQ(m) && nb(m).some(lit));
  const on = id => isQ(id) ? lit(id) : smallLit(id);
  let g = '';
  let seed = sign.length * 977 + 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 70; n++) g += `<circle cx="${(rnd() * SKY.W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${(rnd() * .7 + .3).toFixed(2)}" class="sk-dust" opacity="${(rnd() * .3 + .1).toFixed(2)}"/>`;
  for (const [a, b, dot] of c.edges) {
    const [x1, y1] = pos[a], [x2, y2] = pos[b], len = Math.hypot(x2 - x1, y2 - y1).toFixed(1), o = on(a) && on(b);
    const fresh = o && justDone != null && [a, b].some(id => qOf(id) === justDone);
    g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sk-edge${dot ? ' dot fill' : ''}${o ? ' on' : ''}${fresh ? ' fresh' : ''}" style="--len:${len}"/>`;
  }
  c.stars.forEach((s, id) => {
    const [x, y] = pos[id], k = qOf(id);
    if (!isQ(id)) { g += `<circle cx="${x}" cy="${y}" r="${Math.max(1.3, 3.2 - s[2] * .4).toFixed(2)}" class="sk-small${on(id) ? ' on' : ''}"/>`; return; }
    const done = skyDone.has(k), can = done || k === nextK, R = (5.4 - Math.min(s[2], 4) * .45).toFixed(2), concern = k === main.length;
    const label = concern ? '따로 궁금한 것' : starLabel(main[k]);
    g += `<g class="sk-q${concern ? ' concern' : ''}${done ? ' done' : ''}${can ? '' : ' locked'}" data-k="${k}" role="button" tabindex="${can ? 0 : -1}" aria-label="별 ${k + 1}: ${esc(label)}">
      <circle cx="${x}" cy="${y}" r="13" class="sk-halo${!done && can ? ' next' : ''}"/><circle cx="${x}" cy="${y}" r="${R}" class="sk-core"/>${starArt(x, y, Math.round(R * 6.2), concern)}<circle cx="${x}" cy="${y}" r="22" fill="transparent"/>
      ${done ? `<text x="${x}" y="${y - 15}" class="sk-label">${k + 1}</text>` : ''}</g>`;
  });
  const all = skyDone.size >= total;
  // 말풍선(대사 고르기 4 확정): 처음 · 돌아올 때마다 · 고민 별 차례 · 완성. {sign} = 손님 태양 별자리(경계면 이름 없는 줄만)
  const sv = {sign: st.chart.sunSign};
  const line = all ? pickLine('skyDone', sv) : skyDone.size === 0 ? pickLine('skyStart', sv) : nextK === main.length ? pickLine('skyConcern', sv) : pickLine('skyNext', sv);
  sky.innerHTML = `<svg viewBox="0 0 ${SKY.W} ${H}" class="sk-svg art">${g}</svg><div class="sk-hud"><b>${esc(sign)}</b><span>${skyDone.size} / ${total}</span></div>${nextK == null ? '' : '<p class="sk-ready" aria-live="polite"></p>'}
    <div class="sk-say"><span class="who">유화</span><p class="line">${esc(line)}</p></div>${all ? `<div class="sk-end"><button class="wt-btn" type="button" id="sk-report">총정리 보고서 받기</button></div>` : ''}`;
  // 풀이 곡(2026-10-24 haru): 운세를 봤든 안 봤든 같은 때 — '다 봤어요' 뒤 별 잇기 화면이 뜨는 순간, 대화 곡을 1.6초 동안 줄이고 풀이 곡
  BGM.play('reading', 1600);
  skyBg(sky);
  { const nx = sky.querySelector('.sk-halo.next')?.parentNode; nx?.parentNode.append(nx); }   // 겹치면 지금 차례 별이 손가락에 먼저 닿게 맨 위로
  sky.hidden = false;
  stickers(sky, nextK == null ? null : sky.querySelector(`.sk-q[data-k="${nextK}"] .sk-core`), justDone == null ? null : sky.querySelector(`.sk-q[data-k="${justDone}"] .sk-core`), all, justDone);
  startAll();   // 모든 별을 미리 받기 시작(한 번만 — 보통은 설계도가 끝날 때 이미 시작됨)
  // 다음 별 풀이가 다 써졌는지 밤하늘에 작게: 쓰는 중이면 '유화가 별을 읽는 중', 다 되면 '준비됐어요'(누르면 바로 보임)
  { const el = sky.querySelector('.sk-ready'), job = nextK == null ? null : fetchAnswer(nextK);
    const show = () => { if (!el?.isConnected) return job?.subs.delete(show); el.textContent = job.done ? `${nextK + 1}번째 별 준비됐어요` : job.err ? '' : '유화가 별을 읽는 중…'; el.classList.toggle('ok', !!job.done); };
    if (el && job) { job.subs.add(show); show(); }
    // 다음 별은 풀이가 다 써진 뒤에만 눌린다(누르면 바로 웹툰 전체가 보이게). 그 전엔 반짝이지 않고, 누르면 '읽는 중' 표시만 한 번 깜빡
    const g = nextK == null ? null : sky.querySelector(`.sk-q[data-k="${nextK}"]`);
    const gate = () => { if (!g?.isConnected) return job?.subs.delete(gate); g.classList.toggle('wait', !job.done && !job.err); };
    if (g && job) { job.subs.add(gate); gate(); } }
  // 아직 차례가 아닌 별을 누르면 짧게 알려 준다(2026-10-22 haru 선택)
  sky.querySelectorAll('.sk-q.locked').forEach(el => el.addEventListener('click', () => {
    const say = sky.querySelector('.sk-say'); if (say) say.innerHTML = `<span class="who">유화</span><p class="line">${esc(pickLine('skyLocked', sv))}</p>`;
    const yu = sky.querySelector('.stk.yuhwa'); setStk(yu, 'yuhwa-oops'); clearTimeout(yu?._t); if (yu) yu._t = setTimeout(() => setStk(yu, yu.dataset.base), 1800); }));
  sky.querySelectorAll('.sk-q:not(.locked)').forEach(el => {
    const go = () => { if (el.classList.contains('wait')) { const r = sky.querySelector('.sk-ready'); r?.classList.remove('nudge'); void r?.offsetWidth; r?.classList.add('nudge'); return; }
      sparkleAt(el.querySelector('.sk-core'), 8); stellaHug(sky, el.querySelector('.sk-core')); setTimeout(() => { sky.hidden = true; openWebtoon(+el.dataset.k); }, MOTION ? 750 : 0); };
    el.addEventListener('click', go); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  $('#sk-report')?.addEventListener('click', () => { sky.hidden = true; openReport(); });
}

// 소리 버튼(월화와 같은 자리·모양): 배경음악(BGM)을 끄고 켠다. 끈 상태는 기억하지 않는다(새로 열면 소리 켬 — 월화·혜화와 같음)
{ const b = document.getElementById('sound-btn');
  if (b) b.onclick = e => { e.stopPropagation(); window.SOUND_MUTED = !window.SOUND_MUTED; BGM.setMuted(window.SOUND_MUTED); b.classList.toggle('off', window.SOUND_MUTED); b.setAttribute('aria-label', window.SOUND_MUTED ? '소리 켜기' : '소리 끄기'); b.setAttribute('aria-pressed', String(window.SOUND_MUTED)); }; }
