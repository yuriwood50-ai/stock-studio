// OpenAI 연결 (계획서 10장 · 12장)
//
// **열쇠는 이 파일에도 없다.** process.env.OPENAI_API_KEY로만 읽는다.
// 설정.json · web/ 폴더 · localStorage 어디에도 넣지 않는다.
// 브라우저는 OpenAI를 직접 부르지 않는다. 서버만 부른다.
//
// 이번 범위에서 붙이는 것은 **소재 목록 생성(글자 모델)** 하나다.
// 이미지 생성(gpt-image-2)은 조직 신원 확인이 필요하고 장당 비용이 붙어
// 다음 순서로 미뤘다 (12장).

const 목록주소 = 'https://api.openai.com/v1/chat/completions';
const 이미지주소 = 'https://api.openai.com/v1/images/generations';

function 열쇠() {
  const 값 = process.env.OPENAI_API_KEY;
  return 값 && 값.trim() ? 값.trim() : null;
}

function 열쇠있나() {
  return Boolean(열쇠());
}

/** 모델이 코드블록으로 감싸 줘도 알아듣는다 */
function 글에서JSON뽑기(글) {
  const 벗김 = String(글 || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  return JSON.parse(벗김);
}

/**
 * 소재 목록을 뽑는다 (4장).
 *
 * @param {object} 물음
 *   입력      화면 1의 "만들고 싶은 것" 한 줄
 *   그림체    {이름, 종류, 스타일}
 *   개수      뽑을 장수
 *   뺄것      사람이 지운 소재 이름들 — 다시 추천하지 않는다
 *   모델      설정.AI.목록모델
 * @returns {Promise<{목록: Array<{소재, 형태}>}>}
 */
async function 소재목록뽑기(물음) {
  const 키 = 열쇠();
  if (!키) {
    const 탈 = new Error(
      'AI 연결이 안 돼 있어요. 실행.bat 옆에 .env 파일을 만들고 ' +
        'OPENAI_API_KEY=... 를 적은 뒤 프로그램을 다시 켜 주세요.'
    );
    탈.연결안됨 = true;
    throw 탈;
  }

  const 개수 = 물음.개수;
  const 그림체 = 물음.그림체 || {};
  const 뺄것 = (물음.뺄것 || []).filter(Boolean);

  // 규칙의 **순서와 강조가 결과를 바꾼다.** 주제 규칙을 맨 앞에 두고 그것만 강조한다.
  //
  // 실제로 겪은 일 — 앞 판은 주제를 지키라는 규칙이 아예 없었고,
  // "겹치지 않게 한다"에만 별표가 붙어 있었다. "아이콘형 사무용품"으로 12개를
  // 뽑았더니 사과 · 찻주전자 · 나무의자 · 종이비행기 · 니트목도리 · 유리병 ·
  // 양초 · 돌맹이 · 가죽책 · 점토화분 · 황동스푼이 나왔다. 사무용품은 연필 하나뿐.
  //
  // 사무용품 열둘로는 재질을 열두 갈래로 벌리기 어렵다. 다 비슷한 문구류다.
  // 그래서 모델이 강조된 규칙을 지키려고 주제를 벗어나 과일 왁스 · 울 · 점토 ·
  // 가죽 · 황동으로 재질을 벌렸다. **"겹치지 마라"가 "주제를 지켜라"를 이겼다.**
  // 모델 탓이 아니라 지시문 탓이다.
  const 안내 = [
    '너는 스톡 이미지 세트의 소재 목록을 짜는 사람이다.',
    '한 세트는 같은 그림체로 그린 낱장 오브젝트 여러 개이고, 낱장끼리 서로 닮으면 안 된다.',
    '',
    '규칙',
    '- **모든 소재는 사용자가 적은 "만들고 싶은 것"의 범위 안에 있어야 한다. 이 규칙이 다른 모든 규칙보다 앞선다.**',
    '- 범위를 벗어나면서까지 다양하게 만들지 않는다. 주제 안에서 다양하게 만들 수 없으면 비슷한 것을 내는 편이 낫다.',
    `- 정확히 ${개수}개를 낸다.`,
    // 소재명은 파일명과 프롬프트 Subject 줄에 그대로 들어간다 (5장 · 8장).
    // reasoning_effort를 minimal로 내린 뒤 "자(30cm 자 축약형 아이콘)"처럼
    // 괄호 부연이 잦아져서 막는다
    '- 소재는 한국어 낱말 하나로 짧게 적는다. 괄호로 부연하지 않는다. 사람·얼굴·손·글자·상표는 넣지 않는다.',
    '- 덧붙일 말은 전부 형태 칸에 적는다. 소재 칸에는 이름만 적는다.',
    // 형태는 프롬프트 3줄(Form:)에 그대로 들어간다. 그림체 · 품질 · 금지 줄이 전부 영어라
    // 형태도 영어로 받는다. 소재는 파일명이 되므로 한국어 그대로다 (5장 · 8장).
    //
    // 품질 형용사를 막는 이유 — "simple · minimal"은 그림을 아이콘으로 당기고,
    // 반대로 "detailed"만 적으면 무엇을 그릴지는 여전히 비어 있다 (0장 개정표)
    '- 형태는 영어로 적는다. 프롬프트에 그대로 들어가는 자리다.',
    '- 형태에는 시점(viewpoint) · 비례(proportion) · 재질(material) · 표면(surface) · 고유 특징(distinctive features) 중 필요한 것만 적는다. 다섯 개를 다 채우지 않아도 된다.',
    '- 형태에는 부품 이름과 그것이 어떻게 붙어 있는지를 적는다. 이음매 · 잠금 · 손잡이 · 마감 · 두께처럼 실제로 만져지는 것.',
    '- 형태에 simple, minimal, clean, cute, pretty 같은 품질 형용사는 쓰지 않는다. 많이 그리라는 뜻도 적게 그리라는 뜻도 아니다. 무엇을 그릴지만 적는다.',
    `- 소재끼리 시점 · 재질 · 형태 · 색감이 겹치지 않게 한다. ${개수}개가 모두 정면 시점이거나 모두 같은 재질이면 안 된다. 단 주제 범위 안에서.`,
    '- 가늘고 긴 소재(연필 · 붓 · 리본 같은 것)는 형태에 "대각선 구도"라고 적어도 된다. 가로로 눕히면 세로가 너무 얇아져 어도비스톡 4MP 하한에 못 미치는데, 대각선으로 놓으면 넉넉해진다.',
    '- 오브젝트 하나만 그리는 소재로 고른다. 여러 개가 흩어진 장면은 넣지 않는다.',
    '',
    '예: 주제가 "사무용품"이면 스테이플러 · 클립통 · 연필꽂이 · 자 · 테이프디스펜서처럼',
    '전부 사무용품이어야 한다. 사과나 목도리는 주제 밖이므로 넣지 않는다.',
    '',
    '형태 예: {"소재":"달걀","형태":"natural asymmetrical oval seen slightly from the side, warm ivory shell, faint beige speckles, subtle surface variation, softly rounded volume"}',
    '',
    '답은 아래 모양의 JSON 하나만 낸다. 다른 말은 붙이지 않는다.',
    '{"목록":[{"소재":"...","형태":"..."}]}',
  ].join('\n');

  // 주제를 한 줄로 흘려 적으면 규칙에 밀린다. 눈에 띄게 세워 둔다
  const 물음글 = [
    '=== 이번 세트의 주제 (반드시 이 범위 안에서만) ===',
    물음.입력 || '(안 적음)',
    '',
    `그림체: ${그림체.이름 || ''} — ${그림체.스타일 || ''}`,
    뺄것.length ? `\n이미 뺀 소재라 다시 넣지 말 것: ${뺄것.join(' · ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  let 답;
  try {
    답 = await fetch(목록주소, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${키}`,
      },
      body: JSON.stringify({
        model: 물음.모델,
        messages: [
          { role: 'system', content: 안내 },
          { role: 'user', content: 물음글 },
        ],
        response_format: { type: 'json_object' },
        // 안 보내면 모델 기본값(대개 medium)으로 돈다. 소재 목록 짜기는
        // 깊이 생각할 일이 아니라 형식만 맞추면 되는 작업이라 minimal로 충분하다.
        // 값: none · minimal · low · medium · high · xhigh · max
        reasoning_effort: 'minimal',
      }),
    });
  } catch (오류) {
    throw new Error(`OpenAI에 닿지 못했어요: ${오류.message}`);
  }

  const 몸 = await 답.text();

  if (!답.ok) {
    // 모델 이름이 틀렸거나 열쇠가 막혔을 때. OpenAI가 준 문구를 그대로 보여준다 —
    // 모델 이름은 미확인 값이라 여기서 알아채고 설정.json에서 고치게 한다
    let 문구 = 몸.slice(0, 400);
    try {
      const 풀이 = JSON.parse(몸);
      if (풀이.error && 풀이.error.message) 문구 = 풀이.error.message;
    } catch {
      /* 그대로 보여준다 */
    }
    throw new Error(`OpenAI가 거절했어요 (${답.status}): ${문구}`);
  }

  let 글;
  try {
    const 풀이 = JSON.parse(몸);
    글 = 풀이.choices && 풀이.choices[0] && 풀이.choices[0].message.content;
  } catch {
    throw new Error('OpenAI 응답을 읽지 못했어요.');
  }
  if (!글) throw new Error('OpenAI가 빈 답을 줬어요.');

  let 값;
  try {
    값 = 글에서JSON뽑기(글);
  } catch {
    throw new Error('OpenAI가 준 답이 JSON이 아니에요: ' + String(글).slice(0, 200));
  }

  const 날것 = Array.isArray(값) ? 값 : 값.목록;
  if (!Array.isArray(날것)) throw new Error('OpenAI가 준 답에 목록이 없어요.');

  // 뺀 소재가 그래도 섞여 오면 여기서 한 번 더 거른다
  const 뺄이름 = new Set(뺄것.map((하나) => String(하나).trim()));

  const 목록 = 날것
    .map((하나) => ({
      소재: String((하나 && 하나.소재) || '').trim(),
      형태: String((하나 && 하나.형태) || '').trim(),
    }))
    .filter((하나) => 하나.소재 && !뺄이름.has(하나.소재))
    .slice(0, 개수);

  if (목록.length === 0) throw new Error('쓸 만한 소재가 하나도 안 왔어요. 다시 눌러 보세요.');

  return { 목록 };
}

