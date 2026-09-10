// 설정.json 읽고 쓰기 (계획서 10장 · 5-2장)
//
// 고정 항목은 두 플랫폼(어도비스톡 · 미리캔버스) 조건을 겹쳐 놓은 값이다.
// 사용자가 바꿀 수 없고, 읽을 때마다 제자리로 돌려놓는다.
//
// 여백 · 알파 임계값 · 유사도 기준 · 서버 포트 · 프롬프트 문장은 바꿀 수 있다.
// 실제 파일을 봐야 정해지는 값이기 때문이다 (13장).

const fs = require('fs');
const path = require('path');

const 작업폴더 = path.join(__dirname, '..');
const 설정파일 = path.join(작업폴더, '설정.json');

const 오브젝트유형 = '투명 배경 · PNG';
const 패턴유형 = '배경 있음 · JPG';

// 이번 범위에서는 오브젝트만 만든다 (3장 · 5-2장).
// 패턴용 공통 고정 문장과 공통 금지를 아직 쓰지 않아 JPG는 조립할 공통 문장이 없다.
const 쓸수있는제출유형 = [오브젝트유형];

// ── 고정값 (5-2장) ─────────────────────────────────
// 여백은 여기 없다. 8~20px 중 어느 값인지 실제 파일을 봐야 알기 때문에 가변이다.

const 고정 = {
  생성가로: 2880,
  생성세로: 2880,
  색상: 'sRGB',
  해상도dpi: 120,
  최소크기MP: 4,
  최대긴축px: 9800,
  최소짧은축px: 700,
  최대용량MB: 45,

  // 이미지 생성 API가 거는 제약 (5-2장). 검사 규칙이 아니라 생성 단계 상한이다
  생성최대한변px: 3840,
  생성최대총픽셀: 8_294_400,
  생성최대비율: 3,
};

const 고정_왜 = {
  생성가로:
    '2880 = 16×180. API가 16의 배수를 요구하고 2880² = 8,294,400 으로 총 픽셀 상한과 정확히 같다. ' +
    '3000은 16의 배수가 아니고(187.5) 9,000,000px으로 상한을 705,600px 넘는다 — 미확인, 첫 API 요청으로 확인',
  생성세로: '위와 같음. 미리캔버스 상한 9800px 아래',
  색상: '어도비스톡 sRGB · 미리캔버스 RGB — 겹치는 값',
  해상도dpi: '미리캔버스 요소 가이드가 120dpi를 요구',
  최소크기MP: '어도비스톡 하한. 못 넘으면 제외가 아니라 미리캔버스만 올린다 (7장 10번)',
  최소짧은축px: '미리캔버스 하한. 못 넘으면 어디에도 못 올리므로 제외한다 (7장 9번)',
  최대긴축px: '미리캔버스 상한. 2880에서 시작해 자르기만 하므로 걸릴 일은 없지만 남겨 둔다',
  최대용량MB: '어도비스톡 45MB · 미리캔버스 50MB — 엄격한 쪽',
  생성최대한변px: 'gpt-image-2 한 변 상한 — 미확인, 첫 API 요청으로 확인',
  생성최대총픽셀: 'gpt-image-2 총 픽셀 상한. 세 곳 중 가장 엄격하다 — 미확인, 첫 API 요청으로 확인',
  생성최대비율: 'gpt-image-2 최대 가로세로비. 생성 제약이지 검사 규칙이 아니다 — 미확인',
};

// **미확인** — 위 세 값을 OpenAI 공식 문서에서 원문으로 확인하지 못했다.
// 가이드 페이지에는 픽셀 값이 없고, API 레퍼런스에는 gpt-image-1용으로 보이는
// 1024x1024 / 1024x1536 / 1536x1024 / auto 목록만 있으며,
// 모델 페이지에는 "유연한 이미지 크기를 지원한다"고만 적혀 있다.
// 첫 API 요청을 보내 실제 응답으로 확인한다 (13장).

