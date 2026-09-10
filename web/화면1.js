// 화면 1 — 입력 (계획서 3장)
//
// 값은 브라우저 메모리에 들고 있다가 화면 3에서 한 번에 서버로 보낸다 (2장).
// 프롬프트 조립은 화면이 하지 않고 서버에 물어본다 — 규칙이 두 군데 있으면 어긋난다 (5장).

const 화면1 = (() => {
  const 것 = (아이디) => document.getElementById(아이디);

  let 설정 = null;
  let 그림체목록 = [];
  let 세트번호를손으로고쳤나 = false;

  // ── 서버에 묻기 ──────────────────────────────────

  async function 가져오기(주소) {
    const 답 = await fetch(주소);
    const 값 = await 답.json();
    if (!답.ok) throw new Error(값.오류 || '서버가 답하지 않았어요.');
    return 값;
  }

  async function 보내기(주소, 몸) {
    const 답 = await fetch(주소, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(몸),
    });
    const 값 = await 답.json();
    if (!답.ok) throw new Error(값.오류 || '저장하지 못했어요.');
    return 값;
  }

  // ── 제출 유형 (3장 — JPG는 고를 수 없다) ─────────

  function 제출유형그리기() {
    const 고르개 = 것('제출유형');
    고르개.innerHTML = '';

    설정.제출유형.forEach((유형) => {
      const 쓸수있나 = 설정.쓸수있는제출유형.includes(유형);
      const 하나 = document.createElement('option');
      하나.value = 유형;
      하나.textContent = 쓸수있나 ? 유형 : `${유형}  —  다음 범위`;
      하나.disabled = !쓸수있나;
      고르개.appendChild(하나);
    });

    고르개.value = 상태.제출유형;
    것('제출유형안내').textContent =
      '패턴·배경용 공통 문장을 아직 쓰지 않아서 JPG는 다음 범위예요.';
  }

  // ── 세트번호 (3장 자동 채번) ─────────────────────

  async function 세트번호받아오기() {
    const 답 = await 가져오기(
      '/api/세트번호?제출유형=' + encodeURIComponent(상태.제출유형)
    );
    상태.세트번호 = 답.세트번호;
    것('세트번호').value = 답.세트번호;
    안내(것('세트번호안내'), '결과 폴더를 읽어 자동으로 매겼어요.', false);
    것('세트번호').classList.remove('탈남');
  }

  async function 세트번호확인() {
    const 값 = 것('세트번호').value.trim().toUpperCase();
    것('세트번호').value = 값;
    상태.세트번호 = 값;

    if (!값) {
      세트번호를손으로고쳤나 = false;
      await 세트번호받아오기();
      return;
    }

    const 답 = await 가져오기(
      `/api/세트번호확인?세트번호=${encodeURIComponent(값)}` +
        `&제출유형=${encodeURIComponent(상태.제출유형)}`
    );

    상태.세트번호쓸수있나 = 답.쓸수있나;
    것('세트번호').classList.toggle('탈남', !답.쓸수있나);
    안내(
      것('세트번호안내'),
      답.쓸수있나 ? '쓸 수 있는 번호예요.' : 답.까닭,
      !답.쓸수있나
    );
  }

  function 안내(어디, 글, 탈났나) {
    어디.textContent = 글;
    어디.classList.toggle('탈났어', !!탈났나);
  }

  // ── 그림체 칩 (3장) ──────────────────────────────

  function 그림체그리기() {
    const 줄 = 것('그림체칩');
    줄.innerHTML = '';

    그림체목록.forEach((그림체) => {
      const 칩 = document.createElement('button');
      칩.type = 'button';
      칩.className = '칩';
      if (그림체.이름 === 상태.그림체이름) 칩.classList.add('고름');
      if (그림체.검증 === false) 칩.classList.add('미검증');

      칩.append(그림체.이름);
      if (그림체.검증 === false) {
        const 딱지 = document.createElement('span');
        딱지.className = '딱지';
        딱지.textContent = '미검증';
        딱지.title = 'ChatGPT에 넣어 확인한 적이 없어요. 한 번 뽑아보고 다듬으세요.';
        칩.appendChild(딱지);
      }

      칩.addEventListener('click', () => {
        상태.그림체이름 = 그림체.이름;
        그림체그리기();
        미리보기그리기();
      });

      줄.appendChild(칩);
    });

    const 더하기 = document.createElement('button');
    더하기.type = 'button';
    더하기.className = '칩 더하기';
    더하기.textContent = '+ 그림체 추가';
    더하기.addEventListener('click', 더하기열기);
    줄.appendChild(더하기);
  }

  // ── 그림체 추가 (3장 그림체 추가 규칙) ───────────

  function 더하기열기() {
    것('그림체더하기').hidden = false;
    것('더하기탈').hidden = true;
    것('새이름').focus();
  }

  function 더하기닫기() {
    것('그림체더하기').hidden = true;
    ['새이름', '새종류', '새스타일', '새금지'].forEach((아이디) => {
      것(아이디).value = '';
    });
    것('더하기탈').hidden = true;
  }

  async function 더하기저장() {
    const 값 = {
      이름: 것('새이름').value,
      종류: 것('새종류').value,
      스타일: 것('새스타일').value,
      금지: 것('새금지').value,
    };

    try {
      const 답 = await 보내기('/api/그림체', 값);
      그림체목록 = 답.그림체;
      // 저장하면 즉시 선택 상태가 되고 목록 맨 뒤에 붙는다 (3장)
      상태.그림체이름 = 답.더한것.이름;
      더하기닫기();
      그림체그리기();
      미리보기그리기();
    } catch (오류) {
      const 탈 = 것('더하기탈');
      탈.textContent = 오류.message;
      탈.hidden = false;
    }
  }

  // ── 조립 미리보기 (3장 · 5장) ────────────────────

  function 자리표시(글) {
    // {소재} · {형태} 는 색을 달리해서 "여기가 바뀌는 자리"임을 보인다
    const 조각 = document.createDocumentFragment();
    const 나눔 = 글.split(/(\{소재\}|\{형태\})/);

    나눔.forEach((하나) => {
      if (하나 === '{소재}' || 하나 === '{형태}') {
        const 칸 = document.createElement('span');
        칸.className = '바뀌는자리';
        칸.textContent = 하나;
        조각.appendChild(칸);
      } else if (하나) {
        조각.appendChild(document.createTextNode(하나));
      }
    });

    return 조각;
  }

  async function 미리보기그리기() {
    const 어디 = 것('미리보기');

    try {
      const 답 = await 가져오기(
        `/api/미리보기?그림체=${encodeURIComponent(상태.그림체이름)}` +
          `&제출유형=${encodeURIComponent(상태.제출유형)}`
      );

      어디.innerHTML = '';
      답.줄들.forEach((줄) => {
        const 칸 = document.createElement('div');
        칸.className = '줄';

        const 어디서 = document.createElement('div');
        어디서.className = '어디' + (줄.소재줄 ? ' 소재쪽' : '');
        어디서.textContent = `${줄.번호}  ${줄.출처}`;

        const 글칸 = document.createElement('div');
        글칸.className = '글';
        글칸.appendChild(자리표시(줄.글));

        칸.append(어디서, 글칸);
        어디.appendChild(칸);
      });
    } catch (오류) {
      어디.innerHTML = '';
      const 알림 = document.createElement('div');
      알림.className = '알림';
      알림.textContent = '미리보기를 못 만들었어요: ' + 오류.message;
      어디.appendChild(알림);
    }
  }

  // ── 폴더 이름 미리 보여주기 ──────────────────────

  function 폴더이름그리기() {
    const 이름 = 상태.세트이름.trim().replace(/\s+/g, '');
    안내(
      것('폴더이름안내'),
      이름 ? `결과\\${상태.세트번호}_${이름}\\ 에 담겨요.` : '',
      false
    );
  }

  // ── 시작 ─────────────────────────────────────────

  async function 켜기() {
    설정 = await 가져오기('/api/설정');
    그림체목록 = (await 가져오기('/api/그림체')).그림체;

    if (!상태.그림체이름) 상태.그림체이름 = 그림체목록[0].이름;
    if (!상태.제출유형) 상태.제출유형 = 설정.쓸수있는제출유형[0];

    제출유형그리기();
    그림체그리기();

    것('만들것').value = 상태.만들것;
    것('세트이름').value = 상태.세트이름;

    if (!세트번호를손으로고쳤나) await 세트번호받아오기();
    폴더이름그리기();
    await 미리보기그리기();

    // 값이 바뀌면 브라우저 메모리에 담아 둔다 (2장)
    것('만들것').addEventListener('input', (일) => {
      상태.만들것 = 일.target.value;
    });

    것('세트이름').addEventListener('input', (일) => {
      상태.세트이름 = 일.target.value;
      폴더이름그리기();
    });

    것('세트번호').addEventListener('input', () => {
      세트번호를손으로고쳤나 = true;
    });
    것('세트번호').addEventListener('change', async () => {
      await 세트번호확인();
      폴더이름그리기();
    });

    것('제출유형').addEventListener('change', async (일) => {
      상태.제출유형 = 일.target.value;
      // 제출 유형이 접두어를 정하므로 번호를 다시 매긴다 (3장)
      세트번호를손으로고쳤나 = false;
      await 세트번호받아오기();
      폴더이름그리기();
      await 미리보기그리기();
    });

    것('더하기취소').addEventListener('click', 더하기닫기);
    것('더하기저장').addEventListener('click', 더하기저장);
  }

  return { 켜기 };
})();
