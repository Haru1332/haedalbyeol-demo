// 포트폴리오 체험판(월화 가게): 가게의 입력창·단추는 그대로 두고, 손님 프리셋(세 자매 중 한 명)을 고르면 칸이 채워진다.
// 카드는 자유롭게 뽑되 미리 뽑아 둔 카드가 나온다. 가게 코드는 고치지 않고 전역 함수를 감싼다. ai-reading.js 다음에 읽는다.
(function () {
  const GUESTS = {
    'tarot-hyehwa': { name: '혜화', gender: '여성', topic: 'work', sub: 'w_biz',
      concern: '할머니한테 물려받은 일을 지금처럼 조용히 이어 갈지, 사람을 더 들이고 넓혀 볼지 고민이에요. 넓히면 지금 손님들한테 소홀해질까 봐 걱정돼요.' },
    'tarot-yuhwa': { name: '유화', gender: '여성', topic: 'work', sub: 'w_move',
      concern: '언니들 곁을 떠나서 더 넓은 데서 혼자 해 보고 싶어요. 지금 나가는 게 맞을까요, 조금 더 배우고 나가는 게 맞을까요?' },
  };
  const { presetRow, nudge, fill, mark } = DEMO_UI;
  let guest = null;
  const tell = el => nudge(guest ? `체험판이라 ${guest.name}님 정보로 진행돼요` : '먼저 위에서 오늘의 손님을 골라 주세요', el);
  const pickGuest = id => { guest = GUESTS[id]; DEMO.setCase(id); };

  // 이름 칸: 가게 그대로 + 위에 손님 프리셋. 고르면 이름이 칸에 써진다. 손님을 고르기 전에는 단추가 안내만 한다
  const askName0 = window.askName;
  window.askName = () => {
    const p = askName0(), box = $('#choices'), t = $('#name-in'), send = $('#send'), skip = $('#skip');
    const go = send.onclick;
    box.querySelector('.ask').prepend(presetRow(Object.entries(GUESTS), id => { pickGuest(id); fill(t, guest.name, 60); }));
    send.onclick = () => (guest && t.value === guest.name ? go() : tell(send));
    skip.onclick = () => tell(skip);
    t.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); send.onclick(); } };
    t.readOnly = true; t.onclick = () => { if (!guest) tell(t); };
    return p;
  };

  // 고르는 단추: 가게 화면 그대로 모두 보이되, 손님 것에 테두리, 다른 단추는 안내만(성별·세부 주제)
  const sub = options => guest && options.some(x => x.value === guest.sub);
  const choose0 = window.choose;
  window.choose = (options, o) => {
    const p = choose0(options, o);
    const gender = guest && options.some(x => x.value === '남성') && options.some(x => x.value === '여성');
    if (gender || sub(options)) {
      const want = gender ? guest.gender : guest.sub, bs = [...$('#choices').querySelectorAll('button')];
      options.forEach((x, i) => { if (!bs[i]) return; if (x.value === want) mark(bs[i]); else bs[i].onclick = () => tell(bs[i]); });
    }
    return p;
  };
  // 큰 주제 카드: 가게 화면 그대로, 손님 주제에 테두리, 다른 주제는 안내만
  const chooseTopic0 = window.chooseTopic;
  window.chooseTopic = () => {
    const p = chooseTopic0();
    if (guest) [...$('#choices').querySelectorAll('button.topic')].forEach((b, i) => {
      if (TOPICS[i]?.id === guest.topic) mark(b); else b.onclick = () => tell(b);
    });
    return p;
  };

  // 고민 칸: 가게 그대로, 손님의 고민이 써진다. '그냥 볼게요'는 안내만
  const askText0 = window.askText;
  window.askText = opts => {
    const p = askText0(opts), t = $('#concern');
    if (guest && t) {
      const done = fill(t, guest.concern, 18), go = $('#send').onclick;
      $('#send').onclick = () => done.then(go);   // 다 써진 뒤에 넘긴다
      $('#skip').onclick = () => tell($('#skip'));
    }
    return p;
  };

  // 카드는 어느 것을 눌러도 미리 뽑아 둔 카드(질문 순서대로)
  let nth = 0;
  const aiStory0 = window.aiStory;
  window.aiStory = (...a) => { nth = 0; return aiStory0(...a); };
  // 기다리는 동안 보는 '오늘의 운세' 한 장은 고정하지 않는다(가게 그대로, 이번 리딩에 나온 카드는 빼고 무작위)
  let daily = false;
  const daily0 = window.dailyRitual;
  window.dailyRitual = async (...a) => { daily = true; try { return await daily0(...a); } finally { daily = false; } };
  const pick0 = window.pickFromFan;
  window.pickFromFan = async (state, n) => {
    if (daily) return pick0(state, n);
    const got = await pick0(state, n), fixed = DEMO.picks()[nth++];
    return fixed?.length === got.length ? fixed.map(c => ({ name: c.name, rev: !!c.rev })) : got;
  };
})();