// ── 프롬프트 고정 문장 (5장) ───────────────────────
//
// 4줄 뒷부분 품질 · 5줄 구성 · 6줄 앞부분 공통 금지. 한 세트 내내 글자 그대로 같다.
//
// **여기 두는 이유** — 13장이 "이 영어 문장 자체는 ChatGPT에 넣어본 적이 없다.
// 첫 세트에서 확인한다"고 적어 뒀다. 고칠 것이 예정된 값을 코드에 박아 두면
// 문장 하나 다듬으려고 core를 열게 된다. 그래서 설정.json으로 뺐다.
//
// 프롬프트.js가 아니라 설정.js에 있는 이유는 require 방향 때문이다 —
// 프롬프트.js가 설정.js를 부르므로 반대로 부르면 순환한다.
//
// **"덜 그려라"를 빼고 "무엇을 그릴지"를 넣었다** (0장 개정표). 앞 판의
// simple · flat composition · minimal detail · clearly readable silhouette ·
// Commercial stock asset 은 전부 그림을 아이콘·클립아트 쪽으로 당겼다.
// 추상적인 품질 형용사 대신 선 · 명암 · 재질 · 표면 · 비례를 이름으로 지정한다.

// 세 그림체에 전부 붙는다. 그래서 선 굵기 · 색 · 질감처럼 그림체마다 다른 항목은
// 넣지 않는다 — 넣으면 백터아이콘의 consistent weight 와 손그림동화의 varied weight 가 부딪친다
const 기본품질 =
  'Accurate proportions and believable construction, interior linework that ' +
  "describes the object's real parts, controlled tonal shading that gives the " +
  'form volume, material-specific surface detail. Visually rich but not busy.';

// 배경 제거에 필요한 것은 바깥 윤곽뿐이다. 안쪽 경계까지 또렷하라고 하면 면이 쪼개진다
const 기본구성 =
  'Composition: one complete object, centered and fully visible with no ' +
  'cropping, shown at an angle that gives convincing volume and depth, clean ' +
  'crisp outer edge for background removal, no background scene, no props.';

// trademarks · resemblance to real people · recognizable brands 는 어도비스톡 반려 사유라 반드시 남긴다
const 기본공통금지 = [
  'text, letters, numbers, logos, trademarks, watermarks, signatures',
  'recognizable brands, resemblance to real people',
  'extra objects, cropped parts, duplicated parts',
  'flat clip-art look, generic icon shapes, uniform thick outlines, oversimplified geometry',
  'plastic 3D rendering, cast shadow, glow',
  'leftover background pixels, semi-transparent fringing',
].join(', ');

// 패턴(JPG)용 문장은 여기 두지 않는다. 아직 쓰지 않았고, 이번 범위는 오브젝트뿐이다
const 프롬프트문장기본 = {
  구성: 기본구성,
  품질: 기본품질,
  공통금지: 기본공통금지,
};

// 앞 판에 있었지만 없앤 프롬프트 문장 (0장 개정표).
//   용도 — 그림 지시가 아니라 용도 메모였다. 모델은 이걸 "범용 클립아트"로 읽는다
const 버린문장열쇠 = ['용도'];

// 오브젝트가 캔버스에서 차지하는 비율 (5-2장)
//
// **판정에 쓰지 않는다.** 프롬프트의 filling most of the canvas 가 실제로
// 어느 정도를 만드는지 지켜보는 관찰값이다 (13장).
//
// 하한이 0.7이 아니라 0.75인 이유 — 캔버스가 3000에서 2880으로 줄면서
// 같은 점유율에서 크롭 후 픽셀이 줄었다. 2880에서 정사각 오브젝트가 4MP를
// 넘으려면 크롭 후 긴 축이 2000px 이상이어야 하고, 그 경계가 점유율 69.4%다.
// 70%는 여유가 0.6%p뿐이라 조금만 작게 그려도 `미리캔버스만`으로 떨어진다.
//
//   68% → 1958px → 3.83MP → 미리캔버스만
//   70% → 2015px → 4.06MP → 양쪽 (겨우)
//   75% → 2160px → 4.67MP → 양쪽 (여유)
//   90% → 2592px → 6.72MP → 양쪽
const 점유율 = {
  목표하한: 0.75,
  목표상한: 0.9,
  잘림위험: 0.95, // 이 위로 가면 가장자리에 닿아 제외될 위험
};

