// 화면 3 — 제작 (계획서 6장)
//
// API 연결이 없으므로 이 화면은 항상 대기 모드다. 사람이 ChatGPT에서 받아 온다.
//
// 파일은 놓는 즉시 서버로 보낸다. 브라우저가 ZIP을 풀 수 없기 때문이다
// (2장이 고른 adm-zip은 서버 쪽 라이브러리다).
// 그 뒤 짝짓기 결과를 받아 소재명 ↔ 미리보기를 나란히 보여주고,
// 틀렸으면 사람이 고칠 수 있게 한다 (6장 3·4번).

const 화면3 = (() => {
  const 것 = (아이디) => document.getElementById(아이디);

  let 항목들 = []; // 서버가 매긴 아이템번호 · 파일명 · 프롬프트
  let 받은것 = []; // 서버에 쌓인 파일
  let 짝 = {}; // 아이템번호 → 파일 아이디
  let 방법별 = {}; // 아이템번호 → 짝지은 방법 (파일명 · 순서 · 사람이)
  let 짝짓기경고 = []; // 서버가 무시한 짝의 까닭 · 목록이 바뀌었다는 안내
  let 이전목록서명 = null; // 소재 목록이 바뀌었는지 보는 값 (13-7)

  // 소재 목록이 바뀌면 같은 아이템번호가 다른 소재를 뜻하게 된다.
  // 번호 · 소재 · 형태를 순서까지 살려 한 줄로 만들어 비교한다
  function 목록서명(목록) {
    return JSON.stringify(
      (목록 || []).map((하나, 자리) => [
        자리,
        String(하나.아이템번호 || ''),
        String(하나.소재 || ''),
        String(하나.형태 || ''),
      ])
    );
  }

  // 파일을 나눠 받으면 같은 이름이 두 번 올 수 있다 (6장 7번).
  // 그때 고르는 칸에서 구분이 되게 뒤에 번호를 붙인다
  function 보여줄이름(하나) {
    const 같은이름 = 받은것.filter((다른) => 다른.원래이름 === 하나.원래이름);
    if (같은이름.length < 2) return 하나.원래이름;
    const 몇번째 = 같은이름.findIndex((다른) => 다른.아이디 === 하나.아이디) + 1;
    return `${하나.원래이름}  (${몇번째})`;
  }

  // ── 서버에 묻기 ──────────────────────────────────

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

  function 탈보이기(글) {
    const 탈 = 것('파일탈');
    if (!글) {
      탈.textContent = ''; // 남겨 두면 다음에 열릴 때 옛 문구가 잠깐 보인다
      탈.hidden = true;
      return;
    }
    탈.textContent = 글;
    탈.hidden = false;
  }

  // ── 왼쪽 · 오른쪽 (6장) ─────────────────────────

  function 복사하기(글, 단추) {
    navigator.clipboard.writeText(글).then(
      () => {
        const 본래 = 단추.textContent;
        단추.textContent = '복사했어요';
        setTimeout(() => {
          단추.textContent = 본래;
        }, 1200);
      },
      () => 탈보이기('복사하지 못했어요. 글을 직접 끌어서 복사해 주세요.')
    );
  }

  function 프롬프트그리기() {
    const 어디 = 것('프롬프트줄들');
    어디.innerHTML = '';
    것('프롬프트수').textContent = 항목들.length + '개';

    항목들.forEach((항목, 자리) => {
      const 줄 = document.createElement('div');
      줄.className = '프롬프트줄';

      const 순번 = document.createElement('span');
      순번.className = '순번';
      순번.textContent = String(자리 + 1).padStart(2, '0');

      const 소재 = document.createElement('span');
      소재.className = '소재이름';
      소재.textContent = 항목.소재;

      const 파일 = document.createElement('span');
      파일.className = '파일이름';
      파일.textContent = 항목.파일명;
      파일.title = 항목.파일명;

      const 복사 = document.createElement('button');
      복사.type = 'button';
      복사.className = '단추 작은단추';
      복사.textContent = '복사';
      복사.addEventListener('click', () => 복사하기(항목.프롬프트, 복사));

      줄.append(순번, 소재, 파일, 복사);

      // 소재별 [다시] — 그 소재를 이미 만든 뒤에만 보인다 (F)
      if (모드 === '자동' && 만들기.한것.has(항목.아이템번호)) {
        const 다시 = document.createElement('button');
        다시.type = 'button';
        다시.className = '단추 작은단추';
        다시.textContent = '다시';
        다시.disabled = 만들기.돈다;
        다시.addEventListener('click', async () => {
          만들기.한것.delete(항목.아이템번호);
          만들기.실패한것.delete(항목.아이템번호);
          await 만들기돌리기([항목], false);
        });
        줄.appendChild(다시);
      }

      어디.appendChild(줄);
    });
  }

  // ── 짝지은 결과 (6장 3·4번) ─────────────────────

  function 짝칸만들기(항목) {
    const 아이디 = 짝[항목.아이템번호] || null;
    const 파일 = 받은것.find((하나) => 하나.아이디 === 아이디) || null;

    const 칸 = document.createElement('div');
    칸.className = '짝칸' + (파일 ? '' : ' 빔');

    const 머리 = document.createElement('div');
    머리.className = '짝머리';
    const 번호 = document.createElement('span');
    번호.className = '짝번호';
    번호.textContent = 항목.아이템번호;
    머리.appendChild(번호);

    // 어떻게 지어진 짝인지는 아이템번호에 붙는다. 파일이 아니라 자리의 성질이다
    const 이방법 = 파일 ? 방법별[항목.아이템번호] : null;
    if (이방법) {
      const 방법 = document.createElement('span');
      방법.className = '짝방법 ' + 이방법;
      방법.textContent =
        이방법 === '파일명' ? '이름으로' : 이방법 === '사람이' ? '손으로' : '순서로';
      머리.appendChild(방법);
    }

    const 그림 = document.createElement('div');
    그림.className = '짝그림';
    if (파일) {
      const 이미지 = document.createElement('img');
      이미지.src = '/api/받은그림/' + 파일.아이디;
      이미지.alt = 항목.소재;
      그림.appendChild(이미지);
    } else {
      const 없음 = document.createElement('span');
      없음.className = '없음';
      없음.textContent = '아직 없어요';
      그림.appendChild(없음);
    }

    const 소재 = document.createElement('div');
    소재.className = '짝소재';
    소재.textContent = 항목.소재;
    소재.title = 항목.파일명;

    // 짝이 틀렸을 때 손으로 고친다 (6장 4번)
    const 고르개 = document.createElement('select');
    고르개.className = '짝고르개';

    const 빈것 = document.createElement('option');
    빈것.value = '';
    빈것.textContent = '— 비움 —';
    고르개.appendChild(빈것);

    받은것.forEach((하나) => {
      const 하나칸 = document.createElement('option');
      하나칸.value = 하나.아이디;
      하나칸.textContent = 보여줄이름(하나);
      고르개.appendChild(하나칸);
    });

    고르개.value = 아이디 || '';
    고르개.addEventListener('change', (일) => {
      const 고른것 = 일.target.value;

      // 다른 줄이 이미 쓰고 있으면 거기서 뗀다 — 한 파일이 두 줄에 들어가면 안 된다
      if (고른것) {
        for (const [번호, 값] of Object.entries(짝)) {
          if (값 === 고른것 && 번호 !== 항목.아이템번호) {
            delete 짝[번호];
            delete 방법별[번호];
          }
        }
        짝[항목.아이템번호] = 고른것;
        방법별[항목.아이템번호] = '사람이'; // 손으로 고른 것은 여기서만 붙는다
      } else {
        delete 짝[항목.아이템번호];
        delete 방법별[항목.아이템번호];
      }

      짝그리기();
    });

    칸.append(머리, 그림, 소재, 고르개);
    return 칸;
  }

  // 서버가 검증해 돌려준 전체 짝 목록으로 화면 상태를 갈아 끼운다 (13-1 · 13-5).
  // 기존 방법값이 서버 응답 안에 그대로 들어 있으므로 여기서 지우지 않는다
  function 짝받아넣기(답) {
    짝 = {};
    방법별 = {};
    (답.짝 || []).forEach((하나) => {
      if (!하나.아이디) return;
      짝[하나.아이템번호] = 하나.아이디;
      방법별[하나.아이템번호] = 하나.방법 || null;
    });
    // 남은 파일은 짝에서 거꾸로 세면 늘 맞는다 (사람이 손으로 뗀 것까지 잡힌다).
    //
    // 개수 경고 둘은 화면이 이미 남은 파일 칸과 진행 막대로 보여주고 있다.
    // 여기서는 "이 짝을 왜 풀었는지"만 남긴다
    짝짓기경고 = (답.경고 || []).filter(
      (글) => !글.startsWith('짝을 짓지 못한 파일이') && !글.startsWith('이미지가 없는 소재가')
    );
  }

  function 짝그리기() {
    const 어디 = 것('짝목록');
    어디.innerHTML = '';
    항목들.forEach((항목) => 어디.appendChild(짝칸만들기(항목)));

    // 받은 개수 표시 + 진행 막대 (6장)
    const 지은수 = Object.keys(짝).length;
    것('받은셈').hidden = 받은것.length === 0;
    것('받은수').textContent = 지은수;
    것('바라는수').textContent = 항목들.length;
    것('막대안').style.width =
      항목들.length ? Math.min(100, (지은수 / 항목들.length) * 100) + '%' : '0%';

    것('다시짝짓기').hidden = 받은것.length === 0;
    것('모두버리기').hidden = 받은것.length === 0;

    // 짝을 못 지은 파일 (6장 6번)
    const 쓴것 = new Set(Object.values(짝));
    const 남은것 = 받은것.filter((하나) => !쓴것.has(하나.아이디));
    것('남은파일칸').hidden = 남은것.length === 0;
    const 남은칸 = 것('남은것들');
    남은칸.innerHTML = '';
    남은것.forEach((하나) => {
      const 하나칸 = document.createElement('span');
      하나칸.className = '남은하나';
      하나칸.textContent = 보여줄이름(하나);
      남은칸.appendChild(하나칸);
    });

    // 개수가 목록과 달라도 막지는 않는다 (6장 5번)
    const 알릴것 = [...짝짓기경고];
    if (받은것.length && 지은수 !== 항목들.length) {
      알릴것.push(
        `소재는 ${항목들.length}개인데 짝지은 것은 ${지은수}장이에요. ` +
          '그대로 정리해도 되고, 남은 것을 더 받아도 돼요.'
      );
    }
    탈보이기(알릴것.join('  '));
  }

  // ── 프로그램이 만들기 (12장) ─────────────────────
  //
  // 1단계는 **한 장 시험까지만**이다. 여러 장 만들기 · 진행 막대 · 모드 전환은 다음이다.
  //
  // 만든 그림은 사람이 놓은 파일과 **같은 저장소**로 들어간다. 그래서 여기서 하는 일은
  // 만들고 나서 받은 파일 목록을 다시 읽고 짝을 맞추는 것뿐이다 —
  // 짝짓기 · 검사 · 폴더 코드는 한 줄도 건드리지 않는다.

  let AI정보 = null;

  /**
   * 지난 세트의 오브젝트 점유율을 보여준다 (5-2장 · 9장).
   *
   * 화면 4에 있던 것을 여기로 옮겼다. 그 값은 **크롭 전 원본** 기준이라
   * 결과 폴더의 파일을 열어서는 확인할 수 없다 — 크롭이 끝난 파일에서
   * 오브젝트는 이미 99%를 차지한다. 확인 목록에 두면 판정 항목처럼 읽혔다.
   *
   * 여기는 프롬프트를 보는 자리라, "이번엔 88%로 나왔다"가
   * 다음 세트의 프롬프트를 손볼지 판단하는 데 실제로 쓰인다.
   */
  function 지난점유율그리기() {
    const 칸 = 것('지난점유율');
    let 값 = null;
    try {
      const 글 = sessionStorage.getItem('지난점유율');
      if (글) 값 = JSON.parse(글);
    } catch {
      값 = null;
    }
    // 이번에 막 만든 것이 있으면 그것이 우선이다
    if (상태.보고서 && 상태.보고서.점유율) {
      값 = { ...상태.보고서.점유율, 세트이름: 상태.보고서.세트이름 };
    }

    if (!값 || 값.가장작은것 == null) {
      칸.hidden = true;
      return;
    }

    const 퍼센트 = (숫자) => (숫자 * 100).toFixed(0) + '%';
    const 같나 = 값.가장작은것 === 값.가장큰것;
    const 잰것 = 같나 ? 퍼센트(값.평균) : `${퍼센트(값.가장작은것)} ~ ${퍼센트(값.가장큰것)}`;
    const 낮나 = 값.가장작은것 < 0.75;
    const 높나 = 값.가장큰것 > 0.9;

    칸.hidden = false;
    칸.className = '칸안내 지난점유율' + (낮나 || 높나 ? ' 벗어남' : '');
    칸.textContent =
      `지난 세트(${값.세트이름 || '이전'})의 오브젝트 점유율은 ${잰것}이었어요. 목표는 75~90%예요. ` +
      (낮나
        ? '더 크게 그려 달라고 프롬프트를 손보면 어도비 4MP를 넘기기 쉬워져요.'
        : 높나
          ? '너무 꽉 차면 가장자리에 닿아 잘림으로 제외될 수 있어요.'
          : '이대로 두면 돼요.');
  }

  // ── 모드 (6장 A) ────────────────────────────────
  //
  // 두 칸이 동시에 보이지 않는다. 왼쪽 프롬프트 목록은 두 모드 모두 그대로 둔다 —
  // 무엇을 만드는지 보이는 게 좋다.

  let 모드 = '자동';

  function 모드맞추기() {
    const 만들수있나 = Boolean(AI정보 && AI정보.연결됨);

    것('모드자동').disabled = !만들수있나;
    것('모드자동칸').classList.toggle('막힘', !만들수있나);
    것('모드막힘').hidden = 만들수있나;

    if (!만들수있나 && 모드 === '자동') 모드 = '가져오기';

    것('모드가져오기').checked = 모드 === '가져오기';
    것('모드자동').checked = 모드 === '자동';

    것('문구칸').hidden = 모드 !== '가져오기';
    것('만들기칸').hidden = 모드 !== '자동';

    // 글도 모드를 따라간다. 자동인데 "받아다 주세요"라고 하면 거짓말이 된다 (6장)
    const 자동인가 = 모드 === '자동';
    것('화면3제목').textContent = 자동인가 ? '이미지를 만들어요' : '이미지만 받아다 주세요';
    것('화면3설명').textContent = 자동인가
      ? '소재마다 프롬프트를 조립해 뒀어요. 시작을 누르면 한 장씩 만들어 폴더까지 정리해요.'
      : '프롬프트와 파일받기 문구를 만들어 뒀어요. ChatGPT에 붙여넣어 이미지를 받은 다음, ' +
        '아래에 놓아주시면 나머지는 프로그램이 해요.';
    것('단계3설명').textContent = 자동인가 ? '프로그램이 만듦' : '받아서 놓기';

    if (자동인가) 만들기칸그리기();
    else 프롬프트그리기();
  }

  // ── 프로그램이 만들기 (12장) ─────────────────────
  //
  // 만든 그림은 사람이 놓은 파일과 **같은 저장소**로 들어간다.
  // 여기서 하는 일은 만들고 나서 받은 파일 목록을 다시 읽고 짝을 맞추는 것뿐이다 —
  // 검사 · 짝짓기 · 이름 · 폴더 코드는 한 줄도 건드리지 않는다.

  // 한 세트 동안의 만들기 상태
  const 만들기 = {
    한것: new Map(), // 아이템번호 → {아이디, 쓴것, 실제가로, 실제세로, 투명있나}
    실패한것: new Map(), // 아이템번호 → {말, 원문}
    첫장확인했나: false, // 세트당 한 번만 묻는다 (D)
    멈출까: false,
    돈다: false,
  };

  function 만들기칸그리기() {
    if (!AI정보 || !AI정보.연결됨) return;

    const 안한것 = 아직안한것();
    const 한수 = 만들기.한것.size;

    것('만들기무엇').textContent =
      `${상태.그림체이름} · ${상태.세트이름 || '이름 없음'} · ${항목들.length}개 소재`;
    것('만들기규격').textContent =
      `${AI정보.생성크기.replace('x', '×')} · 투명 PNG · 품질 ${AI정보.이미지품질}`;

    const 시작전 = 한수 === 0 && 만들기.실패한것.size === 0;
    것('만들기시작속').hidden = !시작전 || 만들기.돈다;
    것('만들기끝속').hidden = 시작전 || 만들기.돈다;
    것('만들기진행속').hidden = !만들기.돈다;

    것('모두만들기').textContent = `${항목들.length}장 모두 만들기`;
    것('모두만들기').disabled = 항목들.length === 0;

    if (시작전 || 만들기.돈다) return;

    // 끝난 뒤 (F)
    const 실패수 = 만들기.실패한것.size;
    것('끝글').textContent =
      안한것.length === 0
        ? `${항목들.length}장을 모두 만들었어요.`
        : `${항목들.length}장 중 ${한수}장을 만들었어요.`;

    것('토큰글').textContent = 토큰글();

    것('이어만들기').hidden = 안한것.length === 0;
    것('이어만들기').textContent = `남은 ${안한것.length}장 이어 만들기`;
    것('실패다시').hidden = 실패수 === 0;
    것('실패다시').textContent = `실패한 ${실패수}장 다시 만들기`;
    // 다시 만들기는 만든 게 있을 때만 보인다 (F)
    것('다시만들기').hidden = 한수 === 0;

    // 소재별 [다시] 는 만든 뒤에만 붙는다. 목록을 다시 그려야 나타난다
    프롬프트그리기();
    것('만들기중단').disabled = false;
    것('만들기중단').textContent = '중단';
  }

  /** 아직 안 만든 소재 (실패한 것 포함) */
  function 아직안한것() {
    return 항목들.filter((하나) => !만들기.한것.has(하나.아이템번호));
  }

  // 실제로 온 usage만 모은다. 안 왔으면 빈 목록이다 — 추정으로 채우지 않는다 (J)
  function 받은사용량() {
    return [...만들기.한것.values()].map((하나) => 하나.쓴것).filter(Boolean);
  }

  function 출력토큰합(사용량들) {
    return 사용량들.reduce(
      (모음, 하나) => 모음 + (하나.output_tokens || 하나.output_tokens_details?.image_tokens || 0),
      0
    );
  }

  /**
   * 실제로 온 사용량만 적는다 (J).
   * usage가 없으면 추정으로 채우지 않는다 — 없다고 말한다.
   */
  function 토큰글() {
    const 쓴것들 = 받은사용량();
    if (쓴것들.length === 0) return '이번 응답에는 사용량 정보가 오지 않았어요.';

    const 합 = 출력토큰합(쓴것들);
    if (!합) return '이번 응답에는 사용량 정보가 오지 않았어요.';

    const 단가 = (AI정보 && AI정보.이미지출력단가달러백만토큰) || 0;
    const 달러 = (합 / 1_000_000) * 단가;
    return (
      `${쓴것들.length}장 합계 출력 ${합.toLocaleString()}토큰 · ` +
      `${AI정보.이미지모델} 출력 단가 $${단가} / 1M 토큰 기준 약 ${달러.toFixed(2)}달러`
    );
  }

  function 만들기탈보이기(말, 원문, 덧붙임) {
    const 틀 = 것('만들기탈');
    if (!말) {
      틀.hidden = true;
      return;
    }
    것('만들기탈말').textContent = 말;
    것('만들기탈원문').textContent = 원문 || '';
    것('만들기탈원문').hidden = !원문;
    것('만들기탈덧붙임').textContent = 덧붙임 || '';
    틀.hidden = false;
  }

  // 서버가 SSE로 한 장씩 알려 준다. 한 줄씩 읽어 갈래별로 처리한다
  async function 만들기흘려받기(보낼항목들, 손님) {
    const 답 = await fetch('/api/이미지생성', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 항목들: 보낼항목들 }),
    });

    if (!답.ok) {
      const 값 = await 답.json().catch(() => ({}));
      throw new Error(값.오류 || '이미지를 만들지 못했어요.');
    }

    const 읽개 = 답.body.getReader();
    const 풀개 = new TextDecoder();
    let 남은글 = '';

    for (;;) {
      const { done, value } = await 읽개.read();
      if (done) break;
      남은글 += 풀개.decode(value, { stream: true });

      const 덩이들 = 남은글.split('\n\n');
      남은글 = 덩이들.pop();

      for (const 덩이 of 덩이들) {
        const 갈래줄 = 덩이.split('\n').find((줄) => 줄.startsWith('event: '));
        const 값줄 = 덩이.split('\n').find((줄) => 줄.startsWith('data: '));
        if (!갈래줄 || !값줄) continue;
        손님(갈래줄.slice(7).trim(), JSON.parse(값줄.slice(6)));
      }
    }
  }

  // ── 진행 줄 (E) ─────────────────────────────────

  // 남은 시간은 적지 않는다. 장당 시간을 재 둔 값이 없다 — 대신 실제로 온 토큰을 쌓아 보인다
  function 진행그리기(지금자리, 지금소재) {
    const 누적 = 출력토큰합(받은사용량());
    것('진행글').textContent =
      `${만들기.한것.size + 만들기.실패한것.size} / ${항목들.length}` +
      (지금소재 ? `  ·  ${지금소재} 만드는 중` : '') +
      (누적 ? `  ·  출력 ${누적.toLocaleString()}토큰 누적` : '');

    const 끝난수 = 만들기.한것.size + 만들기.실패한것.size;
    것('만들기막대').style.width =
      항목들.length ? Math.min(100, (끝난수 / 항목들.length) * 100) + '%' : '0%';

    const 목록 = 것('만든목록');
    목록.innerHTML = '';
    항목들.forEach((항목, 자리) => {
      const 줄 = document.createElement('li');
      const 된것 = 만들기.한것.get(항목.아이템번호);
      const 실패 = 만들기.실패한것.get(항목.아이템번호);

      let 표 = '';
      let 갈래 = '';
      if (된것) {
        갈래 = '됨';
        const 토큰 = 된것.쓴것 && 된것.쓴것.output_tokens;
        표 = '✓' + (토큰 ? ` ${토큰.toLocaleString()}토큰` : '');
      } else if (실패) {
        갈래 = '실패';
        표 = '✗ ' + 실패.말;
      } else if (자리 === 지금자리) {
        갈래 = '지금';
        표 = '…';
      } else {
        갈래 = '대기';
        표 = '';
      }

      줄.className = '만든줄 ' + 갈래;
      줄.innerHTML =
        `<span class="만든번호">${자리 + 1}</span>` +
        `<span class="만든소재"></span>` +
        `<span class="만든표">${표}</span>`;
      줄.querySelector('.만든소재').textContent = 항목.소재;
      목록.appendChild(줄);
    });
  }

  /**
   * 소재들을 순서대로 만든다 (C · E · H).
   *
   * @param {Array} 만들것들
   * @param {boolean} 첫장에서멈출까  D의 확인을 받을지. 세트당 한 번만 true
   */
  async function 만들기돌리기(만들것들, 첫장에서멈출까) {
    if (만들기.돈다 || 만들것들.length === 0) return;

    만들기.돈다 = true;
    만들기.멈출까 = false;
    만들기탈보이기('');
    것('정리시작').disabled = true;
    만들기칸그리기();
    진행그리기(0, 만들것들[0].소재);

    let 첫장 = null;
    let 새아이디들 = [];

    try {
      await 만들기흘려받기(만들것들, (갈래, 값) => {
        if (갈래 === '만드는중') {
          진행그리기(항목들.findIndex((하나) => 하나.아이템번호 === 값.아이템번호), 값.소재);
        } else if (갈래 === '됨') {
          만들기.한것.set(값.아이템번호, 값);
          새아이디들.push(값.아이디);
          if (!첫장) 첫장 = 값;
          진행그리기(-1, '');
        } else if (갈래 === '실패') {
          만들기.실패한것.set(값.아이템번호, 값);
          진행그리기(-1, '');
        } else if (갈래 === '멈춤' && 값.더못감) {
          만들기탈보이기(값.까닭, '', '계속 시도해도 결과 없이 돈만 나가서 여기서 멈췄어요.');
        }
      });
    } catch (오류) {
      만들기탈보이기(오류.message, '', '');
    }

    만들기.돈다 = false;
    것('정리시작').disabled = false;

    // 저장소에 들어갔으니 목록을 다시 읽고 짝을 맞춘다 (0장 설계 원칙).
    // 파일 이름에 아이템번호가 박혀 있어 짝짓기가 번호로 바로 맞춘다 (6장).
    //
    // 여기서 터져도 만들기는 이미 끝났고 그림은 저장소에 들어가 있다.
    // 짝짓기가 실패했다고 첫 장 확인까지 못 보게 두지 않는다 (D)
    if (새아이디들.length) {
      try {
        const 답 = await fetch('/api/받은파일').then((하나) => 하나.json());
        받은것 = 답.모두;
        await 추가파일짝짓기(새아이디들);
      } catch (오류) {
        탈보이기('만든 그림의 짝을 맞추지 못했어요: ' + 오류.message);
      }
    }

    // 첫 장 확인 — 세트에 한 번뿐이다 (D)
    if (첫장에서멈출까 && 첫장 && !만들기.첫장확인했나) {
      만들기.첫장확인했나 = true;
      첫장보이기(첫장);
      return;
    }

    만들기칸그리기();
  }

  /** 첫 장을 크게 보여주고 실제로 받은 값을 적는다 (D) */
  function 첫장보이기(첫장) {
    것('만들기시작속').hidden = true;
    것('만들기진행속').hidden = true;
    것('만들기끝속').hidden = true;
    것('첫장속').hidden = false;

    것('첫장그림').src = '/api/받은그림/' + 첫장.아이디;

    const 조각 = [];
    조각.push(
      첫장.실제가로
        ? `받은 크기 ${첫장.실제가로}×${첫장.실제세로}`
        : '받은 크기를 읽지 못했어요'
    );
    조각.push(
      첫장.투명있나 === true
        ? '투명 배경 있음'
        : 첫장.투명있나 === false
          ? '투명 배경 없음 — 확인이 필요해요'
          : '투명 여부를 읽지 못했어요'
    );
    const 토큰 = 첫장.쓴것 && 첫장.쓴것.output_tokens;
    if (토큰) 조각.push(`출력 ${토큰.toLocaleString()}토큰`);

    것('첫장잰값').textContent = 조각.join(' · ');
  }

  async function 모두만들기누름() {
    const 할것 = 아직안한것();
    if (할것.length === 0) return;

    // 확인창 없이 바로 시작한다. 확인은 첫 장이 나온 뒤 딱 한 번 (C · D).
    //
    // **첫 요청에는 한 장만 보낸다.** 서버는 받은 만큼을 끝까지 만들기 때문에,
    // 전부 보내 놓고 나중에 멈추면 이미 다 만든 뒤가 된다 — 돈이 다 나가고
    // 크기가 틀렸어도 되돌릴 수 없다. 확인은 한 장 값으로 끝나야 한다.
    if (!만들기.첫장확인했나) {
      await 만들기돌리기([할것[0]], true);
      return;
    }
    await 만들기돌리기(할것, false);
  }

  async function 첫장이어누름() {
    것('첫장속').hidden = true;
    await 만들기돌리기(아직안한것(), false);
  }

  function 첫장멈춤누름() {
    것('첫장속').hidden = true;
    만들기칸그리기();
  }

  async function 다시만들기누름() {
    const 좋다 = window.confirm(
      `이미 만든 ${만들기.한것.size}장은 그대로 두고 새로 ${항목들.length}장을 만들어요. 계속할까요?`
    );
    if (!좋다) return;

    // 세트 폴더가 이미 있으면 다음 번호를 받는다 (G).
    // **덮어쓰지 않는다** — 승인 대기 중인 파일이 지워지면 안 된다
    await 세트번호비켜주기();

    만들기.한것.clear();
    만들기.실패한것.clear();
    await 만들기돌리기(항목들, false);
  }

  /**
   * 지금 세트 번호로 이미 폴더가 만들어져 있으면 다음 번호로 물러난다 (G).
   *
   * 화면 4까지 갔다가 돌아와 다시 만들 때 생기는 일이다.
   * 기존 폴더를 지우거나 덮어쓰지 않는다.
   */
  async function 세트번호비켜주기() {
    try {
      const 확인 = await fetch(
        `/api/세트번호확인?세트번호=${encodeURIComponent(상태.세트번호)}` +
          `&제출유형=${encodeURIComponent(상태.제출유형)}`
      ).then((하나) => 하나.json());

      if (확인.쓸수있나) return;

      const 새것 = await fetch(
        `/api/세트번호?제출유형=${encodeURIComponent(상태.제출유형)}`
      ).then((하나) => 하나.json());

      const 옛것 = 상태.세트번호;
      상태.세트번호 = 새것.세트번호;
      탈보이기(
        `${옛것} 폴더가 이미 있어서 ${새것.세트번호}로 새로 만들어요. ` +
          '먼저 만든 것은 그대로 둡니다.'
      );

      // 아이템번호가 바뀌므로 프롬프트와 파일명을 다시 받아야 한다
      await 보이기();
    } catch {
      /* 못 물어보면 서버가 폴더 겹침을 막아 준다 */
    }
  }

  async function 실패다시누름() {
    const 다시할것 = 항목들.filter((하나) => 만들기.실패한것.has(하나.아이템번호));
    만들기.실패한것.clear();
    await 만들기돌리기(다시할것, false);
  }

  async function 중단누름() {
    // 안 도는데 누르면 문구가 그대로 굳는다. 되돌려 줄 사람이 없기 때문이다
    if (!만들기.돈다) return;

    // 지금 만들고 있는 한 장이 끝난 뒤에 멈춘다. 요금은 이미 나갔으니 받아서 저장한다
    것('만들기중단').disabled = true;
    것('만들기중단').textContent = '이 장이 끝나면 멈춰요…';
    try {
      await 보내기('/api/이미지중단', {});
    } catch {
      /* 못 보내도 서버가 알아서 끝난다 */
    }
  }

  // ── 파일 받기 (6장) ────────────────────────────

  /**
   * 추가 모드 — 이번에 새로 받은 파일만 빈 자리에 넣는다 (13-2 · 13-4).
   *
   * 첫 업로드에서 지어진 짝도, 사람이 손으로 고친 짝도 그대로 간다.
   * 그래서 기존 짝을 방법값까지 실어 보낸다.
   */
  async function 추가파일짝짓기(새아이디들) {
    const 답 = await 보내기('/api/짝짓기', {
      모드: '추가',
      아이템번호들: 항목들.map((하나) => 하나.아이템번호),
      기존짝: Object.entries(짝).map(([아이템번호, 아이디]) => ({
        아이템번호,
        아이디,
        방법: 방법별[아이템번호] || '사람이',
      })),
      배정할파일아이디들: 새아이디들 || [],
    });

    짝받아넣기(답);
    짝그리기();
  }

  /**
   * 전체 모드 — 처음부터 다시 배정한다 (13-6).
   *
   * 사람이 `짝 다시 맞추기`를 눌렀을 때와 소재 목록이 바뀌었을 때만 부른다.
   * 손으로 고친 짝도 풀린다.
   */
  async function 전체다시짝짓기() {
    const 답 = await 보내기('/api/짝짓기', {
      모드: '전체',
      아이템번호들: 항목들.map((하나) => 하나.아이템번호),
    });

    짝받아넣기(답);
    짝그리기();
  }

  async function 파일보내기(파일들) {
    if (!파일들 || 파일들.length === 0) return;

    const 자리 = 것('놓는자리');
    자리.classList.add('보내는중');
    탈보이기('');

    try {
      const 꾸러미 = new FormData();
      for (const 하나 of 파일들) 꾸러미.append('파일', 하나, 하나.name);

      const 답 = await fetch('/api/파일받기', { method: 'POST', body: 꾸러미 });
      const 값 = await 답.json();
      if (!답.ok) throw new Error(값.오류 || '파일을 받지 못했어요.');

      // 이번 업로드에서 새로 저장된 것만 배정 대상이다.
      // ZIP이면 안에서 나온 이미지 전부가 여기 들어 있다
      const 새아이디들 = (값.담은것 || []).map((하나) => 하나.아이디);

      받은것 = 값.모두;
      await 추가파일짝짓기(새아이디들);

      if (값.넘긴것.length) {
        탈보이기('넘어간 것: ' + 값.넘긴것.join(' · '));
      }
    } catch (오류) {
      탈보이기(오류.message);
    } finally {
      자리.classList.remove('보내는중');
    }
  }

  // 화면 3이 들고 있던 것을 모두 비운다 (13-8).
  // 세트 입력값과 그림체는 상태에 있고 여기서 건드리지 않는다
  async function 상태비우기() {
    받은것 = []; // 남은 파일 표시는 이 둘에서 거꾸로 세므로 같이 비워진다
    짝 = {};
    방법별 = {};
    짝짓기경고 = [];
    이전목록서명 = null;

    // 만들기도 세트 단위다 (12장 D). 여기서 비우지 않으면 다음 세트가
    // 첫 장 확인을 건너뛰고 곧장 전부 만든다 — 크기가 틀려도 되돌릴 수 없다.
    // 지난 세트의 한것이 남아 있으면 새 세트인데 끝난 화면부터 보이기도 한다
    만들기.한것.clear();
    만들기.실패한것.clear();
    만들기.첫장확인했나 = false;
    것('첫장속').hidden = true;

    // 한도는 서버가 센다. 지난 세트의 부른수가 남아 있으면
    // 두 번째 세트는 시작하자마자 429로 막힌다 (한도 9 · 소재 6)
    try {
      await 보내기('/api/이미지생성초기화', {});
    } catch {
      /* 못 비워도 서버가 한도로 막아 주니 여기서 멈추지 않는다 */
    }
  }

  async function 모두버리기() {
    await 보내기('/api/파일비우기', {});
    await 상태비우기();
    짝그리기();
  }

  // ── 정리 시작 — 여기서 폴더가 만들어진다 ─────────

  async function 정리시작() {
    const 단추 = 것('정리시작');
    단추.disabled = true;
    단추.textContent = '정리하는 중이에요...';
    탈보이기('');

    try {
      const 답 = await 보내기('/api/세트만들기', {
        입력: 상태.만들것,
        세트번호: 상태.세트번호,
        세트이름: 상태.세트이름,
        제출유형: 상태.제출유형,
        그림체이름: 상태.그림체이름,
        목록: 상태.목록,
        짝,
      });

      상태.보고서 = 답.보고서;
      // 세트를 만들었으니 서버도 받은 파일을 비웠다. 화면 상태도 같이 비운다
      await 상태비우기();
      location.hash = '#/4';
    } catch (오류) {
      탈보이기(오류.message);
    } finally {
      단추.disabled = false;
      단추.textContent = '받았어요 · 정리 시작';
    }
  }

  // ── 시작 ─────────────────────────────────────────

  function 켜기() {
    const 자리 = 것('놓는자리');
    const 고르기 = 것('파일고르기');

    자리.addEventListener('click', () => 고르기.click());
    고르기.addEventListener('change', async (일) => {
      await 파일보내기([...일.target.files]);
      일.target.value = '';
    });

    ['dragenter', 'dragover'].forEach((이름) => {
      자리.addEventListener(이름, (일) => {
        일.preventDefault();
        자리.classList.add('끌고옴');
      });
    });
    ['dragleave', 'drop'].forEach((이름) => {
      자리.addEventListener(이름, (일) => {
        일.preventDefault();
        자리.classList.remove('끌고옴');
      });
    });
    자리.addEventListener('drop', (일) => 파일보내기([...일.dataTransfer.files]));

    것('전체복사').addEventListener('click', (일) => 복사하기(상태.전체복사글 || '', 일.target));
    것('문구복사').addEventListener('click', (일) => 복사하기(상태.파일받기문구 || '', 일.target));
    // 전체 재짝짓기는 이 단추를 눌렀을 때만 돈다. 파일 추가 때는 부르지 않는다 (13-6)
    것('다시짝짓기').addEventListener('click', async () => {
      try {
        await 전체다시짝짓기();
      } catch (오류) {
        탈보이기(오류.message);
      }
    });
    것('모두버리기').addEventListener('click', 모두버리기);
    것('정리시작').addEventListener('click', 정리시작);

    // 모드 (A)
    [것('모드가져오기'), 것('모드자동')].forEach((칸) =>
      칸.addEventListener('change', (일) => {
        모드 = 일.target.value;
        모드맞추기();
      })
    );

    // async 리스너가 터지면 브라우저 콘솔에만 남고 화면은 그대로 굳는다.
    // 만들기는 돈이 나가는 자리라 까닭이 반드시 사람 눈에 보여야 한다
    const 눌림 = (일함) => () =>
      Promise.resolve(일함()).catch((오류) => 만들기탈보이기(오류.message, '', ''));

    것('모두만들기').addEventListener('click', 눌림(모두만들기누름));
    것('첫장이어').addEventListener('click', 눌림(첫장이어누름));
    것('첫장멈춤').addEventListener('click', 첫장멈춤누름);
    것('이어만들기').addEventListener('click', 눌림(() => 만들기돌리기(아직안한것(), false)));
    것('실패다시').addEventListener('click', 눌림(실패다시누름));
    것('다시만들기').addEventListener('click', 눌림(다시만들기누름));
    것('만들기중단').addEventListener('click', 눌림(중단누름));
  }

  // 화면 3으로 넘어올 때마다 — 화면 1·2에서 값이 바뀌었을 수 있다
  async function 보이기() {
    try {
      const 답 = await 보내기('/api/제작준비', {
        세트번호: 상태.세트번호,
        제출유형: 상태.제출유형,
        그림체이름: 상태.그림체이름,
        목록: 상태.목록,
      });

      항목들 = 답.항목들;
      상태.전체복사글 = 답.전체복사글;
      상태.파일받기문구 = 답.파일받기문구;

      // 실제 연결 여부를 서버에 묻는다. 화면 2와 같은 방식이다 (10장)
      try {
        AI정보 = await fetch('/api/AI상태').then((하나) => 하나.json());
      } catch {
        AI정보 = null;
      }
      모드맞추기();
      지난점유율그리기();

      프롬프트그리기();
      것('파일받기문구').textContent = 답.파일받기문구;

      // 소재 목록이 바뀌었나 (13-7).
      // 같은 아이템번호가 다른 소재를 가리키게 되므로 기존 짝을 그대로 둘 수 없다
      const 지금서명 = 목록서명(항목들);
      const 바뀌었나 = 이전목록서명 !== null && 이전목록서명 !== 지금서명;
      이전목록서명 = 지금서명;

      if (바뀌었나 && 받은것.length) {
        await 전체다시짝짓기();
        // 파일은 지우지 않는다. 재배정되지 않은 것은 남은 파일로 남는다
        짝짓기경고 = ['소재 목록이 바뀌어 이미지 짝을 다시 맞췄어요.', ...짝짓기경고];
        짝그리기();
        return;
      }

      짝그리기();
    } catch (오류) {
      탈보이기(오류.message);
    }
  }

  return { 켜기, 보이기 };
})();
