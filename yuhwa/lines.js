// 폰 글자 크기 최대치(월화 lines.js 2026-10-20을 복사, 2026-10-23 큰 틀 맞추기): 폰이 글자를 키운 배율을 한 번 재서, 최대치를 넘는 폰에서만 넘친 만큼 줄인다. 보통 폰은 그대로
// 대화 화면(대사·이름표·선택 버튼) 최대 1.3배, 읽는 화면(웹툰) 최대 1.5배 — style.css의 --tz-talk·--tz-read, 화면 틀(가게 이름·진행도·건너뛰기)은 --tx-fix로 원래 크기
const TEXT_CAP = { talk: 1.3, read: 1.5 };
if (typeof document !== 'undefined') addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {
  const p = document.createElement('span'); p.style.cssText = 'position:absolute;left:-999px;top:0;visibility:hidden;display:inline-block;font-size:100px;line-height:1'; p.textContent = '가'; document.body.append(p);
  requestAnimationFrame(() => {
    const k = p.getBoundingClientRect().height / 100; p.remove(); window.TEXT_K = k;
    for (const [name, cap] of Object.entries(TEXT_CAP)) if (k > cap + 0.02) document.documentElement.style.setProperty('--tz-' + name, (cap / k).toFixed(3));
    if (k > 1.02) { document.documentElement.style.setProperty('--tx-fix', (1 / k).toFixed(3)); document.documentElement.style.setProperty('--text-k', k.toFixed(3)); document.documentElement.style.setProperty('--text-k-talk', Math.min(k, TEXT_CAP.talk).toFixed(3)); }
  });
}));
// 유화 대사 고르기: 장면마다 여러 줄 중 하나, 한 리딩 안에서 같은 줄을 다시 쓰지 않는다(공통 기준 3장, 월화 pickLine 방식).
// 줄은 app/lines-data.js(대사 목록에서 자동 생성 — 손으로 고치지 않는다). 줄마다 표정이 붙어 있다({t, f}).
// {name} = "○○님"(이름이 없으면 "손님" — 대사 목록 규칙), {sign} = 손님 해 별자리, {count} = 질문 수.
// {sign}처럼 값이 없는 자리가 있는 줄은 고르지 않는다(해가 별자리 경계에 걸친 날 — 대사 목록 askBirthTime 설명).
const used = new Set();
let lastFace = 'smile', lineName = '';
// 뿌(pout)는 볼 부풀린 그림(puff)과 번갈아 쓴다(2026-10-21 haru: 뿌 두 장 다 쓰자)
let pouts = 0;
const faceOf = f => f === 'pout' ? (pouts++ % 2 ? 'puff' : 'pout') : f;
function pickLine(key, vars = {}) {
  vars = {name: lineName || '손님', ...vars};
  const tn = typeof seasonNow === 'function' ? seasonNow().time : null, when = tn && (['morning', 'day'].includes(tn) ? 'day' : 'eve'), dusk = ['sunset', 'bluehour'].includes(tn);   // 시간대 표시가 붙은 줄은 그 시간대에만(2026-10-25: 아침에 '노을 예뻐요'가 나오지 않게)
  const ok = (LINES[key] || []).filter(l => [...l.t.matchAll(/\{(\w+)\}/g)].every(m => vars[m[1]] != null && vars[m[1]] !== ''));
  const all = ok.filter(l => !l.w || !tn || (l.w === 'dusk' ? dusk : l.w === when));
  if (!all.length) { lastFace = 'smile'; return ''; }
  const fresh = all.filter(l => !used.has(key + l.t));
  const pool = fresh.length ? fresh : all, l = pool[Math.floor(Math.random() * pool.length)];
  used.add(key + l.t);
  lastFace = faceOf(l.f);
  return l.t.replace(/\{(\w+)\}/g, (_, k) => vars[k]).trim();
}