// 앞 판에 있었지만 없앤 설정 (0장 개정표).
//   최소오브젝트긴축px — 통과 가능한 파일을 버려서 뺐다. 4MP 갈림길이 대신한다
//   최대가로세로비     — 덧대기가 사라져 비율을 인위적으로 만들 일이 없어졌다
const 버린열쇠 = ['최소오브젝트긴축px', '최대가로세로비'];

// API에 보낼 크기 문자열 — 고정값에서 만든다. 코드에 '2880x2880'을 박지 않는다.
// 생성 크기를 바꾸면 여기가 따라오고, 안 그러면 문서와 실제가 어긋난다 (5-2장)
function 생성크기글(설정) {
  const 값 = (설정 && 설정.고정) || 고정;
  return `${값.생성가로}x${값.생성세로}`;
}

// 파일이 어디에 올라갈 수 있나 (7장 10번). 제외가 아니라 갈림길이다
const 플랫폼 = {
  양쪽: '양쪽',
  미리캔버스: '미리캔버스',
  없음: '-', // 제외됐거나 아직 안 받은 줄
};

// ── 그림체 프리셋 (3장) ────────────────────────────
//
// 그림체는 문장 하나가 아니라 세 값이다. 종류 · 스타일 · 금지.
// 금지에는 화풍을 배제하는 말만 담는다. 텍스트 · 로고 · 그림자 · 손 오류 같은
// 항목은 그림체와 무관하므로 공통 금지가 맡는다 (5장).

const 그림체프리셋 = [
  {
    이름: '손그림동화',
    종류: 'hand-drawn',
    // 앞 판의 simple · flat composition · minimal detail 을 뺐다. 그림을 단순하게만 당겼다.
    // 끊기는 손그림 윤곽이 이 그림체의 몫이라 공통 금지에서 broken lines 도 뺐다
    스타일:
      "hand-drawn children's book illustration in colored pencil and watercolor, " +
      'delicate graphite contours with varied weight, layered pigment with ' +
      'visible strokes, paper grain within the object, gentle tonal variation, ' +
      'muted warm palette of a few hues',
    금지: 'plastic 3D render, photographic capture, flat vector look',
    검증: true,
    출처: '코드북 기본01',
  },
  {
    이름: '빈티지패브릭',
    종류: 'hand-drawn',
    스타일:
      'vintage stationery illustration in colored pencil with light gouache ' +
      'washes, soft worn contours, desaturated aged-paper palette, low-contrast ' +
      'tonal variation, woven cloth weave and laid-paper grain, layered pigment',
    금지: 'plastic 3D render, photographic capture, hard-edged vector shapes, high contrast',
    검증: true,
    출처: '코드북 기본02',
  },
  {
    이름: '백터아이콘',
    // 앞 판은 flat icon-style 에 no gradient · no shadow 인 납작한 아이콘이었다.
    // 이름과 실제로 쓰는 화풍이 맞지 않았다
    종류: 'vector icon-style',
    // 명암은 스타일 칸에서 긍정문으로만 말한다. 앞 판은 no gradient 가 스타일에,
    // gradients 가 금지에 또 있었다. 금지 칸은 반대 화풍만 막는다
    스타일:
      'detailed vector illustration, crisp closed contours of consistent weight, ' +
      'restrained palette of a few hues with many value steps, smooth gradient ' +
      'shading from one light direction with specular highlights on curved ' +
      'surfaces, clean untextured surfaces where material reads from shading alone',
    금지: 'photographic capture, hand-drawn wobble, crayon or pencil texture, flat fills with no shading',
    검증: true,
    출처: '프로토타입용으로 새로 쓴 것',
  },
];

const 기본종류 = 'hand-drawn';

// ── 기본 설정 ──────────────────────────────────────

