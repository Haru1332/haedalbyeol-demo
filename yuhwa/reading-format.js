// 풀이 글 읽기: AI가 '@결론', '@소제목' 같은 표시를 붙여 쓴 글을 화면용 조각으로 나눈다(월화 → 혜화 reading-format.js를 복사해 고침).
// 실시간으로 받는 도중(done=false)에도 부를 수 있다: 아직 다 안 온 마지막 줄이 표시 줄이면 건너뛰고, 글 줄이면 지금 묶음에 붙인다.
// 화면(브라우저)과 서버(node)가 같이 쓴다.
(function () {
  // 유화가 말하는 칸에 쓸 수 있는 장면(prompts/answer-system.md와 같게). 모르는 이름(예: 예전 chart)은 read로
  const SCENES = ['read', 'explain', 'think', 'smile', 'surprise', 'worried', 'reveal', 'stella', 'timing', 'telescope', 'back'];
  function line(rest) {                                                // '장면 | 말' → { scene, text }
    const i = rest.indexOf('|');
    const scene = i >= 0 ? rest.slice(0, i).trim() : 'read', text = (i >= 0 ? rest.slice(i + 1) : rest).trim();
    return { scene: SCENES.includes(scene) ? scene : 'read', text };
  }
  function parseReading(text, done) {
    const R = { headline: '', basis: '', reacts: [], sections: [], closing: null, keypoint: '' };
    let cur = null;
    const rows = String(text || '').replace(/\r/g, '').split('\n');
    rows.forEach((raw, i) => {
      const partial = !done && i === rows.length - 1;                  // 아직 쓰는 중인 마지막 줄
      const m = raw.match(/^\s*@(\S+)\s*(.*)$/);
      if (m || (partial && /^\s*@/.test(raw))) {
        if (partial) return;
        const tag = m[1], rest = m[2];
        if (tag === '결론') R.headline = rest.trim();
        else if (tag === '근거') R.basis = rest.trim();
        else if (tag === '반응') R.reacts.push(line(rest));
        else if (tag === '소제목') { if (cur) cur.open = false; cur = { title: rest.trim(), text: '', beat: null, open: true }; R.sections.push(cur); }
        else if (tag === '한마디') { if (cur) { cur.beat = line(rest); cur.open = false; } }
        else if (tag === '마무리') { R.closing = line(rest); if (cur) cur.open = false; cur = null; }
        else if (tag === '핵심') R.keypoint = rest.trim();
        return;
      }
      if (cur && cur.open) cur.text += (cur.text ? '\n' : '') + raw.trimEnd();
    });
    R.sections.forEach(s => { s.text = s.text.trim(); if (done) s.open = false; });
    R.body = R.sections.map(s => s.text).join('\n\n');
    R.done = !!done;
    return R;
  }
  globalThis.parseReading = parseReading;
})();
