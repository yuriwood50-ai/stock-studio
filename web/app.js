// 스톡 스튜디오 — 화면 이동과 상태
// 주소창의 #/1 ~ #/4 로 화면을 정한다. 브라우저 뒤로가기가 그대로 먹는다.
//
// 상태는 브라우저 메모리에 들고 있다가 화면 3에서 한 번에 서버로 보낸다 (계획서 2장).
// 새로고침하면 사라진다. 세트 하나를 만드는 동안만 쓰는 값이라 그걸로 충분하다.

const 상태 = {
  만들것: '',
  세트번호: '',
  세트번호쓸수있나: true,
  세트이름: '',
  제출유형: '',
  그림체이름: '',
  목록: [], // 화면 2에서 AI가 채우고 사람이 고친다 — [{소재, 형태}]
  지운것: [], // 지운 소재는 다시 뽑지 않는다. 더 뽑을 때 서버로 넘긴다 (4장)

  // AI 목록 생성 (4장 · 12장). 열쇠는 여기 없다 — 서버만 안다 (10장)
  AI: {
    부른횟수: 0, // 한 세트에서 몇 번 불렀나
    목록호출한도: 5, // 서버가 알려 주는 값으로 덮인다
    소재개수: 6, // 서버가 알려 주는 값으로 덮인다
    목록모델: '',
  },
  전체복사글: '', // 화면 3이 서버에서 받아 둔다
  파일받기문구: '',
  보고서: null, // 정리가 끝나면 화면 4가 이걸 보여준다
};

const 화면들 = document.querySelectorAll('.화면');
const 단계들 = document.querySelectorAll('.단계');
const 첫화면 = 1;
const 끝화면 = 화면들.length;

function 지금화면() {
  const 숫자 = parseInt(location.hash.replace('#/', ''), 10);
  return 숫자 >= 첫화면 && 숫자 <= 끝화면 ? 숫자 : 첫화면;
}

function 그리기() {
  const 지금 = 지금화면();

  화면들.forEach((화면) => {
    화면.hidden = Number(화면.dataset.화면) !== 지금;
  });

  단계들.forEach((단계) => {
    const 번호 = Number(단계.dataset.단계);
    단계.classList.toggle('지금', 번호 === 지금);
    단계.classList.toggle('지남', 번호 < 지금);
    if (번호 === 지금) 단계.setAttribute('aria-current', 'step');
    else 단계.removeAttribute('aria-current');
  });

  document.querySelector('.본문').scrollTop = 0;
  document.title = `스톡 스튜디오 — ${지금} / ${끝화면}`;

  // 화면 2·3은 넘어올 때마다 다시 그린다 — 앞 화면에서 값이 바뀌었을 수 있다
  // (화면2.js · 화면3.js 가 app.js 보다 먼저 실려서 여기서는 늘 있다)
  if (지금 === 2) 화면2.보이기();
  if (지금 === 3) 화면3.보이기();
  if (지금 === 4) 화면4.보이기();
}

function 가기(번호) {
  location.hash = '#/' + 번호;
}

// 바닥 단추와 완료 화면 단추
document.addEventListener('click', (일) => {
  const 단추 = 일.target.closest('[data-이동]');
  if (!단추 || 단추.disabled) return;
  가기(단추.dataset.이동);
});

// 왼쪽 · 오른쪽 방향키로도 넘어간다
document.addEventListener('keydown', (일) => {
  if (일.target.matches('input, textarea, select')) return;
  if (일.key === 'ArrowRight' && 지금화면() < 끝화면) 가기(지금화면() + 1);
  if (일.key === 'ArrowLeft' && 지금화면() > 첫화면) 가기(지금화면() - 1);
});

window.addEventListener('hashchange', 그리기);

if (!location.hash) location.replace('#/1');

화면2.켜기();
화면3.켜기();
화면4.켜기();
그리기();

// 서버의 API 연결 상태를 상단에 표시한다.
async function 열쇠상태확인() {
  let 연결됨 = false;
  try {
    const 응답 = await fetch('/api/AI상태');
    if (!응답.ok) throw new Error('API 상태 확인 실패');
    const 답 = await 응답.json();
    연결됨 = 답.연결됨 === true;
  } catch {
    연결됨 = false;
  }
  document.getElementById('열쇠없음').classList.toggle('켜짐', !연결됨);
  document.getElementById('열쇠있음').classList.toggle('켜짐', 연결됨);
}

열쇠상태확인();

// 화면 1을 켠다. 서버에서 설정과 그림체를 받아 온다
화면1.켜기().catch((오류) => {
  console.error('화면 1을 켜지 못했어요:', 오류);
  const 어디 = document.getElementById('미리보기');
  if (어디) 어디.innerHTML = '<div class="알림">서버에 닿지 못했어요: ' + 오류.message + '</div>';
});