function 기본설정() {
  return {
    _안내:
      '고정 항목은 두 플랫폼 조건이라 프로그램이 켜질 때마다 제자리로 돌려놔요. ' +
      '고쳐도 되는 건 여백px · 알파임계값 · 유사도기준 · 서버포트 · 결과폴더 · ' +
      '프롬프트문장 · AI · 그림체예요. 고친 뒤에는 프로그램을 다시 켜야 반영돼요. ' +
      'API 열쇠는 여기 넣지 마세요 — .env 파일의 OPENAI_API_KEY로만 읽어요.',
    고정: { ...고정 },
    고정_왜: { ...고정_왜 },
    여백px: 12, // 8~20 범위. 실제 파일로 정한다 (13장)
    알파임계값: 26, // 이 값 이상만 오브젝트로 본다 (7장)
    // 0~255. 차이가 이 값보다 작으면 두 장 다 _check를 붙인다.
    // 높일수록 더 많이 표시된다 (7장의 "차이가 기준값 아래면 표시" 규칙 때문에).
    //
    // 10으로 잡은 근거 — 시험 세트에서 잰 값이 두 무리로 갈렸다.
    //   거의 같은 그림  0.5 ~ 4
    //   다른 그림       80 ~ 114
    // 그 사이 아무 값이나 되지만, 놓치는 것보다 더 표시하는 쪽이 낫다.
    // 표시일 뿐 지우지 않고 업로드준비에도 들어가기 때문이다 (8장).
    //
    // 아직 임시값이다. 첫 세트를 ChatGPT로 실제로 뽑아보고 다시 정한다 (13장).
    유사도기준: 10,
    서버포트: 3900,
    결과폴더: '결과',

    // 4·5·6줄의 고정 문장 (5장 · 13장). 고쳐서 첫 세트로 확인한다
    프롬프트문장: { ...프롬프트문장기본 },

    // ── AI 연결 (12장) ────────────────────────────
    //
    // 열쇠는 여기 없다. server.js가 환경변수 OPENAI_API_KEY로만 읽는다 (10장).
    // 이 파일은 git에 올라갈 수 있으므로 열쇠를 넣으면 안 된다.
    //
    // 목록모델은 실제 호출로 확인했다. 6개 뽑는 데 5~6초 —
    // AI.js가 reasoning_effort를 minimal로 보내기 전에는 56초였다.
    // 이미지모델은 아직 불러 본 적이 없다.
    // 이름이 틀리면 OpenAI가 돌려준 문구를 화면에 그대로 보여주니 여기서 고치면 된다.
    AI: {
      목록모델: 'gpt-5-mini', // 소재 목록을 뽑는 글자 모델 — 확인함
      이미지모델: 'gpt-image-2', // 다음 순서. 조직 신원 확인이 필요하다 — 미확인
      // 한 세트 기본 장수. 화면에 개수 입력칸은 두지 않는다 (4장).
      //
      // 12에서 6으로 줄였다 — 12개는 화면에서 너무 길고, 주제 범위가 좁을 때
      // 모델이 "겹치지 마라"를 지키려고 주제를 벗어나는 일이 심해졌다.
      // 6개는 주제 안에서 무리 없이 벌어지면서도, 지시문이 약해지면 바로 티가 난다.
      // 3~4개는 너무 쉬워서 문제가 있어도 안 드러난다.
      소재개수: 6,
      목록호출한도: 5, // 한 세트에서 처음 1번 + 더 뽑기 4번 (4장)

      // 공식 값은 low · medium · high · auto (12장)
      이미지품질: 'medium',

      // 소재 개수 + 재시도 3번. 한 세트에서 이보다 많이 부르지 않는다.
      // 돈이 나가는 호출이라 목록보다 조이는 쪽으로 잡는다
      이미지호출한도: 6 + 3,

      // 비용은 **응답의 usage(출력 토큰)로만 센다** (12장 J).
      //
      // 앞 판의 `장당예상원범위: [240, 640]`은 근거 없이 손으로 넣은 값이라 없앴다.
      // 어림값을 화면에 적으면 사람이 그것을 사실로 읽는다.
      // usage가 안 오면 토큰 줄을 아예 안 보여준다 — 추정으로 대신 채우지 않는다.
      이미지출력단가달러백만토큰: 30,

      // 장당 시간(장당초)은 없앴다. 170초로 적혀 있었지만 실측은 6장에 1분이 안 됐다.
      // 맞는 값을 모르므로 화면은 남은 시간 대신 누적 출력 토큰을 보여준다
    },

    그림체: 그림체프리셋.map((하나) => ({ ...하나 })),
  };
}

