// 투입 폴더를 읽어 결과 폴더를 만든다 (개발 순서 2번)
//
// 실행: 세트 정리.bat 을 더블클릭
//
// 파일 이름이 영어인 이유 — 배치 파일이 chcp 65001 뒤에 한글 파일명을 읽으면
// 글자 수와 바이트 수가 어긋나 명령이 깨진다. server.js 와 같은 규칙이다.
//
//   투입/
//   ├── 세트.txt     ← 세트 정보와 소재 목록을 손으로 적는다
//   └── 이미지/      ← ChatGPT에서 받은 이미지를 손으로 넣는다
//
// 화면 1·2·3이 붙기 전까지 쓰는 임시 입구다. 화면이 붙으면 같은 core/ 를 화면이 부른다.

const fs = require('fs');
const path = require('path');

const 설정모듈 = require('./core/설정');
const { 세트글읽기 } = require('./core/목록읽기');
const { 만들기 } = require('./core/세트만들기');

const 투입폴더 = path.join(설정모듈.작업폴더, '투입');
const 세트파일 = path.join(투입폴더, '세트.txt');
const 투입이미지폴더 = path.join(투입폴더, '이미지');

const 이미지확장자 = new Set(['.png', '.jpg', '.jpeg']);

const 견본 = `# 이 파일을 고쳐서 쓰세요. # 로 시작하는 줄은 무시해요.
# 이미지는 투입\\이미지\\ 폴더에 넣으세요.

세트이름: 사무실 소품
만들고 싶은 것: 손그림 사무실 소품 이미지
그림체: 손그림동화
제출유형: 투명 배경 · PNG
세트번호:

# 제출유형은 지금 "투명 배경 · PNG" 하나예요.
# 배경 있음 · JPG는 다음 범위예요 (계획서 5-2장).

# 아래는 소재 목록이에요. 소재<탭>형태·차별점 으로 적거나 | 로 나눠도 돼요.
# 시트에서 복사해 그대로 붙여넣어도 됩니다.
#
# 형태·차별점 칸에는 시점 · 재질 · 색감 · 계절 · 분위기를 다 적어도 돼요.
# 프롬프트 3줄에 그대로 들어갑니다 (계획서 5장).

소재
스테이플러\t3/4 시점 · 무광 금속과 플라스틱
클립통\t위에서 본 시점 · 유리와 은색 클립
연필꽂이\t정면 시점 · 원통형 · 연필 서너 자루
메모지 묶음\t비스듬히 쌓인 형태 · 파스텔 종이
`;

function 준비되었나() {
  let 새로만듦 = false;

  if (!fs.existsSync(투입폴더)) {
    fs.mkdirSync(투입폴더, { recursive: true });
    새로만듦 = true;
  }
  if (!fs.existsSync(투입이미지폴더)) {
    fs.mkdirSync(투입이미지폴더, { recursive: true });
  }
  if (!fs.existsSync(세트파일)) {
    fs.writeFileSync(세트파일, 견본.replace(/\n/g, '\r\n'), 'utf8');
    새로만듦 = true;
  }

  if (새로만듦) {
    console.log('');
    console.log('  투입 폴더를 만들어 뒀어요.');
    console.log('');
    console.log('  1. ' + 세트파일);
    console.log('     을 열어 세트 정보와 소재 목록을 적으세요.');
    console.log('  2. ' + 투입이미지폴더);
    console.log('     에 이미지를 넣으세요.');
    console.log('  3. 이 파일을 다시 더블클릭하세요.');
    console.log('');
    return false;
  }

  return true;
}

function 이미지모으기() {
  if (!fs.existsSync(투입이미지폴더)) return [];

  return fs
    .readdirSync(투입이미지폴더)
    .filter((이름) => 이미지확장자.has(path.extname(이름).toLowerCase()))
    .sort((가, 나) => 가.localeCompare(나, 'ko', { numeric: true }))
    .map((이름) => path.join(투입이미지폴더, 이름));
}