// ── 이미지 생성 (12장) ─────────────────────────────
//
// 만든 그림은 **사람이 가져온 것과 같은 저장소**에 들어간다 (받은파일.담기).
// 그래야 짝짓기 · 검사 · 폴더가 어느 쪽인지 모른 채 똑같이 돈다 (6장 · 7장 · 8장).

/**
 * 크기를 거부당했나 — 이 오류만 따로 알아본다 (5-2장)
 *
 * OpenAI는 크기 오류를 두 가지 모양으로 준다.
 *   1. 낱말로   "The size parameter is not supported"
 *   2. 값으로   "Invalid value: '2880x2880'. Supported values are: '1024x1024'"
 *
 * 2번에는 size · dimension 같은 낱말이 아예 없다. 낱말만 보면 놓치고,
 * 놓치면 크기 안내 대신 일반 오류가 떠서 사람이 무엇이 문제인지 모른다.
 * 그래서 **가로x세로 꼴의 값**과 `supported values`도 함께 본다.
 */
function 크기거부인가(문구) {
  const 글 = String(문구 || '').toLowerCase();
  if (글.includes('size') || 글.includes('dimension') || 글.includes('resolution')) return true;
  if (글.includes('supported values')) return true;
  // 크기 값이 그대로 박힌 문구인가 (예: 가로x세로 꼴이 들어 있는 경우)
  return /\d{3,5}\s*[x×]\s*\d{3,5}/.test(글);
}

