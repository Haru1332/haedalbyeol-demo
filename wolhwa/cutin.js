// 카드 반응 컷: 큰 순간은 한 리딩에 세 번까지만
let cutInCount = 0;
function resetCutIns() { cutInCount = 0; }
function isBigCard(cards) {
  if (window.WOLHWA_MOCK && /[?&]cutin=1/.test(location.search)) return true;   // 점검: 가짜 모드에서 ?cutin=1이면 카드마다 컷인
  return cards.some(c => !c.rev && ['탑', '죽음', '태양', '세계', '운명의 수레바퀴', '악마', '연인'].includes(c.name));
}

// 반응 전용 상반신 그림(react-<감정>-1..4.webp, 없는 번호는 건너뜀, 2026-10-18 Codex). 표정 이름 → 반응 감정 후보. 그림이 없으면 대화용 표정 그림을 잘라 쓴다
const REACT_OF = { smile: ['delight'], amused: ['delight', 'smug'], surprised: ['surprised', 'awe'], worried: ['worried', 'flustered'], think: ['think'],
  curious: ['think', 'surprised'], tease: ['tease', 'smug'], warm: ['awe', 'delight'], normal: ['smug', 'think'] };
const REACT_SRCS = {};
Object.values(REACT_OF).flat().filter((x, i, a) => a.indexOf(x) === i).forEach(r => { for (let k = 1; k <= 4; k++) if (hasAsset(`react-${r}-${k}.webp`)) (REACT_SRCS[r] ||= []).push(`assets/react-${r}-${k}.webp`); });
function reactArt(face) {
  const pool = (REACT_OF[face] || []).flatMap(r => REACT_SRCS[r] || []);
  return pool.length ? { src: pool[Math.floor(Math.random() * pool.length)], close: true } : { src: facesOf(face)[0], close: false };
}
// 폰이 글자를 몇 배로 키우는지(갤럭시 등은 글자만 키움): 100px 글자를 하나 놓고 실제 크기를 잰다. 한 번만 재서 기억
let TEXT_K = 0;
const textScale = () => new Promise(res => {
  if (TEXT_K) return res(TEXT_K);
  const p = document.createElement('span'); p.style.cssText = 'position:absolute;left:-999px;top:0;visibility:hidden;font-size:100px;line-height:1'; p.textContent = '가'; document.body.append(p);
  requestAnimationFrame(() => { TEXT_K = parseFloat(getComputedStyle(p).fontSize) / 100 || 1; p.remove(); res(TEXT_K); });
});
// 만화 기호: 놀람 !, 고민 ?, 걱정 …, 좋음 ✦, 장난 ♪, 다정 ♡, 당황 땀방울
const MARK_OF = { surprised: 'bang', curious: 'ask', think: 'ask', worried: 'dots', smile: 'spark', amused: 'spark', tease: 'note', warm: 'heart' };
function markEl(face) {
  const kind = MARK_OF[face]; if (!kind) return null;
  const m = document.createElement('div'); m.className = `cut-mark cut-${kind}`;
  m.innerHTML = { bang: '<b>!</b>', ask: '<b>?</b>', dots: '<i></i><i></i><i></i>', spark: '<b>✦</b><b>✦</b><b>✦</b>', note: '<b>♪</b>', heart: '<b>♡</b>' }[kind];
  return m;
}

function mountReaction(face, big, side) {
  const root = document.createElement('div');
  root.className = big ? 'card-cutin' : `card-reaction from-${side}`;
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--cut-side', side === 'right' ? 1 : -1);
  const art = document.createElement('div'), a = reactArt(face);
  art.className = 'card-reaction-art' + (a.close ? ' close' : '');
  art.style.backgroundImage = `url("${a.src}")`;
  if (!big) { const ink = document.createElement('div'); ink.className = 'cut-ink'; ink.append(art); root.append(Object.assign(document.createElement('div'), { className: 'cut-lines' }), ink); }
  else root.append(art);
  const mark = markEl(face); if (mark) root.append(mark);
  document.getElementById('frame').append(root);
  // 폰 글자 크기를 키우면(갤럭시 등) 만화 기호도 같이 커져 덩어리처럼 보인다 → 기호만 원래 크기로(CSS의 58px·컷인 52px 기준, 2026-10-20)
  if (mark) textScale().then(k => { if (k > 1.05) mark.style.scale = (1 / k).toFixed(3); });
  let closing;
  // 닫기가 끝난 뒤 카드가 쟁반으로 이동한다
  return () => {
    if (closing) return closing;
    closing = new Promise(resolve => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { root.remove(); resolve(); return; }
      root.classList.add('cut-out');
      setTimeout(() => { root.remove(); resolve(); }, big ? 180 : 160);
    });
    return closing;
  };
}
// 보통 반응: 화면 왼쪽·오른쪽 끝에서 밀려 들어오거나, 대화창 뒤에서 솟아오른다(무작위, 바로 앞과 같은 방향은 피함)
let lastSide = '';
function reactCut(face) {
  const sides = ['left', 'right', 'up-left', 'up-right'].filter(x => x !== lastSide);
  return mountReaction(face, false, lastSide = sides[Math.floor(Math.random() * sides.length)]);
}
function cutIn(face, side = cutInCount % 2 ? 'right' : 'left') {
  if (cutInCount >= 3) return reactCut(face);
  cutInCount++;
  return mountReaction(face, true, side);
}
