// 포트폴리오 체험판(유화 가게): 가게의 입력창·단추는 그대로 두고, 손님 프리셋(세 자매 중 한 명)을 고르면 이름이 써지고
// 뒤의 생일·시간·태어난 곳·고민 칸에도 그 손님 정보가 채워진다. 손님 정보와 다른 단추는 안내만 한다.
// 가게 코드는 고치지 않고 전역 함수(form·ask)를 감싼다. app.js 다음에 읽는다.
(function () {
  const GUESTS = {
    'astro-hyehwa': { name: '혜화', gender: '여성', y: 1997, m: 8, d: 2, ap: 'pm', h: 12, mi: 30, sido: '전북특별자치도', sgg: '전주시완산구',
      concern: '할머니한테 물려받은 일을 지금처럼 조용히 이어 갈지, 사람을 더 들이고 넓혀 볼지 고민이에요. 넓히면 지금 손님들한테 소홀해질까 봐 걱정돼요.' },
    'astro-wolhwa': { name: '월화', gender: '여성', y: 1998, m: 7, d: 5, ap: 'am', h: 12, mi: 40, sido: '경상북도', sgg: '경주시',
      concern: '남의 인연은 잘 보이는데 제 인연은 잘 모르겠어요. 운명 같은 사람은 언제쯤, 어떤 모습으로 만나게 될까요?' },
  };
  const { presetRow, nudge, fill, mark } = DEMO_UI;
  let guest = null;
  const tell = el => nudge(guest ? `체험판이라 ${guest.name}님 정보로 진행돼요` : '먼저 위에서 오늘의 손님을 골라 주세요', el);
  const row = () => [...$('#choices').querySelectorAll('button')];

  // 고르는 단추: 모두 보이되, 손님 정보와 맞는 단추에 테두리, 다른 단추는 안내만
  const RIGHT = [
    o => o.value === '남성' || o.value === '여성' ? o.value === guest.gender : null,   // 성별
    o => ['solar', 'lunar', 'leap'].includes(o.value) ? o.value === 'solar' : null,      // 양력
    o => o.value === 'kr' || o.value === 'world' || (o.value === null && /몰라/.test(o.label)) ? o.value === 'kr' : null,   // 한국
    o => o.label === '맞아요' || o.label === '다시 할게요' ? o.label === '맞아요' : null,   // 입력 확인(값 true/false인 다른 단추 '볼래요' 등은 건드리지 않게 이름으로)
  ];
  const ask0 = window.ask;
  window.ask = (text, options, cols, who) => {
    const p = ask0(text, options, cols, who);
    if (guest) {
      const judge = RIGHT.find(f => options.some(o => f(o) !== null));
      if (judge) { const bs = row(); options.forEach((o, i) => { if (judge(o)) mark(bs[i]); else if (bs[i]) bs[i].onclick = () => tell(bs[i]); }); }
    }
    return p;
  };

  const form0 = window.form;
  window.form = (text, html, buttons, read, setup) => {
    // 이름 칸: 가게 그대로 + 위에 손님 프리셋. 고르면 이름이 칸에 써진다
    if (/id="f-name"/.test(html)) {
      let typed = Promise.resolve();
      const p = form0(text, html, buttons, read, box => {
        setup?.(box);
        const t = box.querySelector('#f-name'); t.readOnly = true; t.onclick = () => { if (!guest) tell(t); };
        box.prepend(presetRow(Object.entries(GUESTS), id => { guest = GUESTS[id]; DEMO.setCase(id); typed = fill(t, guest.name, 60); }));
      });
      guardButtons(buttons, b => !b.skip, () => typed);
      return p;
    }
    if (!guest) return form0(text, html, buttons, read, setup);
    const g = guest; let filled = Promise.resolve();
    const p = form0(text, html, buttons, read, box => {
      setup?.(box);
      const q = s => box.querySelector(s);
      if (q('#f-y')) filled = Promise.all([fill(q('#f-y'), g.y), fill(q('#f-m'), g.m), fill(q('#f-d'), g.d)]);
      if (q('#f-ap')) filled = Promise.all([fill(q('#f-ap'), g.ap), fill(q('#f-h'), g.h), fill(q('#f-mi'), g.mi)]);
      if (q('#f-sido')) {   // 시·도를 고르면 가게 코드가 시·군·구 목록을 새로 받는다 → 받은 뒤 고른다
        const s1 = q('#f-sido'), s2 = q('#f-sgg'); s1.value = g.sido;
        filled = Promise.resolve(s1.onchange?.()).then(() => { s1.disabled = true; return fill(s2, g.sgg); });
      }
      if (q('#f-c')) filled = fill(q('#f-c'), g.concern, 18);
    });
    guardButtons(buttons, b => !b.skip, () => filled);
    return p;
  };
  // form 단추: 완료(go)는 칸이 다 채워진 뒤에, 건너뛰기(몰라요·없어요·처음부터·이름 없이)는 안내만
  function guardButtons(buttons, isGo, ready) {
    row().forEach(b => {
      const o = buttons.find(x => x.label === b.textContent); if (!o) return;
      const go = b.onclick;
      b.onclick = () => (isGo(o) && guest ? ready().then(go) : tell(b));
    });
  }
})();

