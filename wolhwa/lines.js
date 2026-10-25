// 월화 대사 (2026-10-11: 대본 방식). 원본은 docs/캐릭터/월화 대본/*.md·이벤트/*.md, 기본 대사는 docs/캐릭터/월화 대사 목록.md
// 점검용 주소 설정(?script= ?at= ?intro= ?gate=)은 가짜 답 모드이거나 이 PC(127.0.0.1)에서 열었을 때만 켠다. 출시 사이트·폰 시험 링크에서는 꺼짐(2026-10-20)
const DEV_MODE = typeof window !== 'undefined' && (!!window.WOLHWA_MOCK || ['127.0.0.1', 'localhost'].includes(location.hostname));
// 폰 글자 크기 최대치(2026-10-20 haru): 폰이 글자를 키운 배율을 한 번 재서, 최대치를 넘는 폰에서만 넘친 만큼 줄인다. 보통 폰(배율 1)과 최대치 안의 폰은 아무것도 바뀌지 않는다
// 대화 화면(대사·이름표·선택 버튼) 최대 1.3배, 읽는 화면(웹툰·보고서·운세 창 글) 최대 1.5배. 줄이는 방법은 CSS zoom(글자·여백만 줄고, 폭 100% 그림은 그대로) — style.css의 --tz-talk·--tz-read
const TEXT_CAP = { talk: 1.3, read: 1.5 };
if (typeof document !== 'undefined') addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {
  const p = document.createElement('span'); p.style.cssText = 'position:absolute;left:-999px;top:0;visibility:hidden;display:inline-block;font-size:100px;line-height:1'; p.textContent = '가'; document.body.append(p);
  requestAnimationFrame(() => {
    const k = p.getBoundingClientRect().height / 100; p.remove(); window.TEXT_K = k;
    for (const [name, cap] of Object.entries(TEXT_CAP)) if (k > cap + 0.02) document.documentElement.style.setProperty('--tz-' + name, (cap / k).toFixed(3));
    if (k > 1.02) { document.documentElement.style.setProperty('--tx-fix', (1 / k).toFixed(3)); document.documentElement.style.setProperty('--text-k', k.toFixed(3)); document.documentElement.style.setProperty('--text-k-talk', Math.min(k, TEXT_CAP.talk).toFixed(3)); }   // 건너뛰기처럼 키우지 않을 것(haru 2026-10-20)은 원래 크기로
  });
}));
// 점검: ?fs=2 이면 폰 '글자 크게'(갤럭시처럼 글자만 커지는 방식)를 흉내 낸다 — 모든 글자에 그 배율을 곱함(2026-10-20, tools/font-scale-test.mjs와 같은 방식)
if (DEV_MODE && typeof document !== 'undefined') {
  const K = +new URLSearchParams(location.search).get('fs');
  if (K > 1 && K <= 3) {
    let id = 0; const sheet = new CSSStyleSheet();
    const set = (el, px) => { el.dataset.fsid = ++id; sheet.insertRule('[data-fsid="' + id + '"]{font-size:' + px + 'px !important}', sheet.cssRules.length); };
    const grow = el => { if (el.nodeType !== 1 || el.dataset.fsid) return; const cs = parseFloat(getComputedStyle(el).fontSize), p = el.parentElement, ps = p ? parseFloat(getComputedStyle(p).fontSize) : 0;
      if (p && p.dataset.fsid && Math.abs(cs - ps) <= 0.01) { el.dataset.fsid = 'i'; return; } set(el, cs * K); };
    addEventListener('DOMContentLoaded', () => { document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; const all = [...document.querySelectorAll('body *')], sizes = all.map(e => parseFloat(getComputedStyle(e).fontSize)); all.forEach((e, i) => set(e, sizes[i] * K));
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(nd => { if (nd.nodeType === 1) { grow(nd); nd.querySelectorAll('*').forEach(grow); } }))).observe(document.body, { childList: true, subtree: true }); });
  }
}
// → node tools/build-scripts.mjs → scripts-data.js(SCRIPT_DATA). 대사를 고칠 땐 문서를 고치고 다시 만든다
// - 리딩(접속) 한 번에 대본 하나: 그날의 이벤트 > (날씨: 서버 생기면) > 보름달 > 시간대(아침·점심·저녁) > 밤·새벽 대본 중 하나
// - 같은 대본을 한 세션 내내 쓴다(처음으로 돌아가거나 다시 온 손님 인사 뒤에도). 대본에 없는 칸은 기본 대본(B)에서
// - 주제별 말(연애·준비 중 등)과 다시 온 손님 인사는 공통(00 공통 문서), 어떤 대본이든 같다
// - 성향(TRAIT): 늘 나오지 않고 정해진 상황에서만 한 번씩. 이 대사들은 대화창·대기 말풍선에만 쓰고 AI 풀이에는 넣지 않는다
const LINE_USED = {};
function pickLine(a, key = a.join('|')) {
  const used = LINE_USED[key] || (LINE_USED[key] = new Set());
  let idx = a.map((_, i) => i).filter(i => !used.has(i));
  if (!idx.length) { used.clear(); idx = a.map((_, i) => i); }
  const i = idx[Math.floor(Math.random() * idx.length)]; used.add(i); return a[i];
}
// 받침 있으면 a, 없으면 b. 숫자는 읽는 소리로(8 → 팔 → 받침 있음)
const josa = (w, a, b) => { const l = String(w).trim().slice(-1); if (/\d/.test(l)) return '0136780'.includes(l) ? a : b; const c = l.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? a : b; };
function ent(n) { return n ? ', ' + n : ''; }                          // 문장 끝 호칭: ', 하루님'


