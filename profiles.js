// 세 자매 프로필(2026-10-25 haru 「혜화에 대하여 … 특징 성격 별자리 … 캐릭터 프로필」). 메인 안 화면 ?about=<사람>(sample-view.js가 연다).
// 사실은 각 가게 캐릭터 기획서가 원본이다. 가게 쪽이 바뀌면 여기를 따라 고친다(담비 → 솔라, 고양이 → 하늘다람쥐처럼 바뀐 적 있음).
//   혜화: ~/dev/hyehwa-saju/docs/캐릭터/혜화 캐릭터 기획.md 1·2·3·4·4-1절(4-1 '프로필'은 2026-10-21 haru 고름)
//   월화: ~/dev/wolhwa-tarot/docs/캐릭터/월화 캐릭터 기획.md 1·2·3·4·5절
//   유화: ~/dev/yuhwa-astro/docs/캐릭터/유화 캐릭터 기획.md 1·2·3·4·8·10절(3절 배경은 그쪽에서도 '초안')
//   생일·태어난 곳·자란 곳·별자리·사주 일간: docs/풀이 사례 - 세 자매 설정 (초안).md 2절(2026-10-24 확정)
// 빈 칸(좋아하는 것·싫어하는 것·요즘 고민·자매가 보는 모습)은 화면에 안 나온다. 프로필 초안: 월화·유화 칸은 가게 세션이 채워 주면 넣는다(점검표 S13).
// 별자리·일간은 사실 칸으로만 보인다(「사자자리라서 이런 성격」 같은 말은 쓰지 않음 — 운세를 사실처럼 말하지 않는다).
const GREW_UP = '부모님 일로 이사가 잦아서 세 자매는 태어난 곳이 다 달라요. 그래도 자란 곳은 하나, 전주 한옥마을의 할머니 집이에요. 할머니가 떠난 뒤 그 집이 있던 골목에 셋이 각자 가게를 열었어요.';
const PROFILES = {
  hyehwa: {
    shop: 'saju', order: '맏언니',
    concept: '솔라, 붓, 만세력, 감나무, 그리고 손님까지. 방 안 모두와 사이좋은 한낮의 사주 선생.',
    facts: [
      ['자매 중', '맏언니 · 월화보다 한 살 위'],
      ['생일', '1997년 8월 2일 낮 12시 30분'],
      ['태어난 곳', '전주 한옥마을, 할머니 집'],
      ['별자리', '사자자리'],
      ['사주 일간', '병화(丙火) · 한낮의 해'],
      ['가게', '햇살 드는 한옥 방, 창밖엔 감나무'],
      ['곁에', '솔라 · 노란목도리담비'],
      ['즐겨 마시는 것', '차'],
      ['상징', '해 머리 장식 · 상아·황토·살구빛'],
    ],
    character: '착하고 배려심이 많은데, 본인은 모르는 엉뚱함이 있어요. 진심으로 한 말인데 듣는 사람만 웃게 되는 쪽이에요. 그래도 사주와 날짜 일에는 누구보다 정확하고 성실해요.',
    story: [GREW_UP, '동생 월화가 카드로 사람 속을 읽을 때, 혜화는 사람이 지나갈 계절이 궁금해서 할머니한테 물려받은 만세력을 팠어요. 달력과 절기에 꼼꼼하지만 자랑하지는 않아요.'],
    likes: ['홍시를 숟가락으로 떠먹기', '절기 이름(곡우·상강·소설…)을 소리 내 말해 보기. 이름이 예쁘대요', '솔라 낮잠 자리를 볕 따라 옮겨 주기'],
    dislikes: ['만세력 책 모서리 접기. 할머니 책이라서요', '바람 센 날. 감나무가 감을 놓칠까 봐요', '비 오는 날 솔라가 젖은 털로 들어오는 것. 감기 걸릴까 봐요'],
    worries: ['솔라가 문지기 당번을 자꾸 빼먹어요(바빴던 거라고 믿어요)', '월화가 자기 말을 가끔 못 알아들어요(월화가 피곤한 줄 알아요)', '까치 몫으로 남긴 감을 까치가 안 가져가요(아껴 먹는 거라고 생각해요)'],
    pet: { name: '솔라', text: '같이 일하는 동료이자, 이 방에 먼저 있던 선배이자, 아끼는 동생 같은 식구예요. 당번을 정해 주고 의견도 진지하게 물어봐요.' },
    seenBy: { who: '월화', line: '언니는 가끔 다른 데 가 있는 것 같아.', reply: '저는 늘 여기 있는데요.' },
  },
  wolhwa: {
    shop: 'tarot', order: '둘째',
    concept: '남의 앞날은 다 보면서, 정작 자기 카드는 절대 안 뽑는 밤의 타로마스터.',
    facts: [
      ['자매 중', '둘째'],
      ['생일', '1998년 7월 5일 밤 0시 40분'],
      ['태어난 곳', '경주 · 밤이면 연못에 달이 비치는 월지(月池)의 도시'],
      ['별자리', '게자리'],
      ['사주 일간', '계수(癸水) · 밤이슬'],
      ['가게', '밤에만 문을 여는 작은 타로 살롱'],
      ['곁에', '루나 · 여우'],
      ['즐겨 마시는 것', '차'],
      ['상징', '초승달 머리핀 · 와인빛 숄과 검정'],
    ],
    character: '여유 있고 다정한데, 여우처럼 살짝 능청스럽고 애교가 있어요. 어릴 때부터 말투에서 속마음을 잘 알아채서, 정작 자기 이야기는 잘 안 꺼내요. 그래도 카드를 펼치면 장난을 멈추고 카드 이야기만 해요.',
    story: [GREW_UP, '밤에만 문을 여는 데는 이유가 있대요. 왜냐고 물으면 다음에 오면 알려 준다고만 해요.'],
    pet: { name: '루나', text: '말은 못 하지만 월화가 자꾸 말을 걸어요. 티격태격하면서도 루나 앞에서는 꼼짝 못 하는 집사예요.' },
    quote: '남의 건 이렇게 잘 보이는데, 제 건 안 봐요. 다 알면 재미없잖아요.',
  },
  yuhwa: {
    shop: 'astro', order: '막내',
    concept: '고양이처럼 제멋대로 뛰어다니다가, 첫 별이 뜨면 누구보다 먼저 조용해지는 막내 점성가.',
    facts: [
      ['자매 중', '막내'],
      ['생일', '2002년 12월 5일 저녁 5시 50분'],
      ['태어난 곳', '제주 서귀포 · 남쪽 하늘의 노인성이 보인다는 곳'],
      ['별자리', '사수자리'],
      ['사주 일간', '정화(丁火) · 별빛과 촛불'],
      ['가게', '해 질 녘부터 첫 별이 뜰 때까지 여는 별 탑 꼭대기 방'],
      ['곁에', '스텔라 · 하늘다람쥐'],
      ['즐겨 마시는 것', '코코아(언니들은 차)'],
      ['상징', '별 머리 장식 · 황혼 코발트 블루와 별빛 레몬'],
      ['웃을 때', '작은 덧니가 보여요'],
    ],
    character: '궁금한 건 못 참고 몸이 먼저 나가는 말괄량이예요. 좋은 걸 보면 손님보다 먼저 들뜨고, 그러다 허둥대며 스스로 들켜요. 그런데 첫 별이 뜨면 장난을 멈추고 누구보다 진지해져요.',
    // 프로필 초안: 둘째 문단은 유화 기획서 3절 '배경 (초안)' — 가게에서 확정되면 다시 맞춘다(출시 전 임시 값 점검표 S13)
    story: [GREW_UP, '어릴 때부터 높은 곳에 올라가 하늘 보는 걸 좋아했어요. 언니들이 카드와 만세력을 볼 때 막내는 지붕에 올라가 있었고, 별 지도는 혼자 그리며 익혔어요. 언니들에게는 아직 막내 취급을 받지만, 별 앞에서만큼은 언니들도 인정해요.'],
    pet: { name: '스텔라', text: '은회색 털에 크고 까만 눈, 책장과 창 사이를 날아다녀요. 유화보다 어른스러워서 자리 다툼은 늘 유화가 져요.' },
  },
};
// 세 자매 나란히(세 기획서에서 서로 겹치지 않는 칸만)
const SISTERS_TABLE = [
  ['시간', { hyehwa: '낮 · 햇살', wolhwa: '밤 · 촛불', yuhwa: '해 질 녘 ~ 첫 별' }],
  ['보는 것', { hyehwa: '사주', wolhwa: '타로', yuhwa: '별자리' }],
  ['곁의 동물', { hyehwa: '담비 솔라', wolhwa: '여우 루나', yuhwa: '하늘다람쥐 스텔라' }],
  ['머리 장식', { hyehwa: '해', wolhwa: '초승달', yuhwa: '별' }],
  ['마실 것', { hyehwa: '차', wolhwa: '차', yuhwa: '코코아' }],
];