// ── 읽기 · 쓰기 ────────────────────────────────────

// 받침이 있으면 "이", 없으면 "가". 안내 문구가 "구성가"로 나오지 않게
function 이가(말) {
  const 끝 = String(말).charCodeAt(String(말).length - 1);
  const 한글인가 = 끝 >= 0xac00 && 끝 <= 0xd7a3;
  return 한글인가 && (끝 - 0xac00) % 28 !== 0 ? '이' : '가';
}

function 읽기() {
  const 기본 = 기본설정();
  let 저장된 = {};

  if (fs.existsSync(설정파일)) {
    try {
      저장된 = JSON.parse(fs.readFileSync(설정파일, 'utf8'));
    } catch {
      console.warn('  설정.json을 읽지 못해 기본값으로 갑니다.');
      저장된 = {};
    }
  }

  const 설정 = {
    ...기본,
    ...저장된,
    // 고정값은 저장된 것을 무시하고 언제나 제자리로
    고정: { ...고정 },
    고정_왜: { ...고정_왜 },
    _안내: 기본._안내,
  };

  // 여백은 8~20 범위를 벗어나면 되돌린다 (5-2장)
  const 여백 = Number(설정.여백px);
  if (!Number.isFinite(여백) || 여백 < 8 || 여백 > 20) 설정.여백px = 기본.여백px;

  // 없앤 항목은 파일에서도 지운다 (0장 개정표).
  // 안 지우면 설정.json에 옛 숫자가 남아 "이 값이 아직 쓰이나" 하고 헷갈린다
  for (const 옛열쇠 of 버린열쇠) delete 설정[옛열쇠];

  // AI 설정 — 빠진 열쇠는 기본값으로 채운다 (12장)
  설정.AI = { ...기본.AI, ...(설정.AI && typeof 설정.AI === 'object' ? 설정.AI : {}) };
  const 개수 = Number(설정.AI.소재개수);
  if (!Number.isInteger(개수) || 개수 < 1 || 개수 > 50) 설정.AI.소재개수 = 기본.AI.소재개수;
  const 한도 = Number(설정.AI.목록호출한도);
  if (!Number.isInteger(한도) || 한도 < 1 || 한도 > 20) 설정.AI.목록호출한도 = 기본.AI.목록호출한도;

  // 이미지 호출 한도 — 소재 개수보다 적으면 한 세트를 못 만든다
  const 그림한도 = Number(설정.AI.이미지호출한도);
  if (!Number.isInteger(그림한도) || 그림한도 < 설정.AI.소재개수 || 그림한도 > 200) {
    설정.AI.이미지호출한도 = 설정.AI.소재개수 + 3;
  }

  if (!['low', 'medium', 'high', 'auto'].includes(설정.AI.이미지품질)) {
    설정.AI.이미지품질 = 기본.AI.이미지품질;
  }

  // 근거 없는 원(₩) 어림값은 더 쓰지 않는다. 남아 있으면 지운다 (12장 J)
  delete 설정.AI.장당예상원;
  delete 설정.AI.장당예상원범위;
  // 실측과 맞지 않던 장당 시간도 지운다 (0장 개정표)
  delete 설정.AI.장당초;

  const 단가 = Number(설정.AI.이미지출력단가달러백만토큰);
  if (!Number.isFinite(단가) || 단가 <= 0) {
    설정.AI.이미지출력단가달러백만토큰 = 기본.AI.이미지출력단가달러백만토큰;
  }

  // 프롬프트 고정 문장 — 손으로 고치는 값이라 깨진 채로 지나가지 않게 본다 (5장 · 13장).
  //
  // 구성은 5줄 자체라 비면 줄이 사라진다. 되돌린다.
  // 품질과 공통 금지는 빈 값도 뜻이 있다 — 비우면 4줄에 그림체 스타일만,
  // 6줄에 그림체 금지만 남는다. 금지줄()이 쉼표까지 알아서 뗀다.
  if (!설정.프롬프트문장 || typeof 설정.프롬프트문장 !== 'object') {
    설정.프롬프트문장 = { ...프롬프트문장기본 };
  } else {
    설정.프롬프트문장 = { ...프롬프트문장기본, ...설정.프롬프트문장 };

    // 없앤 문장은 파일에서도 지운다. 남기면 "이 줄이 아직 들어가나" 하고 헷갈린다
    for (const 옛열쇠 of 버린문장열쇠) delete 설정.프롬프트문장[옛열쇠];

    for (const 열쇠 of ['구성']) {
      const 값 = 설정.프롬프트문장[열쇠];
      if (typeof 값 !== 'string' || !값.trim()) {
        console.warn(
          `  설정.json의 프롬프트문장.${열쇠}${이가(열쇠)} 비어 있어 기본 문장으로 갑니다.`
        );
        설정.프롬프트문장[열쇠] = 프롬프트문장기본[열쇠];
      }
    }

    for (const 열쇠 of ['품질', '공통금지']) {
      if (typeof 설정.프롬프트문장[열쇠] !== 'string') {
        console.warn(`  설정.json의 프롬프트문장.${열쇠}${이가(열쇠)} 글이 아니라 기본값으로 갑니다.`);
        설정.프롬프트문장[열쇠] = 프롬프트문장기본[열쇠];
      }
    }
  }

  if (!Array.isArray(설정.그림체) || 설정.그림체.length === 0) {
    설정.그림체 = 기본.그림체;
  }

  쓰기(설정);
  return 설정;
}