// ── 대본 고르기 ──
const SCRIPT_STORE = 'wolhwa.recentScripts';
const USE_SCRIPTS = false;
const NIGHT_POOL = ['01', '02', '03', '04', '07', '08', '10', 'B'];
function kstNow(at) {      // 한국 시각의 날짜·시
  const d = at ? new Date(at) : new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, md: `${p.month}-${p.day}`, hour: +p.hour, t: d.getTime() };
}
function timeSlot(h) { return h < 6 ? '새벽' : h < 11 ? '아침' : h < 17 ? '점심' : h < 21 ? '저녁' : '밤'; }
function moonAge(t) { return (((t - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853 + 29.530588853) % 29.530588853; }   // 신월 뒤 며칠
const isFullMoon = t => { const a = moonAge(t); return a >= 12.8 && a <= 16.8; };     // 보름 앞뒤 2일쯤
function store(get, set) { try { return set === undefined ? JSON.parse(localStorage.getItem(get) || 'null') : localStorage.setItem(get, JSON.stringify(set)); } catch { return null; } }
function chooseScript() {
  const q = new URLSearchParams(location.search), dev = DEV_MODE;   // 점검용(가짜 답 서버에서만): ?script=E07 · ?at=2026-12-25T13:00+09:00
  if (dev && SCRIPT_DATA.scripts[q.get('script')]) return q.get('script');
  if (!USE_SCRIPTS) return 'B';                                    // 2026-10-11 사용자: 대본보다 상황별 묶음 무작위(코덱스 방식)가 캐릭터가 더 산다 → 기본 대사(B)만. 대본은 ?script=로만 볼 수 있음
  const now = kstNow(dev && q.get('at') ? q.get('at') : undefined), slot = timeSlot(now.hour);
  const recent = store(SCRIPT_STORE) || [], seen = id => recent.includes(id);
  const remember = id => { store(SCRIPT_STORE, [id, ...recent.filter(x => x !== id)].slice(0, 5)); return id; };
  const lunar = SCRIPT_DATA.lunar[now.date], ev = (lunar === 'E02' || lunar === 'E17') ? lunar : (SCRIPT_DATA.fixed[now.md] || lunar);
  const evKey = 'wolhwa.event.' + now.date;
  if (ev && !store(evKey)) { store(evKey, 1); return remember(ev); }          // 이벤트 날은 그날 첫 리딩에만
  // 날씨(05 비·14 눈): 전국 날씨를 알려 줄 서버가 생기면 여기서 고른다(지금은 안 나옴)
  if (slot !== '아침' && slot !== '점심' && isFullMoon(now.t) && !seen('09')) return remember('09');
  if (slot === '아침') return remember('11');
  if (slot === '점심') return remember('12');
  if (slot === '저녁') return remember('13');
  const pool = slot === '새벽' ? ['06', ...NIGHT_POOL] : NIGHT_POOL, fresh = pool.filter(id => !seen(id));
  const from = fresh.length ? fresh : pool;
  return remember(from[Math.floor(Math.random() * from.length)]);
}
function themeNow() {
  const q = new URLSearchParams(location.search), dev = DEV_MODE;
  const now = kstNow(dev && q.get('at') ? q.get('at') : undefined), slot = timeSlot(now.hour);
  const lunar = SCRIPT_DATA.lunar[now.date], ev = (lunar === 'E02' || lunar === 'E17') ? lunar : (SCRIPT_DATA.fixed[now.md] || lunar);
  const EV = { E21: 'halloween', E24: 'christmas', E01: 'newyear', E02: 'seol', E17: 'chuseok' };
  return EV[ev] || ({ 아침: 'morning', 점심: 'noon', 저녁: 'evening' })[slot] || '';
}
let SCRIPT = null;
const script = () => SCRIPT || (SCRIPT = SCRIPT_DATA.scripts[chooseScript()]);
const COMMON_KEYS = new Set(Object.keys(SCRIPT_DATA.common));
const callName = () => (typeof nim === 'function' && nim()) || '손님';   // 이름 없이 보면 '손님'(대화창에서만. AI 요청의 nim()은 그대로)
function fill(s, v = {}) {
  return s.replace(/\{P\}/g, v.p ?? '').replace(/\{N\}/g, v.n || callName()).replace(/\{Q\}/g, v.q ?? '').replace(/\{K\}/g, v.k ?? '').replace(/\{O\}/g, v.o ?? '').replace(/\{W\}/g, v.w ?? '')
    .replace(/\{C(?:\|([^|}]*)\|([^}]*))?\}/g, (_, a, b) => (v.c ?? '') + (a === undefined ? '' : josa(v.c ?? '', a, b)))
    .replace(/\{L(?:\|([^|}]*)\|([^}]*))?\}/g, (_, a, b) => (v.l ?? '') + (a === undefined ? '' : josa(v.l ?? '', a, b)));
}
function pool(key) { return COMMON_KEYS.has(key) ? SCRIPT_DATA.common[key] : (script().lines[key] || SCRIPT_DATA.scripts.B.lines[key] || []); }
// 대사 끝의 표정 표시 {@표정}은 떼어 내고 글에 붙여 둔다(say가 그 표정으로 바꿈). 표시가 없으면 평범한 글
const withFace = s => { const m = s.match(/\{@(\w+)\}$/); return m ? Object.assign(new String(s.slice(0, -m[0].length)), { face: m[1] }) : s; };
const P = (key, v) => { const a = pool(key); return a.length ? withFace(fill(pickLine(a, key), v)) : ''; };
const all = (key, v) => pool(key).map(s => withFace(fill(s, v)));

