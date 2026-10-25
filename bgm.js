// 메인 배경음악(index.html). 풀이 예시는 메인 안 화면(sample-view.js)이라 음악이 끊기지 않는다. 소리 단추는 #sound-btn.
// 곡 두 개(2026-10-25 haru): 처음엔 둘 중 하나를 무작위로, 그 뒤로는 번갈아(2가 먼저면 2·1·2·1…, 1이 먼저면 1·2·1·2…).
// 페이지를 다시 읽어도 이어서(가게에서 뒤로 돌아올 때 등, 2026-10-25): 떠날 때 곡·자리·음소거를 이 탭 sessionStorage에 두고,
// 다음 페이지가 그 곡의 그 자리부터 튼다. 브라우저가 터치 전 소리를 막으면(아이폰 등) 첫 터치 때 그 자리부터.
// 곡은 .mp3가 아니라 sound/main1.js·main2.js(base64)로 받는다: IDM 같은 다운로드 관리자가 .mp3 요청을 가로채 다운로드 창을 띄워서(2026-10-25 haru, 월화·유화와 같은 해결). 담기: node tools/embed-bgm.mjs
// 세 가게와 같은 규칙: 크기 35%, 음소거는 기억하지 않는다(새로 연 탭은 소리 켬 — sessionStorage라 탭을 닫으면 사라짐).
// 입구 장막(curtain.js, 2026-10-25 haru 「진입하자마자 클릭하는 뭔가」「매번」)이 있으면 음악은 장막을 걷을 때(HdbBgm.resume)만 시작한다.
// 장막 뒤에서 먼저 울리지 않게. 걷으면 듣던 자리부터. 가게에서 돌아와 장막이 없으면(curtain.js) 예전처럼 처음 누를 때 시작.
// 곡은 둘 다 -15.2 LUFS·트루 피크 -1.7/-2.0dB로 맞춤(공통 기준 -14는 피크 -1.5를 넘어서 두 곡 같은 크기로 낮춤). 원본: haru 다운로드 폴더 메인1·메인2.mp3
(() => {
  const BASE = new URL('.', document.currentScript.src).href;     // site/ 주소(예시 페이지에서도 같은 곡 경로)
  const NAMES = ['main1', 'main2'], VOL = 0.35, KEY = 'hdb-bgm';
  // 곡 스크립트를 불러 Blob 주소로(한 번 만든 주소는 이 페이지에서 다시 씀)
  const urls = {};
  const track = (i) => urls[i] || (urls[i] = new Promise((ok) => {
    const done = () => {
      const b = (window.BGM_DATA || {})[NAMES[i]]; if (!b) { delete urls[i]; return ok(null); }
      const bin = atob(b), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      delete window.BGM_DATA[NAMES[i]];
      ok(URL.createObjectURL(new Blob([u8], { type: 'audio/mpeg' })));
    };
    if (window.BGM_DATA?.[NAMES[i]]) return done();
    const sc = document.createElement('script'); sc.src = `${BASE}sound/${NAMES[i]}.js`; sc.onload = done; sc.onerror = () => { delete urls[i]; ok(null); };
    document.head.append(sc);
  }));
  const SRCS = NAMES;   // 곡 수
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const saved = load();
  let el = null, started = false, muted = !!saved?.muted;
  let cur = Number.isInteger(saved?.cur) ? saved.cur % SRCS.length : Math.floor(Math.random() * SRCS.length);
  let resumeAt = saved?.t > 0 ? saved.t : 0;
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ cur, t: el ? el.currentTime : resumeAt, muted, at: Date.now() })); } catch {} };

  const fade = (to, ms) => {
    const id = el._fade = (el._fade || 0) + 1, from = el.volume, t0 = performance.now();
    const step = (t) => { if (el._fade !== id) return; const k = Math.max(0, Math.min(1, (t - t0) / ms)); el.volume = from + (to - from) * k; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  async function start() {
    if (started) return; started = true;
    const src = await track(cur);
    if (!src) { started = false; return; }   // 곡 파일이 없음
    const a = el = new Audio(src); a.volume = muted ? 0 : VOL; a.preload = 'auto';   // 체험판: 서서히 키우지 않고 바로 시작(2026-10-25 haru)
    if (resumeAt) a.addEventListener('loadedmetadata', () => { if (resumeAt < a.duration - 1) a.currentTime = resumeAt; }, { once: true });   // el은 막히면 null이 되므로 a로
    el.addEventListener('ended', async () => { cur = (cur + 1) % SRCS.length; const u = await track(cur); if (u) { el.src = u; el.play().catch(() => {}); } });   // 다음 곡으로(음량은 그대로)
    // 이어 듣기는 짧게, 처음 듣기는 천천히 키운다
    el.play().then(() => { track((cur + 1) % SRCS.length); }, () => { started = false; el = null; });   // 다음 곡은 미리 받아 둔다. 막히면 다음 터치에 다시
  }
  const gate = document.documentElement.classList.contains('curtained');   // 이번에 장막이 덮였나
  let open = !gate;      // 장막이 걷혔나(장막이 없는 페이지는 늘 열림)
  // 터치마다 다시 시도: 장막을 걷을 때 막혔으면(아이폰은 곡을 받는 사이 '누른 순간'이 지나 막을 수 있음) 다음 터치에 튼다
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, () => { if (open) resume(); }, { capture: true, passive: true }));
  if (!gate && saved) start();     // 장막 없는 페이지에서 앞 페이지에 듣던 중: 터치 없이도 되는 브라우저(PC 크롬 등)는 바로 이어서
  if (gate) track(cur);            // 장막이 덮인 동안 곡을 미리 받아 둔다(누른 순간 바로 틀 수 있게)
  // 장막을 걷을 때: 아직 안 틀었으면 시작, 뒤로 가기로 돌아와 멈춰 있으면 다시(막혔다 풀린 아이폰도 여기서)
  function resume() {
    open = true;
    if (!el) return start();
    if (muted || !el.paused) return;
    el.volume = VOL;   // 체험판: 바로 시작
    el.play().catch(() => {});
  }
  // 가게로 떠날 때(main.js): 음악을 천천히 줄인다. 뒤로 가기로 돌아오면 pageshow가 크기를 되돌린다
  const fadeOut = (ms) => { if (el && !el.paused) fade(0, ms); };
  window.HdbBgm = { resume, fadeOut };

  // 떠날 때 자리를 적고 멈춘다. 뒤로 가기로 돌아오면(페이지 보관) 그사이 다른 페이지에서 들은 자리로 맞춘다
  addEventListener('pagehide', () => { save(); el?.pause(); });
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    if (!el) return;
    const s = load();
    if (s && Number.isInteger(s.cur)) {
      muted = !!s.muted; paint();
      const at = s.t || 0;
      el.volume = muted ? 0 : VOL;
      if (s.cur !== cur) {
        cur = s.cur % SRCS.length;
        track(cur).then((u) => { if (!u) return; el.src = u; el.addEventListener('loadedmetadata', () => { el.currentTime = at; }, { once: true }); if (!muted && open) el.play().catch(() => {}); });
        return;
      }
      try { el.currentTime = at; } catch {}
    }
    if (!muted && open) el.play().catch(() => {});
  });

  const btn = document.getElementById('sound-btn');
  function paint() {
    if (!btn) return;
    btn.classList.toggle('off', muted);
    btn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    btn.setAttribute('aria-pressed', String(muted));
  }
  btn?.addEventListener('click', () => {
    muted = !muted; paint(); save();
    if (!el) { if (!muted && open) resume(); return; }
    if (!muted && el.paused && open) el.play().catch(() => {});   // 음소거로 돌아온 페이지는 멈춰 있다 → 켜면 다시 튼다
    fade(muted ? 0 : VOL, 400);
  });
  paint();
})();
