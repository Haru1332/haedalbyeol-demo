// 포트폴리오 체험판: 서버·AI 없이 가게가 돌게 하는 가짜 서버.
// 화면이 부르는 /api/* 요청을 가로채, 실제 AI로 한 판을 돌릴 때 녹화해 둔 응답(data/<사례>.replay.json)으로 답한다.
// 가게 index.html에서 다른 스크립트보다 먼저 읽는다. 사례는 주소 ?case=<id>, 없으면 window.DEMO_CASES의 첫 사례.
(function () {
  const realFetch = window.fetch.bind(window);
  const base = document.currentScript.src.replace(/[^/]*$/, '');      // 이 파일이 있는 곳 = 체험판 맨 위
  const q = new URLSearchParams(location.search);
  const saved = () => { try { return sessionStorage.getItem('demo-case'); } catch { return null; } };   // 결제 화면을 다녀와도 같은 손님으로
  // 이 가게의 사례만 쓴다: 같은 탭에서 다른 가게를 하고 왔으면 그 가게 손님이 남아 있어서(월화 → 메인 → 유화) 녹화가 안 맞아 멈췄다
  const mine = id => id && (!window.DEMO_CASES || window.DEMO_CASES.includes(id)) ? id : null;
  let caseId = mine(q.get('case')) || mine(saved()) || (window.DEMO_CASES || [])[0];
  const used = new Set();
  let calls = [], meta = {};
  const load = id => realFetch(`${base}data/${id}.replay.json`).then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { calls = j.calls || []; meta = j; used.clear(); }).catch(e => console.warn('[체험판] 결과 파일을 못 읽음', id, e));
  let ready = caseId ? load(caseId) : Promise.resolve();
  // 미리 뽑아 둔 카드(질문 순서대로): 파일 맨 위 picks → 설계도 요청에 실린 picks → 질문별 요청의 cards
  function picks() {
    if (Array.isArray(meta.picks)) return meta.picks;
    const plan = calls.find(c => /plan-stream/.test(c.path) && Array.isArray(c.req?.picks));
    if (plan) return plan.req.picks.slice().sort((a, b) => a.qIndex - b.qIndex).map(p => p.cards);
    return calls.filter(c => /answer-stream/.test(c.path) && Array.isArray(c.req?.cards) && c.req.mode !== 'concern')
      .sort((a, b) => a.req.qIndex - b.req.qIndex).map(c => c.req.cards);
  }
  // 가게의 '해·달·별로'·'또 올게요'가 돌아갈 곳 = 체험판 메인(가게 코드는 이 PC·폰 시험 주소만 받아서, 여기서 미리 넣어 둔다)
  if (window.DEMO_SHOP) try { sessionStorage.setItem('hdb-home', `${base}?from=${window.DEMO_SHOP}`); } catch {}
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // 녹화에서 이 요청에 맞는 응답 고르기: 보낸 내용이 똑같은 것 → 같은 질문(qIndex·mode) → 같은 주소의 안 쓴 것 → 같은 주소의 마지막 것
  function pick(method, path, req) {
    const pathname = path.split('?')[0];
    const all = calls.map((c, i) => ({ c, i })).filter(({ c }) => c.method === method && (c.path === path || c.path.split('?')[0] === pathname));
    const exactPath = all.filter(({ c }) => c.path === path);
    const pool = exactPath.length ? exactPath : all;
    const fresh = pool.filter(({ i }) => !used.has(i));
    const key = r => `${r?.qIndex ?? ''}|${r?.mode ?? ''}`;          // 같은 질문인지: 질문 번호와 고민 정리(mode)
    const keyed = req && typeof req === 'object' && ('qIndex' in req || 'mode' in req);
    // 유화 차트: 날짜만 보낸 요청(시간 없음)과 전부 보낸 요청을 가른다(결제 화면을 다녀오면 전부 보낸 것을 다시 부른다)
    if (/\/api\/chart$/.test(pathname) && req?.birth) {
      const full = !!req.birth.time || !!req.birth.place, c = pool.filter(({ c }) => (!!c.req?.birth?.time || !!c.req?.birth?.place) === full).pop();
      if (c) return c.c;
    }
    const hit = (req && fresh.find(({ c }) => same(c.req, req)))
      || (keyed && fresh.find(({ c }) => key(c.req) === key(req)))
      || (keyed && pool.find(({ c }) => key(c.req) === key(req)))
      || fresh[0] || pool[pool.length - 1];
    if (hit) used.add(hit.i);
    return hit?.c;
  }

  // 실시간 글: 녹화된 글 조각을 이어 붙인 뒤 일정한 속도로 다시 흘려보낸다(녹화 때의 끊김·대기와 무관하게 보기 좋은 속도)
  function ndjsonStream(body) {
    const rows = String(body || '').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const text = rows.filter(m => m.t === 'd').map(m => m.s).join('');
    const tail = rows.filter(m => m.t !== 'd');
    const enc = new TextEncoder(), step = 14, gap = 30;
    return new ReadableStream({
      async start(ctl) {
        await wait(1200);
        for (let i = 0; i < text.length; i += step) { ctl.enqueue(enc.encode(JSON.stringify({ t: 'd', s: text.slice(i, i + step) }) + '\n')); await wait(gap); }
        tail.forEach(m => ctl.enqueue(enc.encode(JSON.stringify(m) + '\n')));
        ctl.close();
      }
    });
  }
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

  async function answer(method, path, req) {
    if (/\/api\/trace$/.test(path)) return new Response(null, { status: 204 });
    await ready;
    const c = pick(method, path, req);
    if (/\/api\/status$/.test(path)) return json({ ...(c ? JSON.parse(c.body) : {}), ai: true, mock: false });
    if (!c) { console.warn('[체험판] 녹화에 없는 요청', method, path); return json({ error: '체험판에서는 쓸 수 없어요' }, 404); }
    if (c.type === 'ndjson') return new Response(ndjsonStream(c.body), { status: c.status, headers: { 'content-type': 'application/x-ndjson' } });
    await wait(c.type === 'json' && /report|chart/.test(path) ? 900 : 120);
    return new Response(c.body, { status: c.status, headers: { 'content-type': c.type === 'json' ? 'application/json' : 'text/plain' } });
  }

  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    let req = null;
    if (typeof init.body === 'string') { try { req = JSON.parse(init.body); } catch { req = init.body; } }
    const i = url.pathname.indexOf('/api/');
    if (url.origin === location.origin && i >= 0) return answer(method, url.pathname.slice(i) + url.search, req);
    return realFetch(input, init);
  };
  const beacon = navigator.sendBeacon?.bind(navigator);
  navigator.sendBeacon = (u, d) => (/\/api\//.test(String(u)) ? true : beacon ? beacon(u, d) : true);
  window.DEMO = {
    get caseId() { return caseId; }, get ready() { return ready; }, picks,
    setCase(id) { try { sessionStorage.setItem('demo-case', id); } catch {} if (id && id !== caseId) { caseId = id; ready = load(id); } return ready; }
  };
})();