const LINES = {
  scriptId: () => script().id,
  theme: () => themeNow(),   // 시간대·이벤트 그림 이름(vn-<표정>_<테마>, intro-<k>_<테마>). 대본과 상관없이 지금 시각·날짜로   // 시간대·이벤트 그림 이름(vn-<표정>_<테마>, intro-<k>_<테마>)
  selfCardChance: () => script().selfCardAlways ? 1 : 0.4,       // 이야기가 자기 카드 얘기로 끝나는 대본은 항상
  introDoor: () => P('introDoor'),
  greetFirst: () => P('greetFirst'),
  selfIntro: () => P('selfIntro'),
  askGender: n => n ? P('askGenderName', { n }) : P('askGenderNoName'),
  askTopic: () => P('askTopic'),
  askTopicAgain: () => P('askTopicAgain'),
  lockedTopic: label => P('lockedTopic', { l: label }),
  lockedTopicNext: () => P('lockedTopicNext'),
  love: () => P('love'),
  lockedSub: word => P('lockedSub', { w: word }),                  // word: '썸 타는 사이는' 처럼 조사까지
  lockedSubNext: () => P('lockedSubNext'),
  solo: () => P('solo'),
  crush: () => P('crush'),
  couple: () => P('couple'),                                       // 이하 주제별 첫마디(2026-10-13 초안, 00 공통 🔸)
  reunion: () => P('reunion'),
  workAsk: () => P('workAsk'),                                     // 일·돈·학업을 골랐을 때 + 지금 상황 묻기
  moneyAsk: () => P('moneyAsk'),
  studyAsk: () => P('studyAsk'),
  subAck: () => P('subAck'),                                       // 일·돈·학업의 세부 상황을 고른 뒤 받는 말
  talk: () => P('talk'),
  today: () => P('today'),
  todayAfter: () => P('todayAfter'),                                         // '좋아하는 사람 있어요'(썸·짝사랑)를 골랐을 때
  questionsIntro: k => P('questionsIntro', { k }),
  askConcern: () => P('askConcern'),
  concernOne: () => P('concernOne'),                               // 고민은 하나만(2026-10-24 haru: 여러 개 적으면 맨 앞 하나만 푼다)
  leave: () => P('leave'),                                          // 메인으로 나갈 때 작별(2026-10-24 초안)
  concernAck: () => P('concernAck'),
  concernSkip: () => P('concernSkip'),
  startDraw: () => P('startDraw'),
  question: (ord, q, first) => P(first ? 'questionFirst' : 'question', { o: ord, q }),
  cards: (k, why) => P(k === '한' ? 'cardsOne' : 'cardsMany', { k }) + (why ? '\n' + why : ''),
  shuffleFirst: () => P('shuffleFirst'),
  redeal: () => P('redeal'),
  luna: () => P('luna'),
  pick: k => P('pick', { k }),
  drawn: names => P('drawn', { c: names }),                        // 뜻은 아직 말하지 않는다(뜸 들이기)
  allPicked: () => P('allPicked'),
  pricePreview: p => P('pricePreview', { p }),                     // p: '12,900원'처럼 관문이 정한 값                           // 결제 문(2026-10-23 초안): 질문 소개 때 값 미리 · 다 뽑은 뒤 문 · 돌아옴 · 결제 안 됨 · 끝내 실패해 취소
  payDoor: () => P('payDoor'),
  payBack: () => P('payBack'),
  payFail: () => P('payFail'),
  payCanceled: () => P('payCanceled'),
  keepLink: () => P('keepLink'),                                   // 결과 보관(2026-10-23 초안): 결제 직후 링크 · 복사함 · 중간 실패 → 링크로 이어 받기 · 링크로 다시 와서 이어 갈 때
  keepCopied: () => P('keepCopied'),
  keepLater: () => P('keepLater'),
  keepResume: () => P('keepResume'),
  planWait: () => [[0, all('wait0')], [32, all('wait32')], [48, all('wait48')]],   // [몇 초부터(설계도 요청 시작 기준), 말 목록]
  dailyOffer: () => P('dailyOffer'),
  dailySkip: () => P('dailySkip'),
  dailyDrawn: name => P('dailyDrawn', { c: name }),
  dailyAfter: () => P('dailyAfter'),
  dailyShuffle: () => P('dailyShuffle'), dailyPick: () => P('dailyPick'), dailyMuse: () => P('dailyMuse'),   // 오늘의 운세 의식(00 공통, 2026-10-17)
  dailyTotal: () => P('dailyTotal'), dailyLove: () => P('dailyLove'), dailyWork: () => P('dailyWork'), dailyColor: () => P('dailyColor'), dailyAll: () => P('dailyAll'),
  planDone: () => P('planDone'),
  revealQ: (ord, names) => P('revealQ', { o: ord, c: names }),
  concernIntro: () => P('concernIntro'),
  readOn: () => P('readOn'),
  waitBubble: () => P('waitBubble'),
  done: () => P('done'),
  afterReport: () => P('afterReport'),
  selfCard: () => P('selfCard'),                                    // G 자기 카드는 안 뽑음 — 마무리에서
  excited: () => P('excited'),                                      // E 좋은 카드에 본인이 더 설렘 — 대기 말풍선
  serious: () => P('serious'),                                      // I 무거운 카드엔 단호하게 — 대기 말풍선
  nightSecret: v => withFace(fill(SCRIPT_DATA.common.nightSecret?.[v - 2] || '')),   // C 다시 온 손님에게만, 올 때마다 조금씩
  welcomeBack: n => P('welcomeBack', { n: n || undefined })
};


