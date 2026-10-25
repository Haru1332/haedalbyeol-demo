// 풀이 글 읽기: AI가 '@결론', '@소제목' 같은 표시를 붙여 쓴 글을 화면용 조각으로 나눈다.
// 실시간으로 받는 도중(done=false)에도 부를 수 있다: 아직 다 안 온 마지막 줄이 표시 줄이면 건너뛰고, 글 줄이면 지금 묶음에 붙인다.
// 화면(브라우저)과 서버(node)가 같이 쓴다.
(function () {
  // 월화가 말하는 칸에 쓸 수 있는 장면(월화가 나오는 그림만). 여우·소품만 있는 그림은 비슷한 월화 장면으로 바꾼다
  const SCENES = ['read', 'surprise', 'smile', 'wink', 'worried', 'explain', 'think', 'reveal', 'timing', 'wedding'];
  const NEAR = { rings: 'wedding', 'moon-time': 'timing', silhouette: 'explain', 'meet-cafe': 'explain', 'meet-office': 'explain', 'meet-gathering': 'explain', shuffle: 'read', spread: 'read', draw: 'reveal' };
  // ==핵심 구절== 은 풀이 묶음 글에만 쓴다. 말풍선·결론·카드·핵심에 섞여 오면 지우고 센다(점검용 R.hlMisuse)
  let misuse = 0;
  const unmark = t => (t.includes('==') ? (misuse++, t.replace(/==/g, '')) : t);
  function line(rest) {                                                // '장면 | 말' → { scene, text }
    const i = rest.indexOf('|');
    const scene = i >= 0 ? rest.slice(0, i).trim() : 'read', text = unmark((i >= 0 ? rest.slice(i + 1) : rest).trim());
    return { scene: SCENES.includes(scene) ? scene : NEAR[scene] || 'read', text };
  }
  function parseReading(text, done) {
    const R = { headline: '', card: '', reacts: [], sections: [], closing: null, keypoint: '' };
    misuse = 0;
    let cur = null;
    const rows = String(text || '').replace(/\r/g, '').split('\n');
    rows.forEach((raw, i) => {
      const partial = !done && i === rows.length - 1;                  // 아직 쓰는 중인 마지막 줄
      const m = raw.match(/^\s*@(\S+)\s*(.*)$/);
      if (m || (partial && /^\s*@/.test(raw))) {
        if (partial) return;
        const tag = m[1], rest = m[2];
        if (tag === '결론') R.headline = unmark(rest.trim());
        else if (tag === '카드') R.card = unmark(rest.trim());
        else if (tag === '반응') R.reacts.push(line(rest));
        else if (tag === '소제목') { if (cur) cur.open = false; cur = { title: unmark(rest.trim()), text: '', beat: null, open: true }; R.sections.push(cur); }
        else if (tag === '한마디') { if (cur) { cur.beat = line(rest); cur.open = false; } }
        else if (tag === '마무리') { R.closing = line(rest); if (cur) cur.open = false; cur = null; }
        else if (tag === '핵심') R.keypoint = unmark(rest.trim());
        return;
      }
      if (cur && cur.open) cur.text += (cur.text ? '\n' : '') + raw.trimEnd();
    });
    R.sections.forEach(s => { s.text = s.text.trim(); if (done) s.open = false; });
    R.body = R.sections.map(s => s.text).join('\n\n');
    R.done = !!done; R.hlMisuse = misuse;
    return R;
  }
  globalThis.parseReading = parseReading;
})();