function 보고하기(보고서, 그림체) {
  console.log('');
  console.log('  ── 만들었어요 ─────────────────────────────');
  console.log('');
  console.log('  세트      ' + 보고서.폴더이름);
  console.log('  제출 유형 ' + 보고서.제출유형);
  console.log('  그림체    ' + 보고서.그림체이름 + (그림체.검증 ? '' : '  (미검증 — 한 번 뽑아보고 다듬으세요)'));
  console.log('  소재      ' + 보고서.항목수 + '개');
  console.log('  프롬프트  ' + 보고서.프롬프트수 + '개');
  // 갈림길 결과 (7장 10번)
  console.log(
    '  양쪽      ' +
      (보고서.양쪽수 || 0) +
      '장' +
      (보고서.유사표시수 ? ` (표시 ${보고서.유사표시수}장 포함)` : '')
  );
  console.log('  미리캔버스만  ' + (보고서.미리캔버스만수 || 0) + '장');
  if (보고서.제외수) console.log('  제외      ' + 보고서.제외수 + '장');

  if (보고서.미리캔버스만수) {
    console.log('');
    console.log('  어도비 4MP 하한에 못 미쳐 04_업로드준비\\미리캔버스만\\ 에 담았어요');
    보고서.미리캔버스만이름들.forEach((하나) => console.log('  · ' + 하나));
    console.log('  어도비에도 올리려면 대각선 구도로 다시 그리세요.');
  }

  if (보고서.유사표시수) {
    console.log('');
    console.log('  _check — 업로드준비에는 _check를 뗀 이름으로 넣었어요');
    보고서.유사이름들.forEach((하나) => console.log('  · ' + 하나));
  }

  // 프로그램이 처리한 것 (9장)
  if (보고서.고친것.length) {
    console.log('');
    console.log('  프로그램이 고친 것');
    보고서.고친것.forEach((하나) => console.log(`  · ${하나.갈래} ${하나.장수}장`));
  }

  // 제외는 개수와 이유만 (7장)
  if (보고서.제외.length) {
    console.log('');
    console.log('  제외한 것');
    보고서.제외.forEach((하나) => console.log(`  · ${하나.사유} ${하나.장수}장`));
    console.log('  원본은 03_이미지\\_제외\\ 에 원래 이름으로 남겼어요.');
  }

  // 5장 문장이 실제로 어느 정도를 만드는지 (5-2장 · 13장)
  if (보고서.점유율) {
    const 퍼센트 = (값) => (값 * 100).toFixed(0) + '%';
    const 점 = 보고서.점유율;
    console.log('');
    console.log(
      `  오브젝트 점유율  ${퍼센트(점.가장작은것)} ~ ${퍼센트(점.가장큰것)}` +
        `  (평균 ${퍼센트(점.평균)})   목표 ${퍼센트(설정모듈.점유율.목표하한)}~${퍼센트(설정모듈.점유율.목표상한)}`
    );
    // 점유율로 제외하지는 않는다. 프롬프트가 잘 도는지 보는 값이다 (5-2장)
    const 점유 = 설정모듈.점유율;
    if (점.가장큰것 > 점유.잘림위험) {
      console.log('  · 95%를 넘은 장이 있어요. 잘림으로 제외될 위험이 커요');
    }
    if (점.가장작은것 < 점유.목표하한) {
      console.log(
        `  · 목표 하한 ${(점유.목표하한 * 100).toFixed(0)}%에 못 미친 장이 있어요. ` +
          '더 크게 그려 달라고 하세요'
      );
    }
  }

  // 유사도 기준을 눈으로 정할 때 쓰는 값 (13장)
  if (보고서.유사도잰것) {
    const 잰 = 보고서.유사도잰것;
    console.log('');
    console.log(`  유사도 (0~255 · ${잰.쌍수}쌍)`);
    console.log(
      `  · 가장 닮은 쌍 ${잰.가장닮은쌍.toFixed(1)}` +
        `   가운데 ${잰.가운데.toFixed(1)}` +
        `   가장 다른 쌍 ${잰.가장다른쌍.toFixed(1)}`
    );
    보고서.닮은쌍맛보기.forEach((하나) =>
      console.log(`  · ${하나.차이.toFixed(1)}   ${하나.가}  ↔  ${하나.나}`)
    );
    console.log(
      보고서.유사도기준 == null
        ? '  · 기준값이 아직 없어요. 위 값을 보고 설정.json의 유사도기준에 숫자를 넣으세요'
        : `  · 지금 기준값 ${보고서.유사도기준} — 이보다 작은 쌍을 표시했어요`
    );
  }

  console.log('');
  console.log('  결과 폴더');
  console.log('  ' + 보고서.세트폴더);
  console.log('');
  console.log('  업로드준비 폴더');
  console.log('  ' + 보고서.준비폴더);

  if (보고서.경고.length) {
    console.log('');
    console.log('  살펴볼 것');
    보고서.경고.forEach((한줄) => console.log('  · ' + 한줄));
    보고서.남은파일.forEach((경로) =>
      console.log('    _제외에 넣은 남은 파일: ' + path.basename(경로))
    );
  }

  console.log('');
}

async function 하기() {
  const 설정 = 설정모듈.읽기();

  if (!준비되었나()) return;

  const 읽음 = 세트글읽기(fs.readFileSync(세트파일, 'utf8'));

  if (읽음.목록.length === 0) {
    console.log('');
    console.log('  세트.txt 의 소재 목록이 비어 있어요.');
    console.log('  "소재" 줄 아래에 소재<탭>형태·차별점 으로 적어주세요.');
    console.log('');
    return;
  }

  const 그림체 = 설정모듈.그림체찾기(설정, 읽음.그림체이름);
  if (!그림체) {
    console.log('');
    console.log(`  "${읽음.그림체이름}" 이라는 그림체가 없어요.`);
    console.log('  쓸 수 있는 그림체: ' + 설정.그림체.map((하나) => 하나.이름).join(' · '));
    console.log('');
    return;
  }

  const 이미지들 = 이미지모으기();
  if (이미지들.length === 0) {
    console.log('');
    console.log('  투입\\이미지\\ 폴더가 비어 있어요.');
    console.log('  폴더 구조와 표 파일은 만들되, 이미지 자리는 비워 둘게요.');
  }

  if (이미지들.length) {
    console.log('');
    console.log(`  이미지 ${이미지들.length}장을 검사하는 중이에요...`);
  }

  const 보고서 = await 만들기(
    {
      입력: 읽음.입력,
      세트번호: 읽음.세트번호,
      세트이름: 읽음.세트이름,
      제출유형: 읽음.제출유형,
      그림체,
      목록: 읽음.목록,
      이미지들,
    },
    설정
  );

  보고하기(보고서, 그림체);
}

하기().catch((오류) => {
  console.log('');
  console.log('  멈췄어요: ' + 오류.message);
  console.log('');
  process.exitCode = 1;
});