// 성향이 나올지 정한다. 리딩 한 번에 성향마다 최대 1번, 성향 대사 사이에는 월화 대사가 4개 이상 있어야 한다
const TRAIT = {
  used: {}, step: 0, last: -99, visits: 0,
  reset() { this.used = {}; this.last = -99; for (const k in LINE_USED) delete LINE_USED[k]; },   // 새 리딩을 시작할 때(같은 말 피하기 기록도 비움)
  tick() { this.step++; },                                            // 월화가 한 마디 할 때마다(app.js say)
  try(name, chance = 1) {
    if (this.used[name] || this.step - this.last < 4 || Math.random() > chance) return false;
    this.used[name] = true; this.last = this.step; return true;
  }
};
// 카드 기분: 정방향 좋은 카드면 'good', 무거운 카드면 'heavy'
const GOOD_CARDS = new Set(['태양', '별', '세계', '연인', '여황제', '컵 에이스', '컵 2', '컵 9', '컵 10', '완드 4', '완드 6', '펜타클 10']);
const HEAVY_CARDS = new Set(['탑', '죽음', '악마', '소드 3', '소드 9', '소드 10']);
// 카드 뽑는 동안 월화 표정: 질문마다 같은 표정만 반복되지 않게 후보 중에서 고른다(바로 앞과 같은 표정은 피함)
const DRAW_FACES = {
  question: ['think', 'normal', 'tease', 'warm', 'curious'],
  good: ['smile', 'amused', 'surprised'], heavy: ['worried', 'think'], '': ['smile', 'warm', 'amused', 'normal']
};
let lastDrawFace = '';
function drawFace(kind) {
  const pool = DRAW_FACES[kind].filter(f => f !== lastDrawFace);
  return (lastDrawFace = pool[Math.floor(Math.random() * pool.length)]);
}
function cardMood(cards) {
  if (cards.some(c => HEAVY_CARDS.has(c.name) && !c.rev)) return 'heavy';
  if (cards.some(c => GOOD_CARDS.has(c.name) && !c.rev)) return 'good';
  return '';
}
