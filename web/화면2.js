// 화면 2 — 목록 (계획서 4장)
//
// 화면에 들어오면 AI가 소재 목록을 뽑아 표를 채운다.
// 사람이 하는 일은 지우기 · 고치기 · 더하기 셋이다.
//
//   AI가 뽑는다   화면 1의 "만들고 싶은 것" 한 줄 + 그림체를 재료로 (설정 개수만큼)
//   사람이 지운다  × 버튼. 지운 소재는 다시 추천하지 않는다
//   사람이 고친다  표의 소재 · 형태 칸을 그대로 타이핑
//   사람이 더한다  몇 개 더 뽑기 · 직접 적기
//
// **붙여넣기는 없앴다** (0장 개정표). AI가 채우므로 시트에서 옮겨 올 일이 없어졌다.
// 투입 폴더의 세트.txt는 그대로 남아 있고 build.js가 읽는다 — 그건 다른 입구다.
//
// 브라우저는 OpenAI를 직접 부르지 않는다. 서버에 물어본다 (10장).

const 화면2 = (() => {
  const 것 = (아이디) => document.getElementById(아이디);

  let 번호들 = [];
  let AI연결됨 = false;
  let 뽑는중인가 = false;

  // ── 서버에 묻기 ──────────────────────────────────

  async function 보내기(주소, 몸) {
    const 답 = await fetch(주소, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(몸),
    });
    const 값 = await 답.json();
    if (!답.ok) {
      const 탈 = new Error(값.오류 || '서버가 답하지 않았어요.');
      탈.연결안됨 = Boolean(값.연결안됨);
      탈.한도넘음 = Boolean(값.한도넘음);
      throw 탈;
    }
    return 값;
  }

  // 아이템번호는 삭제·추가 후 항상 1부터 다시 매긴다 (4장)
  async function 번호다시매기기() {
    if (상태.목록.length === 0) {
      번호들 = [];
      return;
    }
    try {
      const 답 = await 보내기('/api/목록번호', {
        세트번호: 상태.세트번호,
        개수: 상태.목록.length,
      });
      번호들 = 답.번호들;
    } catch {
      번호들 = 상태.목록.map(() => '—');
    }
  }

  function 탈보이기(글) {
    const 탈 = 것('목록탈');
    if (!글) {
      탈.textContent = '';
      탈.hidden = true;
      return;
    }
    탈.textContent = 글;
    탈.hidden = false;
  }

  // ── 표 그리기 ────────────────────────────────────

  function 줄만들기(항목, 자리) {
    const 줄 = document.createElement('tr');

    const 번호칸 = document.createElement('td');
    번호칸.className = '아이템번호';
    번호칸.textContent = 번호들[자리] || '—';

    const 소재칸 = document.createElement('td');
    const 소재입력 = document.createElement('input');
    소재입력.type = 'text';
    소재입력.className = '칸입력 소재칸';
    소재입력.value = 항목.소재;
    소재입력.placeholder = '무엇을 그릴지';
    // AI가 뽑은 것도 그대로 고칠 수 있어야 한다 (4장)
    소재입력.addEventListener('input', (일) => {
      상태.목록[자리].소재 = 일.target.value;
    });
    소재칸.appendChild(소재입력);

    const 형태칸 = document.createElement('td');
    const 형태입력 = document.createElement('input');
    형태입력.type = 'text';
    형태입력.className = '칸입력';
    형태입력.value = 항목.형태;
    형태입력.placeholder = '시점 · 재질 · 색감 · 계절 · 분위기';
    형태입력.addEventListener('input', (일) => {
      상태.목록[자리].형태 = 일.target.value;
    });
    형태칸.appendChild(형태입력);

    const 지움칸 = document.createElement('td');
    const 지움 = document.createElement('button');
    지움.type = 'button';
    지움.className = '줄지움';
    지움.textContent = '×';
    지움.title = '이 줄 지우기';
    지움.addEventListener('click', () => 줄지우기(자리));
    지움칸.appendChild(지움);

    줄.append(번호칸, 소재칸, 형태칸, 지움칸);
    return 줄;
  }

  async function 그리기() {
    await 번호다시매기기();

    const 몸 = 것('목록몸');
    몸.innerHTML = '';
    상태.목록.forEach((항목, 자리) => 몸.appendChild(줄만들기(항목, 자리)));

    것('목록수').textContent = 상태.목록.length + '개';
    것('빈목록').hidden = 상태.목록.length > 0 || 뽑는중인가;

    // 목록이 0개거나 뽑는 중이면 생성 버튼 비활성 (4장)
    것('생성단추').disabled = 상태.목록.length === 0 || 뽑는중인가;

    // 지운 항목은 다시 추천하지 않는다 — 더 뽑을 때 서버로 넘긴다 (4장)
    것('지운것안내').textContent = 상태.지운것.length
      ? `지운 소재 ${상태.지운것.length}개는 다시 안 뽑아요: ${상태.지운것.join(' · ')}`
      : '';

    단추상태맞추기();
  }

  // ── 단추와 딱지 ──────────────────────────────────

  function 남은호출() {
    return Math.max(0, 상태.AI.목록호출한도 - 상태.AI.부른횟수);
  }

  function 단추상태맞추기() {
    const 못부름 = !AI연결됨 || 뽑는중인가 || 남은호출() === 0;
    것('다시뽑기').disabled = 못부름;
    것('더뽑기').disabled = 못부름;
    것('직접더하기').disabled = 뽑는중인가;

    const 안내 = 것('더뽑기안내');
    if (!AI연결됨) {
      안내.textContent = 'AI 연결이 없어 뽑지 못해요. 직접 적기로 더해 주세요.';
    } else if (남은호출() === 0) {
      안내.textContent =
        `한 세트에서 뽑기는 ${상태.AI.목록호출한도}번까지예요. ` +
        '직접 적기로 더하시거나 새 세트로 시작해 주세요.';
    } else {
      안내.textContent =
        `지금 목록 아래에 이어붙여요. 지운 소재는 빼고 뽑아요. (${남은호출()}번 더 뽑을 수 있어요)`;
    }
  }

  function 딱지맞추기() {
    const 딱지 = 것('AI상태');
    딱지.classList.toggle('연결됨', AI연결됨);
    딱지.classList.toggle('끊김', !AI연결됨);
    딱지.textContent = AI연결됨 ? 'AI 연결됨' : 'AI 연결 안 됨';
    딱지.title = AI연결됨
      ? `목록 모델 ${상태.AI.목록모델}`
      : '실행.bat 옆 .env 파일에 OPENAI_API_KEY를 적고 다시 켜세요. 검은 창에 경로가 적혀 있어요.';
  }

  // 6개에 5~6초쯤 걸린다. 짧아졌지만 그래도 초를 세어 준다 — 멈춘 것처럼 보이면 안 되니까
  let 초세기 = null;

  function 뽑는중보이기(켤까, 글) {
    뽑는중인가 = 켤까;
    것('뽑는중').hidden = !켤까;
    것('빈목록').hidden = 상태.목록.length > 0 || 켤까;

    // 뽑는 동안에는 다음 화면으로 못 넘어간다 — 빈 목록으로 넘어가면 화면 3이 빈다
    것('생성단추').disabled = 뽑는중인가 || 상태.목록.length === 0;

    clearInterval(초세기);
    초세기 = null;

    if (!켤까) return;

    const 바탕 = 글 || '뽑고 있어요';
    const 시작 = Date.now();
    const 그리기 = () => {
      const 초 = Math.round((Date.now() - 시작) / 1000);
      것('뽑는중글').textContent =
        `${바탕} (${초}초)` + (초 >= 30 ? ' — 개수가 많으면 더 걸려요' : '');
    };
    그리기();
    초세기 = setInterval(그리기, 1000);
    단추상태맞추기();
  }

  // ── AI로 뽑기 (4장) ─────────────────────────────

  /**
   * @param {boolean} 이어붙일까  true면 아래에 더하고, false면 새로 채운다
   * @param {number} 개수
   */
  async function 뽑기(이어붙일까, 개수) {
    if (뽑는중인가 || !AI연결됨 || 남은호출() === 0) return;

    탈보이기('');
    뽑는중보이기(true, 이어붙일까 ? '소재를 더 뽑고 있어요' : '소재 목록을 뽑고 있어요');

    try {
      // 이미 표에 있는 소재도 빼 달라고 한다 — 안 그러면 더 뽑을 때 겹친다
      const 이미있는것 = 상태.목록.map((하나) => (하나.소재 || '').trim()).filter(Boolean);
      const 뺄것 = [...new Set([...상태.지운것, ...(이어붙일까 ? 이미있는것 : [])])];

      const 답 = await 보내기('/api/소재목록', {
        입력: 상태.만들것,
        그림체이름: 상태.그림체이름,
        개수,
        뺄것,
        몇번째: 상태.AI.부른횟수 + 1,
      });

      상태.AI.부른횟수 += 1;
      상태.목록 = 이어붙일까 ? 상태.목록.concat(답.목록) : 답.목록.slice();
      뽑는중보이기(false);
      await 그리기();
    } catch (오류) {
      if (오류.한도넘음) 상태.AI.부른횟수 = 상태.AI.목록호출한도;
      if (오류.연결안됨) AI연결됨 = false;
      뽑는중보이기(false);
      딱지맞추기();
      탈보이기(오류.message);
      await 그리기();
    }
  }

  // ── 줄 다루기 ────────────────────────────────────

  function 줄지우기(자리) {
    const 지운것 = 상태.목록[자리];
    const 이름 = (지운것.소재 || '').trim();
    if (이름 && !상태.지운것.includes(이름)) 상태.지운것.push(이름);

    상태.목록.splice(자리, 1);
    그리기();
  }

  // 직접 적기 — 앞 판의 "+ 빈 줄"을 이 칸이 흡수했다 (4장)
  function 직접더하기() {
    const 소재칸 = 것('직접소재');
    const 형태칸 = 것('직접형태');
    const 소재 = 소재칸.value.trim();

    if (!소재) {
      탈보이기('소재를 적어 주세요.');
      소재칸.focus();
      return;
    }

    탈보이기('');
    상태.목록.push({ 소재, 형태: 형태칸.value.trim() });
    소재칸.value = '';
    형태칸.value = '';
    소재칸.focus();
    그리기();
  }

  // ── 시작 ─────────────────────────────────────────

  function 켜기() {
    것('다시뽑기').addEventListener('click', () => 뽑기(false, 상태.AI.소재개수));

    것('더뽑기').addEventListener('click', () => {
      const 몇 = Math.max(1, Math.min(20, Number(것('더뽑을수').value) || 상태.AI.소재개수));
      뽑기(true, 몇);
    });

    것('직접더하기').addEventListener('click', 직접더하기);
    [것('직접소재'), 것('직접형태')].forEach((칸) =>
      칸.addEventListener('keydown', (일) => {
        if (일.key === 'Enter') 직접더하기();
      })
    );
  }

  // 화면 2로 넘어올 때마다 — 세트번호가 화면 1에서 바뀌었을 수 있다
  async function 보이기() {
    // AI 연결 상태를 확인한다. 열쇠 자체는 오지 않는다 (10장)
    try {
      const 답 = await fetch('/api/AI상태').then((하나) => 하나.json());
      AI연결됨 = Boolean(답.연결됨);
      상태.AI.목록모델 = 답.목록모델;
      상태.AI.소재개수 = 답.소재개수;
      상태.AI.목록호출한도 = 답.목록호출한도;
    } catch {
      AI연결됨 = false;
    }
    딱지맞추기();

    if (!AI연결됨) {
      탈보이기(
        'AI 연결이 필요해요. 실행.bat 옆 .env 파일에 OPENAI_API_KEY를 적고 다시 켜 주세요. ' +
          '(검은 창에 파일 경로가 적혀 있어요) 그때까지는 아래 직접 적기로 목록을 만들 수 있어요.'
      );
      await 그리기();
      return;
    }

    // 표가 비어 있고 아직 한 번도 안 불렀으면 자동으로 뽑는다 (4장)
    if (상태.목록.length === 0 && 상태.AI.부른횟수 === 0) {
      await 뽑기(false, 상태.AI.소재개수);
      return;
    }

    await 그리기();
  }

  return { 켜기, 보이기, 그리기 };
})();
