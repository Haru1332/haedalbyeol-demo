// 풀이 사례(2026-10-24 haru): 세 자매가 서로 몰래 봐 준 실제 AI 풀이. 설정은 docs/풀이 사례 - 세 자매 설정 (초안).md
// face: 동그란 프로필 256px(혜화·유화는 가게 안내 그림 vn-smile, 월화는 살롱 그림에서 얼굴만 자름. 눈 뜬 얼굴로 — 2026-10-24 haru), scene: 카드 뒤 흐린 배경
// 메인(main.js)과 메인 안 예시 화면(sample-view.js)이 같이 쓴다. ready: 가게가 결과를 보내 와서 sample/data/<id>.json이 있을 때만 true(그 전엔 메인에 안 보임)
const PEOPLE = {
  hyehwa: { name: '혜화', face: 'img/face-hyehwa.webp', scene: 'img/hyehwa-room.webp', role: '맏언니 · 혜화 사주', born: '1997년 8월 2일 낮 12시 30분', place: '전주',
    concern: '할머니한테 물려받은 일을 지금처럼 조용히 이어 갈지, 사람을 더 들이고 넓혀 볼지 고민이에요. 넓히면 지금 손님들한테 소홀해질까 봐 걱정돼요.' },
  wolhwa: { name: '월화', face: 'img/face-wolhwa.webp', scene: 'img/wolhwa-salon.webp', role: '둘째 · 월화 타로', born: '1998년 7월 5일 밤 0시 40분', place: '경주',
    concern: '남의 인연은 잘 보이는데 제 인연은 잘 모르겠어요. 운명 같은 사람은 언제쯤, 어떤 모습으로 만나게 될까요?' },
  yuhwa: { name: '유화', face: 'img/face-yuhwa.webp', scene: 'img/yuhwa-scope.webp', role: '막내 · 유화 별자리', born: '2002년 12월 5일 저녁 5시 50분', place: '서귀포',
    concern: '언니들 곁을 떠나서 더 넓은 데서 혼자 해 보고 싶어요. 지금 나가는 게 맞을까요, 조금 더 배우고 나가는 게 맞을까요?' },
};
const SAMPLE_SHOPS = {
  saju:  { sym: '해', name: '혜화 사주',   reader: '혜화', what: '사주',   story: '맏언니 혜화가 동생들이 걱정돼서 몰래 생일을 펼쳐 봤어요.', usesBirth: true },
  tarot: { sym: '달', name: '월화 타로',   reader: '월화', what: '카드',   story: '자기 카드는 절대 안 뽑는 월화가, 언니와 막내 카드는 몰래 뽑아 봤어요.', usesBirth: false },
  astro: { sym: '별', name: '유화 별자리', reader: '유화', what: '하늘',   story: '궁금한 걸 못 참는 막내 유화가 언니들 하늘을 몰래 그려 봤어요.', usesBirth: true },
};
// id = <가게>-<사람>. 순서 = 메인에 보이는 순서
const SAMPLES = [
  { id: 'tarot-hyehwa', shop: 'tarot', who: 'hyehwa', ready: true },
  { id: 'tarot-yuhwa',  shop: 'tarot', who: 'yuhwa',  ready: true },
  { id: 'saju-wolhwa',  shop: 'saju',  who: 'wolhwa', ready: false },
  { id: 'saju-yuhwa',   shop: 'saju',  who: 'yuhwa',  ready: false },
  { id: 'astro-hyehwa', shop: 'astro', who: 'hyehwa', ready: true },
  { id: 'astro-wolhwa', shop: 'astro', who: 'wolhwa', ready: true },
];
const sampleTitle = (s) => `${SAMPLE_SHOPS[s.shop].reader}가 몰래 본 ${PEOPLE[s.who].name}의 ${SAMPLE_SHOPS[s.shop].what}`;