/**
 * 그림 한 장을 만든다.
 *
 * 보내는 값은 여섯 개뿐이다.
 *   n              공식 파라미터 목록에 없어 안 보낸다
 *   response_format gpt-image 계열은 기본이 b64_json 이라 필요 없다
 *
 * @param {object} 물음
 *   프롬프트  조립된 여섯 줄 그대로 (5장)
 *   크기      `가로x세로` 문자열. **설정 고정값에서 만들어 넘긴다** (설정.생성크기글).
 *             여기서 만들지 않는다 — 생성 크기를 바꾸면 따라와야 하기 때문이다
 *   품질      설정.AI.이미지품질
 *   모델      설정.AI.이미지모델
 * @returns {Promise<{버퍼: Buffer, 쓴것: object|null, 받은크기: string}>}
 */
async function 이미지뽑기(물음) {
  const 키 = 열쇠();
  if (!키) {
    const 탈 = new Error(
      'AI 연결이 안 돼 있어요. 실행.bat 옆에 .env 파일을 만들고 ' +
        'OPENAI_API_KEY=... 를 적은 뒤 프로그램을 다시 켜 주세요.'
    );
    탈.연결안됨 = true;
    throw 탈;
  }

  if (!물음.크기) throw new Error('만들 크기를 받지 못했어요. 설정의 생성 크기를 확인해 주세요.');

  let 답;
  try {
    답 = await fetch(이미지주소, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${키}`,
      },
      body: JSON.stringify({
        model: 물음.모델,
        prompt: 물음.프롬프트,
        size: 물음.크기,
        background: 'transparent',
        output_format: 'png',
        quality: 물음.품질,
      }),
    });
  } catch (오류) {
    throw new Error(`OpenAI에 닿지 못했어요: ${오류.message}`);
  }

  const 몸 = await 답.text();

  if (!답.ok) {
    let 문구 = 몸.slice(0, 600);
    let 코드 = '';
    try {
      const 풀이 = JSON.parse(몸);
      if (풀이.error) {
        문구 = 풀이.error.message || 문구;
        코드 = 풀이.error.code || 풀이.error.type || '';
      }
    } catch {
      /* 원문 그대로 보여준다 */
    }

    const 탈 = new Error(문구);
    탈.상태 = 답.status;
    탈.코드 = 코드;
    탈.원문 = 문구;

    // **크기를 못 받아주면 여기서 멈춘다.** 작은 크기로 몰래 떨어뜨리지 않는다 —
    // 1024×1024는 1MP라 어도비 4MP 하한에 한참 못 미쳐서, 조용히 떨어지면
    // 만든 것이 전부 `미리캔버스만`이 되는데 사람이 그 이유를 모른다 (5-2장 · 7장 10번)
    탈.크기거부 = 크기거부인가(문구) || 크기거부인가(코드);
    탈.신원확인 = /verif/i.test(문구) || /organization/i.test(문구);
    탈.잔액없음 = /billing|quota|insufficient|credit/i.test(문구) || 답.status === 402;
    탈.너무잦음 = 답.status === 429;
    throw 탈;
  }

  let 풀이;
  try {
    풀이 = JSON.parse(몸);
  } catch {
    throw new Error('OpenAI 응답을 읽지 못했어요: ' + 몸.slice(0, 300));
  }

  const 첫장 = 풀이.data && 풀이.data[0];
  if (!첫장 || !첫장.b64_json) {
    throw new Error(
      '응답 모양이 예상과 달라요 (b64_json이 없어요): ' + JSON.stringify(풀이).slice(0, 300)
    );
  }

  return {
    버퍼: Buffer.from(첫장.b64_json, 'base64'),
    // 비용을 셀 수 있으면 응답 값을 쓴다. 없으면 부르는 쪽이 설정값으로 어림한다 (9장)
    쓴것: 풀이.usage || null,
    받은크기: 풀이.size || 물음.크기,
  };
}

module.exports = { 열쇠있나, 소재목록뽑기, 글에서JSON뽑기, 이미지뽑기, 크기거부인가 };
