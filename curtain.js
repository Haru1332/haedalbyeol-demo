// 입구 장막(2026-10-25 haru 「진입하자마자 클릭하는 뭔가 만들어서 … 음악 나오게」「매번」).
// 브라우저는 사람이 한 번 누르기 전에는 소리를 막는다(볼트 노트 '웹앱 오프닝 음악이 첫 터치 전에는 나오지 않는다') →
// 메인을 열 때마다 장막을 덮고, 장막을 누르면 걷히면서 음악이 시작된다(bgm.js의 HdbBgm.resume).
// 가게에서 돌아올 때는 덮지 않는다(haru 「돌아올 땐 장막 빼기」): [해·달·별로]로 온 ?from= 주소는 head의 스크립트가 html.curtained를 미리 빼고,
// 뒤로 가기로 돌아온 페이지(bfcache)는 이미 걷힌 그대로다. 그때 음악은 bgm.js가 처음 누를 때 튼다.
// 장막이 덮인 동안 뒤 화면(머리 줄·메인·예시·프로필·바닥 줄)은 inert라 눌리지 않고, 화살표 키도 문을 돌리지 않는다(main.js가 html.curtained를 본다).
// 카톡 안내 띠(.inapp)는 장막 위에 보인다(z-index).
(() => {
  const curtain = document.getElementById('curtain');
  if (!curtain) return;
  const root = document.documentElement, go = document.getElementById('curtain-go');
  if (!root.classList.contains('curtained')) { curtain.hidden = true; return; }   // 가게에서 돌아옴
  const behind = () => [...document.querySelectorAll('body > header, body > main, body > footer')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = 0;
  function cover() {
    clearTimeout(timer);
    root.classList.add('curtained');
    curtain.hidden = false; curtain.classList.remove('gone');
    behind().forEach((el) => { el.inert = true; });
    go.focus({ preventScroll: true });
  }
  function lift() {
    if (!root.classList.contains('curtained')) return;
    window.HdbBgm?.resume();
    root.classList.remove('curtained');
    behind().forEach((el) => { el.inert = false; });
    curtain.classList.add('gone');
    timer = setTimeout(() => { curtain.hidden = true; }, reduced ? 0 : 900);
  }
  // 세 얼굴 돌리기: 2.6초마다 오른쪽 얼굴이 가운데로(해·달·별 순서가 이어지게). 움직임 줄이기면 돌리지 않는다. 장막이 걷히면 멈춘다
  const faces = [...curtain.querySelectorAll('.c-faces span')];
  let spin = reduced ? 0 : setInterval(() => {
    if (!root.classList.contains('curtained')) { clearInterval(spin); return; }
    faces.forEach((f) => {
      const to = (Number(f.dataset.slot) + 2) % 3;
      if (to === 2) { f.classList.add('back'); setTimeout(() => f.classList.remove('back'), 850); }   // 왼쪽 끝 → 오른쪽 끝: 뒤로 돌아감
      f.dataset.slot = String(to);
    });
  }, 2600);
  curtain.addEventListener('click', lift);     // 장막 어디를 눌러도(단추는 Enter·Space로도)
  cover();
})();
