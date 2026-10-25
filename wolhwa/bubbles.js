// 장면별 말풍선 자리. bubble-editor.html에서 사람이 직접 잡고, bubble-positions.json에 저장한다.
// 값은 모두 그림(3:2 칸) 기준 %: x·y = 말풍선 왼쪽 위, w = 폭, tx·ty = 꼬리가 가리킬 곳(말하는 사람 입 근처), tail = 꼬리 있음
// w는 최대 폭: 말풍선은 글 길이만큼만 커진다(자리가 오른쪽이면 오른쪽 끝 기준). y가 100보다 크면 칸 아래로 매달린다. 글자 크기는 칸 폭에 비례(cqw)해서 편집기와 앱에서 똑같이 보인다.
let BUB_POS = {};
const bubReady = fetch('bubble-positions.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(j => { BUB_POS = j || {}; }).catch(() => {});

function bubHTML(text, p) {
  return `<p class="pbub${p.x + p.w / 2 > 50 ? ' ar' : ''}" style="--x:${p.x};--y:${p.y};--w:${p.w}" data-tail="${p.tail ? 1 : 0}" data-tx="${p.tx}" data-ty="${p.ty}">${text}</p>`;
}

// 꼬리: 말풍선 테두리에서 목표점 쪽으로 짧은 쐐기를 그린다(SVG). 말풍선이 칸 아래로 나가면 그만큼 여백도 준다
// 글 길이에 맞춰 말풍선을 줄인다: 최대 폭에서의 줄 수를 유지하는 가장 좁은 폭을 찾는다(CSS만으로는 두 줄이 되면 최대 폭에 머문다)
function fitBubble(b) {
  const grow = Math.min(window.TEXT_K || 1, 1.5);   // 폰 글자 크기를 키운 만큼 말풍선도 넓게(읽는 화면 최대치 1.5배까지, 2026-10-20). 보통 폰은 1
  const key = b.textContent + '|' + b.parentNode.offsetWidth + '|' + b.style.getPropertyValue('--w') + '|' + grow + '|' + (document.fonts?.check('16px "Myoeunttobak"') ? 'f' : '-');
  if (b.dataset.fit === key && b.style.width) return;
  const cap = Math.min(b.parentNode.clientWidth * parseFloat(b.style.getPropertyValue('--w')) / 100 * grow, b.parentNode.clientWidth * 0.92);      // 저장한 최대 폭(px), 큰 글자면 넓힘
  b.style.maxWidth = 'none'; b.style.width = 'max-content';
  const one = parseFloat(getComputedStyle(b).width);                                             // 한 줄로 쓸 때 폭(소수점까지)
  b.dataset.fit = key;
  // 짧은 말은 한 줄로: 최대 폭에 들어가거나, 30% 안쪽으로만 넘치면(칸 폭의 92%까지) 줄을 바꾸지 않고 그 폭으로
  const W = b.parentNode.clientWidth, x = parseFloat(b.style.getPropertyValue('--x')) / 100 * W;
  const room = (b.classList.contains('ar') ? x + cap : W - x) - 4;                              // 칸 밖으로 나가지 않을 만큼
  if (one <= cap * 1.3 && one <= W * 0.92 && one <= room) { b.style.width = Math.ceil(one) + 'px'; return; }
  // 긴 말: 최대 폭에서의 줄 수를 유지하는 가장 좁은 폭(줄 길이가 고르게 나뉜다)
  b.style.maxWidth = grow > 1.05 ? Math.max(40, Math.min(cap, room)) + 'px' : ''; b.style.width = '';
  const H = b.offsetHeight, max = parseFloat(getComputedStyle(b).width);
  let lo = 0, hi = Math.ceil(max);
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; b.style.width = mid + 'px'; if (b.offsetHeight > H) lo = mid; else hi = mid; }
  b.style.width = Math.min(max, hi + 1) + 'px';
  if (b.offsetHeight > H) b.style.width = '';                                                     // 그래도 줄이 늘면 원래대로
}
function drawTails(root) {
  root.querySelectorAll('.pfig').forEach(fig => {
    const b = fig.querySelector('.pbub'), art = fig.querySelector('.wtp-art'); if (!b || !art) return;
    fitBubble(b);
    fig.querySelector('svg.ptail')?.remove();
    const W = fig.offsetWidth, H = art.offsetHeight, s = W / 360;
    const B = { l: b.offsetLeft, t: b.offsetTop, r: b.offsetLeft + b.offsetWidth, bo: b.offsetTop + b.offsetHeight };
    const over = B.bo - H; fig.style.paddingBottom = over > 0 ? (over + 10 * s) + 'px' : '';
    if (b.dataset.tail !== '1') return;
    const T = { x: +b.dataset.tx / 100 * W, y: +b.dataset.ty / 100 * H };
    const R = 14 * s;
    let base;
    if (T.y < B.t) base = { x: Math.max(B.l + R, Math.min(B.r - R, T.x)), y: B.t };
    else if (T.y > B.bo) base = { x: Math.max(B.l + R, Math.min(B.r - R, T.x)), y: B.bo };
    else if (T.x < B.l) base = { x: B.l, y: Math.max(B.t + R, Math.min(B.bo - R, T.y)) };
    else if (T.x > B.r) base = { x: B.r, y: Math.max(B.t + R, Math.min(B.bo - R, T.y)) };
    else return;                                                     // 목표가 말풍선 안 → 꼬리 없음
    const vx = T.x - base.x, vy = T.y - base.y, len = Math.hypot(vx, vy) || 1, L = Math.min(24 * s, len * 0.85);
    const tip = { x: base.x + vx / len * L, y: base.y + vy / len * L };
    const side = base.x === B.l || base.x === B.r, h = 7 * s;
    const p1 = side ? { x: base.x, y: base.y - h } : { x: base.x - h, y: base.y };
    const p2 = side ? { x: base.x, y: base.y + h } : { x: base.x + h, y: base.y };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ptail');
    svg.innerHTML = `<polygon points="${p1.x},${p1.y} ${tip.x},${tip.y} ${p2.x},${p2.y}" fill="#fffdf7" stroke="#c9a46a" stroke-width="${s}" stroke-linejoin="round"/>`
      + `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#fffdf7" stroke-width="${2.6 * s}"/>`;
    fig.appendChild(svg);
  });
}
// 말풍선 폰트(3.8MB)가 아직 안 왔으면 임시 글꼴로 잰 폭이라, 폰트가 도착하면 다시 맞춘다.
// fonts.ready는 폰트를 요청하기 전이면 바로 끝나 버리므로 이 폰트를 직접 불러서 기다린다
const bubFontReady = document.fonts ? document.fonts.load('16px "Myoeunttobak"').catch(() => {}) : Promise.resolve();
// 불러온 직후에는 화면이 아직 임시 글꼴로 그려져 있어, 두 프레임 뒤(새 글꼴로 다시 그린 뒤)에 잰다
const refitAll = () => { document.querySelectorAll('.pbub').forEach(b => { delete b.dataset.fit; }); drawTails(document); };
bubFontReady.then(() => requestAnimationFrame(() => requestAnimationFrame(refitAll)));
document.fonts?.addEventListener?.('loadingdone', () => requestAnimationFrame(() => requestAnimationFrame(refitAll)));