function 쓰기(설정) {
  fs.writeFileSync(설정파일, JSON.stringify(설정, null, 2) + '\n', 'utf8');
}

function 그림체찾기(설정, 이름) {
  if (!이름) return 설정.그림체[0];
  const 찾음 = 설정.그림체.find((하나) => 하나.이름 === String(이름).trim());
  return 찾음 || null;
}

/**
 * 그림체 추가 (3장 그림체 추가 규칙)
 *
 * - 이름(필수) · 스타일(필수) · 금지(선택) · 종류(선택)
 * - 금지를 비워도 된다. 공통 금지가 이미 들어가므로 프롬프트가 성립한다
 * - 종류를 비우면 hand-drawn
 * - 이름이나 스타일이 비어 있으면 저장하지 않고 안내
 * - 저장하면 목록 맨 뒤에 붙는다 (고른 상태로 만드는 것은 화면이 한다)
 *
 * 넘겨받은 설정 객체에만 붙인다. 파일에 쓰는 것은 부르는 쪽이 한다 —
 * 점검이 실제 설정.json을 더럽히지 않게 하려고 나눴다.
 *
 * @returns {{된것?: object, 안된까닭?: string}}
 */
function 그림체더하기(설정, 값) {
  const 한줄 = (글) => String(글 || '').replace(/\s+/g, ' ').trim();

  const 이름 = 한줄(값.이름);
  const 스타일 = 한줄(값.스타일);
  const 금지 = 한줄(값.금지);
  const 종류 = 한줄(값.종류) || 기본종류;

  if (!이름) return { 안된까닭: '그림체 이름을 적어주세요.' };
  if (!스타일) return { 안된까닭: '스타일 문장을 적어주세요.' };

  if (설정.그림체.some((하나) => 하나.이름 === 이름)) {
    return { 안된까닭: `"${이름}"은 이미 있는 그림체예요. 다른 이름을 쓰세요.` };
  }

  const 새것 = { 이름, 종류, 스타일, 금지, 검증: false, 출처: '사용자가 추가' };
  설정.그림체.push(새것);
  return { 된것: 새것 };
}

module.exports = {
  작업폴더,
  설정파일,
  오브젝트유형,
  패턴유형,
  쓸수있는제출유형,
  고정,
  고정_왜,
  점유율,
  플랫폼,
  생성크기글,
  프롬프트문장기본,
  그림체프리셋,
  기본종류,
  기본설정,
  읽기,
  쓰기,
  그림체찾기,
  그림체더하기,
};