// 화면 그리기(#about-view). 없는 사람이면 false
function renderProfile(key) {
  const P = PROFILES[key], who = PEOPLE[key], shop = SAMPLE_SHOPS[P?.shop];
  if (!P || !who || !shop) return false;
  const $ = (x) => document.getElementById(x);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const list = (title, xs) => xs?.length ? `<div class="a-box"><h3>${title}</h3><ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  document.title = `${who.name}에 대하여 · 해·달·별`;
  $('a-tabs').innerHTML = Object.keys(PROFILES).map((k) => `<a href="?about=${k}" data-about="${k}"${k === key ? ' aria-current="page"' : ''}><img src="${PEOPLE[k].face}" alt="">${PEOPLE[k].name}</a>`).join('');
  $('a-shop').textContent = `${shop.sym}의 가게 · ${shop.name}`;
  $('a-name').textContent = who.name;
  $('a-order').textContent = P.order;
  $('a-concept').textContent = P.concept;
  $('a-scene').src = who.scene; $('a-scene').alt = `${shop.name} 안내 그림`;
  $('a-facts').innerHTML = P.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('a-character').textContent = P.character;
  $('a-story').innerHTML = P.story.map((s) => `<p>${esc(s)}</p>`).join('');
  const boxes = list('좋아하는 것', P.likes) + list('싫어하는 것', P.dislikes) + list('요즘 고민', P.worries);
  $('a-boxes').innerHTML = boxes; $('a-boxes').hidden = !boxes;
  $('a-pet').innerHTML = P.pet ? `<h3>${esc(P.pet.name)}</h3><p>${esc(P.pet.text)}</p>` : ''; $('a-pet').hidden = !P.pet;
  $('a-quote').innerHTML = P.seenBy
    ? `<p class="said"><span>${esc(P.seenBy.who)}</span>“${esc(P.seenBy.line)}”</p><p class="said me"><span>${esc(who.name)}</span>“${esc(P.seenBy.reply)}”</p>`
    : P.quote ? `<p class="said me"><span>${esc(who.name)}</span>“${esc(P.quote)}”</p>` : '';
  $('a-quote').hidden = !P.seenBy && !P.quote;
  const keys = Object.keys(PROFILES);
  $('a-table').innerHTML = `<thead><tr><th></th>${keys.map((k) => `<th${k === key ? ' class="me"' : ''}>${PEOPLE[k].name}</th>`).join('')}</tr></thead><tbody>${SISTERS_TABLE.map(([label, v]) => `<tr><th>${label}</th>${keys.map((k) => `<td${k === key ? ' class="me"' : ''}>${esc(v[k])}</td>`).join('')}</tr>`).join('')}</tbody>`;
  // 이 사람이 받은 풀이 예시(다른 자매가 몰래 본 것)
  const got = SAMPLES.filter((s) => s.ready && s.who === key);
  $('a-samples').innerHTML = got.map((s) => `<a href="?sample=${s.id}" data-sample="${s.id}">${esc(sampleTitle(s))} →</a>`).join('');
  $('a-samples-sec').hidden = !got.length;
  $('a-go').dataset.goshop = P.shop;
  $('a-go-ic').textContent = { saju: '☀', tarot: '☾', astro: '✦' }[P.shop];
  $('a-go-label').textContent = `${shop.name}로 가기`;
  return true;
}
