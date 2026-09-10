// 화면 4 — 완료 (계획서 9장)
//
// 요약 · 경로 · 폴더 구조 · 통과한 이미지 · 처리 결과 · 결과 폴더 열기 · 새 세트 만들기
//
// 보고서는 화면 3이 정리 시작을 눌렀을 때 서버가 돌려준 것이다 (상태.보고서).
// 폴더 구조와 썸네일은 실제로 만들어진 것을 다시 읽어 온다.

const 화면4 = (() => {
  const 것 = (아이디) => document.getElementById(아이디);

  async function 보내기(주소, 몸) {
    const 답 = await fetch(주소, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(몸),
    });
    const 값 = await 답.json();
    if (!답.ok) throw new Error(값.오류 || '서버가 답하지 않았어요.');
    return 값;
  }

  // ── 요약 (9장) ───────────────────────────────────
  // 세트이름 · 통과 N장 (표시 M장 포함) · 제외 K장

  function 요약글(보고서) {
    const 조각 = [];
    조각.push(보고서.세트이름 || 보고서.폴더이름);

    // 갈림길 결과를 그대로 보여준다 (7장 10번).
    // "통과 N장"만 적으면 어도비에 몇 장을 올릴 수 있는지 알 수 없다
    const 표시 = 보고서.유사표시수 ? ` (표시 ${보고서.유사표시수}장 포함)` : '';
    조각.push(`양쪽 ${보고서.양쪽수 || 0}장${표시}`);
    조각.push(`미리캔버스만 ${보고서.미리캔버스만수 || 0}장`);
    조각.push(`제외 ${보고서.제외수 || 0}장`);
    return 조각.join(' · ');
  }

  // ── 폴더 구조 트리 (9장) ─────────────────────────

  function 트리그리기(뿌리) {
    const 어디 = 것('트리');
    어디.innerHTML = '';

    function 한줄(마디, 앞머리, 마지막인가, 맨위인가) {
      const 줄 = document.createElement('div');

      if (!맨위인가) {
        const 가지 = document.createElement('span');
        가지.className = '가지';
        가지.textContent = 앞머리 + (마지막인가 ? '└── ' : '├── ');
        줄.appendChild(가지);
      }

      const 이름칸 = document.createElement('span');
      이름칸.className = 마디.폴더인가
        ? '폴더'
        : '파일' + (마디.유사표시 ? ' 표시됨' : '');
      이름칸.textContent = 마디.이름 + (마디.폴더인가 ? '/' : '');
      줄.appendChild(이름칸);

      // _check 파일은 색을 달리 표시한다 (9장)
      if (마디.유사표시) {
        const 꼬리 = document.createElement('span');
        꼬리.className = '꼬리';
        꼬리.textContent = '   ← 유사 확인';
        줄.appendChild(꼬리);
      }

      어디.appendChild(줄);

      if (마디.폴더인가 && 마디.안에) {
        const 다음앞머리 = 맨위인가 ? '' : 앞머리 + (마지막인가 ? '    ' : '│   ');
        마디.안에.forEach((아이, 자리) =>
          한줄(아이, 다음앞머리, 자리 === 마디.안에.length - 1, false)
        );
      }
    }

    한줄(뿌리, '', true, true);
  }

  // ── 통과한 이미지 썸네일 (9장) ───────────────────

  function 그림그리기(이미지들) {
    const 어디 = 것('그림칸들');
    어디.innerHTML = '';
    것('이미지셈').textContent = 이미지들.length + '장';

    이미지들.forEach((하나) => {
      const 칸 = document.createElement('div');
      칸.className = '그림하나' + (하나.유사표시 ? ' 표시됨' : '');

      const 자리 = document.createElement('div');
      자리.className = '그림자리';
      const 그림 = document.createElement('img');
      그림.src =
        '/api/결과그림?경로=' +
        encodeURIComponent(상태.보고서.폴더이름 + '/' + 하나.상대경로);
      그림.alt = 하나.이름;
      자리.appendChild(그림);

      const 이름 = document.createElement('div');
      이름.className = '그림이름';
      이름.textContent = 하나.이름;
      이름.title = 하나.이름;

      칸.append(자리, 이름);

      // 눈으로 재게 하지 않는다 — 크기 · 넓이 · 여백 · 갈 곳을 숫자로 (9장)
      if (하나.가로) {
        const 잰것 = document.createElement('div');
        잰것.className = '그림잰것';

        const 앞 = document.createElement('span');
        앞.textContent =
          `${하나.가로} × ${하나.세로} · ${하나.넓이MP.toFixed(1)}MP` +
          (하나.여백px != null ? ` · 사방 여백 ${하나.여백px}px` : '') +
          ' · ';
        잰것.appendChild(앞);

        const 곳 = document.createElement('span');
        곳.className = '어디에 ' + (하나.어디에 === '양쪽' ? '양쪽' : '미리캔버스');
        곳.textContent = 하나.어디에 === '양쪽' ? '양쪽' : '미리캔버스만';
        잰것.appendChild(곳);

        칸.appendChild(잰것);
      }

      어디.appendChild(칸);
    });
  }

  // ── 처리 결과 (9장) ─────────────────────────────

  function 줄더하기(어디, 갈래, 글) {
    const 줄 = document.createElement('li');
    const 딱지 = document.createElement('span');
    딱지.className = '갈래 ' + 갈래;
    딱지.textContent = 갈래;
    줄.appendChild(딱지);
    줄.appendChild(document.createTextNode(글));
    어디.appendChild(줄);
  }

  function 처리결과그리기(보고서) {
    const 어디 = 것('처리목록');
    어디.innerHTML = '';

    // 얼마나 잘랐는지 숫자로 보여준다. "잘라냄 1장"만으로는 알 수 없다 (9장)
    보고서.고친것.forEach((하나) => {
      줄더하기(어디, '고침', `${하나.갈래} — ${하나.장수}장`);
      if (하나.자세히) {
        const 줄 = 어디.lastElementChild;
        const 덧 = document.createElement('div');
        덧.className = '고침자세히';
        덧.textContent = 하나.자세히;
        줄.appendChild(덧);
      }
    });

    // 제외는 사유별로 개수를 적는다. 7장의 일곱 문구를 그대로 쓴다 (9장)
    보고서.제외.forEach((하나) => 줄더하기(어디, '제외', `${하나.사유} — ${하나.장수}장`));

    // 갈림길 — 왜 미리캔버스로 갔는지와 어떻게 고치는지 (7장 10번)
    if (보고서.미리캔버스만수) {
      줄더하기(
        어디,
        '갈림',
        `미리캔버스만 ${보고서.미리캔버스만수}장 — 어도비 4MP 하한에 못 미쳐요. ` +
          '04_업로드준비\\미리캔버스만\\ 에 따로 담았어요'
      );
    }

    if (보고서.유사표시수) {
      줄더하기(어디, '표시', `세트 안에서 서로 닮은 이미지 ${보고서.유사표시수}장`);
    }

    if (어디.children.length === 0) 줄더하기(어디, '고침', '손댈 것이 없었어요');
  }

  function 사람이볼것그리기(보고서) {
    const 어디 = 것('사람목록');
    어디.innerHTML = '';

    if (보고서.유사이름들.length) {
      보고서.유사이름들.forEach((이름) =>
        줄더하기(어디, '표시', `${이름} — 정말 닮았는지 직접 보세요`)
      );
    }

    // 프로그램이 검사하지 않는 것 (7장)
    줄더하기(어디, '볼것', '형태가 어색하거나 글자가 섞인 이미지');
    줄더하기(어디, '볼것', '상표로 보이는 요소 · 실존 인물 · 유명 캐릭터');
    줄더하기(어디, '볼것', '생성형 AI 표시와 권리 확인 여부');

    if (보고서.미리캔버스만이름들 && 보고서.미리캔버스만이름들.length) {
      보고서.미리캔버스만이름들.forEach((이름) =>
        줄더하기(어디, '볼것', `${이름} — 어도비에도 올리려면 대각선 구도로 다시 그리세요`)
      );
    }

    // 점유율은 여기 두지 않는다 (9장 · 5-2장).
    //
    // 크롭 **전** 원본 기준 값이라 폴더의 파일을 열어서는 확인할 수 없다.
    // 크롭이 끝난 파일에서 오브젝트는 이미 99%를 차지한다.
    // 사람이 확인할 수 없는 값을 확인 목록에 두면 판정 항목처럼 읽혀 오해만 생긴다.
    // 다음 세트의 프롬프트를 손볼 때 쓰는 값이라 화면 3으로 옮겼다.
  }

  // ── 시작 ─────────────────────────────────────────

  function 켜기() {
    것('폴더열기').addEventListener('click', async () => {
      const 단추 = 것('폴더열기');
      const 본래 = 단추.textContent;
      단추.disabled = true;
      경로탈보이기('');

      try {
        await 보내기('/api/폴더열기', {
          폴더이름: 상태.보고서 ? 상태.보고서.폴더이름 : '',
        });
        // 성공해도 아무 표시가 없으면 눌렀는지 안 눌렀는지 모른다 (9장)
        단추.textContent = '폴더를 열었어요';
        setTimeout(() => {
          단추.textContent = 본래;
        }, 1600);
      } catch (오류) {
        경로탈보이기('폴더를 열지 못했어요. 아래 경로를 직접 열어 주세요.', 오류.message);
      } finally {
        단추.disabled = false;
      }
    });

    것('경로복사').addEventListener('click', 경로복사하기);
    것('탈경로복사').addEventListener('click', 경로복사하기);

    것('새세트').addEventListener('click', 새세트만들기);
  }

  function 알림보이기(글) {
    것('완료요약').textContent = 글;
  }

  // 탐색기가 안 열려도 붙여넣기로 갈 수 있어야 한다 (9장)
  function 경로복사하기(일) {
    const 경로 = 것('결과경로').textContent;
    if (!경로) return;

    const 단추 = 일.currentTarget;
    const 본래 = 단추.textContent;
    navigator.clipboard.writeText(경로).then(
      () => {
        단추.textContent = '복사했어요';
        setTimeout(() => {
          단추.textContent = 본래;
        }, 1400);
      },
      () =>
        경로탈보이기(
          '경로를 복사하지 못했어요. 위 경로를 직접 끌어서 복사해 주세요.',
          '브라우저가 복사를 막았을 수 있어요.'
        )
    );
  }

  /**
   * @param {string} 말      무엇이 실패했는지. 비우면 숨긴다
   * @param {string} [원문]  까닭
   *
   * 복사 실패와 폴더 열기 실패는 다른 일이다. 같은 문구를 쓰면
   * 복사가 안 됐을 뿐인데 폴더가 안 열렸다고 읽는다
   */
  function 경로탈보이기(말, 원문) {
    const 틀 = 것('경로탈');
    if (!말) {
      틀.hidden = true;
      return;
    }
    것('경로탈말').textContent = 말;
    것('경로탈경로').textContent = 것('결과경로').textContent;
    것('경로탈원문').textContent = 원문 || '';
    틀.hidden = false;
  }

  // 새 세트 만들기 — 화면 1로, 값 초기화 (9장)
  function 새세트만들기() {
    // 지난 세트의 점유율만 남겨 화면 3이 보여준다 (5-2장).
    // 다음 세트의 프롬프트를 손볼지 판단하는 값이라 새로고침을 넘겨야 뜻이 있다
    try {
      if (상태.보고서 && 상태.보고서.점유율) {
        sessionStorage.setItem(
          '지난점유율',
          JSON.stringify({
            ...상태.보고서.점유율,
            세트이름: 상태.보고서.세트이름 || 상태.보고서.폴더이름,
          })
        );
      }
    } catch {
      /* 못 써도 그만이다. 없으면 화면 3이 그 줄을 안 보여준다 */
    }

    상태.만들것 = '';
    상태.세트번호 = '';
    상태.세트이름 = '';
    상태.목록 = [];
    상태.지운것 = [];
    상태.보고서 = null;
    상태.전체복사글 = '';
    상태.파일받기문구 = '';
    // 새로 고쳐서 화면 1부터 다시 — 세트번호도 결과 폴더를 다시 읽어 매긴다
    location.hash = '#/1';
    location.reload();
  }

  async function 보이기() {
    const 보고서 = 상태.보고서;

    것('아직없음').hidden = !!보고서;
    것('완료내용').hidden = !보고서;
    것('폴더열기').disabled = !보고서;

    if (!보고서) {
      것('완료요약').textContent = '아직 만든 세트가 없어요';
      것('결과경로').textContent = '';
      return;
    }

    것('완료요약').textContent = 요약글(보고서);
    것('결과경로').textContent = 보고서.세트폴더;

    처리결과그리기(보고서);
    사람이볼것그리기(보고서);

    try {
      const 답 = await 보내기('/api/결과보기', { 폴더이름: 보고서.폴더이름 });
      트리그리기(답.트리);
      그림그리기(답.이미지들);
    } catch (오류) {
      것('트리').textContent = '폴더를 읽지 못했어요: ' + 오류.message;
    }
  }

  return { 켜기, 보이기 };
})();
