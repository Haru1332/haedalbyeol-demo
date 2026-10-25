// 포트폴리오 체험판 공통 화면 도구: 손님 프리셋 줄, 칸에 글자 채우기, '손님 정보로 진행돼요' 안내.
// 가게의 입력창·단추는 그대로 두고, 그 위에 덧붙이기만 한다.
(function () {
  const BADGE = 'display:block;width:fit-content;max-width:100%;margin:0 auto 8px;padding:6px 14px;border-radius:99px;'
    + 'background:rgba(20,14,10,.9);color:#f5ead6;border:1px solid rgba(217,168,95,.8);font-size:14px;font-weight:700;'
    + 'line-height:1.4;text-align:center;word-break:keep-all;box-shadow:0 2px 10px rgba(0,0,0,.45)';
  const PILL = 'border:1px solid rgba(217,168,95,.9);background:#d9a85f;color:#1d1410;border-radius:99px;padding:7px 18px;'
    + 'font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)';

  // 프리셋 줄: 안내 띠 + 손님 단추들. onPick(id)
  function presetRow(guests, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'demo-preset';
    wrap.style.cssText = 'grid-column:1/-1;width:100%;margin:0 0 10px;text-align:center';
    wrap.innerHTML = `<p style="${BADGE};white-space:nowrap;font-size:13px;padding:6px 12px">포트폴리오 체험판 · 오늘의 손님을 골라 주세요</p>`
      + `<div style="display:flex;gap:10px;justify-content:center">${guests.map(([id, g]) => `<button type="button" data-guest="${id}" style="${PILL}">${g.name}</button>`).join('')}</div>`;
    wrap.querySelectorAll('[data-guest]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      wrap.querySelectorAll('[data-guest]').forEach(x => { x.style.outline = x === b ? '3px solid #f5ead6' : 'none'; x.style.opacity = x === b ? '1' : '.6'; });
      onPick(b.dataset.guest);
    });
    return wrap;
  }

  // 잠깐 뜨는 안내(눌러도 안 되는 단추를 눌렀을 때)
  let tip = null, tipT = 0;
  function nudge(msg, near) {
    tip?.remove();
    tip = document.createElement('p');
    tip.textContent = msg;
    tip.style.cssText = BADGE + ';position:fixed;left:50%;transform:translateX(-50%);bottom:30%;z-index:9999;margin:0;white-space:nowrap;font-size:13px;padding:6px 12px';   // 한 줄로(2026-10-25 haru)
    (near?.closest('#frame') || document.body).append(tip);
    clearTimeout(tipT); tipT = setTimeout(() => tip?.remove(), 2200);
  }

  // 칸에 글자를 한 자씩 채우기(입력칸·글 상자). 고를 칸(select)은 바로 고른다. 채운 뒤에는 고칠 수 없게
  function fill(el, value, ms = 35) {
    if (!el) return Promise.resolve();
    if (el.tagName === 'SELECT') { el.value = String(value); el.dispatchEvent(new Event('change')); el.disabled = true; return Promise.resolve(); }
    el.readOnly = true; el.value = '';
    const s = String(value);
    return new Promise(r => { let i = 0; const t = setInterval(() => { el.value = s.slice(0, ++i); if (i >= s.length) { clearInterval(t); r(); } }, ms); });
  }

  // 단추 하나를 '이 손님은 이거' 표시(테두리)
  const mark = b => { if (b) { b.style.outline = '3px solid #d9a85f'; b.style.outlineOffset = '2px'; } };

  window.DEMO_UI = { presetRow, nudge, fill, mark };
})();
