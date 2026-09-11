// 스톡 스튜디오 - 로컬 서버
// 실행: 실행.bat 을 더블클릭
// 하는 일: web/ 폴더를 로컬 주소로 띄우고 브라우저를 자동으로 연다.
//
// 규칙은 전부 core/ 에 있다. 화면도 배치 파일(build.js)도 같은 core/ 를 부른다.
// 화면이 프롬프트를 스스로 조립하지 않고 서버에 물어보는 이유도 같다 —
// 조립 규칙이 두 군데 있으면 반드시 어긋난다 (계획서 5장).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ── API 열쇠 (계획서 10장) ─────────────────────────
//
// 실행.bat 옆의 .env를 읽어 process.env에 넣는다. Node 24에 들어 있는 기능이라
// 패키지를 더 쓰지 않는다. 열쇠는 여기서 읽기만 하고 아무 데도 옮기지 않는다 —
// 설정.json에도, web/으로 내려가는 응답에도, 화면에도 넣지 않는다.
// 화면에는 "연결됨 / 안 됨"만 보낸다.
const 환경파일 = path.join(__dirname, '.env');
if (fs.existsSync(환경파일)) {
  try {
    process.loadEnvFile(환경파일);
  } catch (오류) {
    console.warn('  .env를 읽지 못했어요: ' + 오류.message);
  }
}

const 설정모듈 = require('./core/설정');
const 이름모듈 = require('./core/이름');
const 프롬프트 = require('./core/프롬프트');
const 제작문구 = require('./core/제작문구');
const 받은파일 = require('./core/받은파일');
const 세트만들기 = require('./core/세트만들기');
const 결과보기 = require('./core/결과보기');
const { 짝짓기, 추가짝짓기 } = require('./core/짝짓기');
const AI = require('./core/AI');
const 픽셀 = require('./core/픽셀');
const { Jimp } = require('jimp');
const Busboy = require('busboy');

const 웹폴더 = path.join(__dirname, 'web');
const 포트더시도 = 10; // 쓰이고 있으면 하나씩 올려 잡는다 (계획서 2장)
const 온라인배포 = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);

const 형식 = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const 서버 = http.createServer((요청, 응답) => {
  let 주소경로;
  try {
    주소경로 = decodeURIComponent(new URL(요청.url, 'http://localhost').pathname);
  } catch {
    응답.writeHead(400).end('잘못된 주소');
    return;
  }

  // 받은 파일 미리보기 — 짝지은 결과를 사람이 눈으로 확인해야 한다 (6장 3번)
  if (주소경로.startsWith('/api/받은그림/')) {
    const 아이디 = 주소경로.slice('/api/받은그림/'.length);
    const 하나 = 받은파일.하나찾기(아이디);

    if (!하나) {
      응답.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      응답.end('없는 파일이에요');
      return;
    }

    fs.readFile(하나.경로, (오류, 내용) => {
      if (오류) {
        응답.writeHead(404).end();
        return;
      }
      응답.writeHead(200, {
        'Content-Type': 형식[path.extname(하나.경로).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      응답.end(내용);
    });
    return;
  }

  // 만들어진 이미지 썸네일 — 화면 4가 보여준다 (9장)
  if (주소경로 === '/api/결과그림') {
    const 물음 = new URL(요청.url, 'http://localhost').searchParams;
    const 설정 = 설정모듈.읽기();
    const 뿌리 = 결과폴더경로(설정);
    const 파일 = path.join(뿌리, path.normalize(물음.get('경로') || ''));

    if (!결과보기.안쪽인가(뿌리, 파일)) {
      응답.writeHead(403).end();
      return;
    }

    fs.readFile(파일, (오류, 내용) => {
      if (오류) {
        응답.writeHead(404).end();
        return;
      }
      응답.writeHead(200, {
        'Content-Type': 형식[path.extname(파일).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      응답.end(내용);
    });
    return;
  }

  if (주소경로.startsWith('/api/')) {
    const 물음 = new URL(요청.url, 'http://localhost').searchParams;
    답하기(주소경로, 요청, 응답, 물음);
    return;
  }

  if (주소경로 === '/') 주소경로 = '/index.html';

  const 파일 = path.join(웹폴더, path.normalize(주소경로));

  // 웹 폴더 밖으로 나가는 요청은 막는다
  if (!파일.startsWith(웹폴더 + path.sep)) {
    응답.writeHead(403).end('접근할 수 없어요');
    return;
  }

  fs.readFile(파일, (오류, 내용) => {
    if (오류) {
      응답.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      응답.end('없는 파일이에요: ' + 주소경로);
      return;
    }
    응답.writeHead(200, {
      'Content-Type': 형식[path.extname(파일).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    응답.end(내용);
  });
});

// ── 화면이 물어보는 것 ──────────────────────────────
// 화면 1이 그림체 목록과 고정 조건을 여기서 받아 간다 (개발 순서 3번에서 쓰인다).

function json응답(응답, 값, 코드 = 200) {
  const 몸 = JSON.stringify(값);
  응답.writeHead(코드, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  응답.end(몸);
}

// POST로 온 JSON 몸을 읽는다
function 몸읽기(요청) {
  return new Promise((풀기, 깨기) => {
    const 조각 = [];
    let 크기 = 0;

    요청.on('data', (덩이) => {
      크기 += 덩이.length;
      if (크기 > 1024 * 1024) {
        깨기(new Error('보낸 것이 너무 커요.'));
        요청.destroy();
        return;
      }
      조각.push(덩이);
    });

    요청.on('end', () => {
      const 글 = Buffer.concat(조각).toString('utf8');
      if (!글.trim()) return 풀기({});
      try {
        풀기(JSON.parse(글));
      } catch {
        깨기(new Error('보낸 것이 JSON이 아니에요.'));
      }
    });

    요청.on('error', 깨기);
  });
}

// multipart 로 올라온 파일을 받는다 (계획서 2장이 고른 busboy)
function 올린파일읽기(요청) {
  return new Promise((풀기, 깨기) => {
    const 받은것 = [];
    let 나눔;

    try {
      나눔 = Busboy({
        headers: 요청.headers,
        // 이걸 안 주면 파일명을 latin1로 읽어 한글이 깨진다.
        // 짝짓기 1번(파일명에 아이템번호가 박혔나)이 파일명을 보므로 그냥 넘길 수 없다 (6장)
        defParamCharset: 'utf8',
        limits: { fileSize: 200 * 1024 * 1024 },
      });
    } catch (오류) {
      깨기(오류);
      return;
    }

    나눔.on('file', (칸이름, 흐름, 알림) => {
      const 조각 = [];
      흐름.on('data', (덩이) => 조각.push(덩이));
      흐름.on('end', () => {
        받은것.push({ 이름: 알림.filename || '이름없음', 덩이: Buffer.concat(조각) });
      });
    });

    나눔.on('close', () => 풀기(받은것));
    나눔.on('error', 깨기);
    요청.pipe(나눔);
  });
}

// 결과 폴더의 실제 경로
function 결과폴더경로(설정) {
  return path.isAbsolute(설정.결과폴더)
    ? 설정.결과폴더
    : path.join(설정모듈.작업폴더, 설정.결과폴더);
}

async function 답하기(주소경로, 요청, 응답, 물음) {
  try {
    const 설정 = 설정모듈.읽기();

    // ── 그림체 추가 (3장) ──
    if (주소경로 === '/api/그림체' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 결과 = 설정모듈.그림체더하기(설정, 값);

      if (결과.안된까닭) {
        json응답(응답, { 오류: 결과.안된까닭 }, 400);
        return;
      }
      설정모듈.쓰기(설정); // 사용자가 추가한 것도 설정.json에 쌓인다 (10장)
      json응답(응답, { 더한것: 결과.된것, 그림체: 설정.그림체 });
      return;
    }

    // ── 세트번호 자동 채번 (3장) ──
    // 접두어는 제출 유형이 정하고, 번호는 접두어별로 따로 센다
    if (주소경로 === '/api/세트번호') {
      const 제출유형 = 물음.get('제출유형') || 설정모듈.오브젝트유형;
      const 접두 = 이름모듈.접두어(제출유형);
      json응답(응답, {
        세트번호: 이름모듈.다음세트번호(결과폴더경로(설정), 접두),
        접두어: 접두,
      });
      return;
    }

    // ── 손으로 넣은 세트번호가 쓸 수 있나 (3장) ──
    if (주소경로 === '/api/세트번호확인') {
      const 값 = (물음.get('세트번호') || '').trim().toUpperCase();
      const 제출유형 = 물음.get('제출유형') || 설정모듈.오브젝트유형;
      const 접두 = 이름모듈.접두어(제출유형);

      if (!이름모듈.세트번호맞나(값)) {
        json응답(응답, { 쓸수있나: false, 까닭: `${접두} + 두 자리로 적어주세요. 예: ${접두}03` });
        return;
      }
      if (값[0] !== 접두) {
        json응답(응답, { 쓸수있나: false, 까닭: `이 제출 유형은 ${접두}로 시작해야 해요.` });
        return;
      }
      if (이름모듈.세트번호있나(결과폴더경로(설정), 값)) {
        json응답(응답, { 쓸수있나: false, 까닭: `${값}는 이미 있어요.` });
        return;
      }
      json응답(응답, { 쓸수있나: true });
      return;
    }

    // ── 소재 목록 AI 생성 (4장 · 12장) ──
    //
    // 화면 1의 "만들고 싶은 것" 한 줄과 그림체를 재료로 글자 모델을 부른다.
    // 호출 횟수는 화면이 세지만, 서버도 한도를 확인한다 — 화면만 믿으면
    // 새로고침 한 번으로 한도가 풀린다.
    if (주소경로 === '/api/소재목록' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 몇번째 = Number(값.몇번째) || 1;

      if (몇번째 > 설정.AI.목록호출한도) {
        json응답(
          응답,
          {
            오류:
              `한 세트에서 목록 뽑기는 ${설정.AI.목록호출한도}번까지예요. ` +
              '직접 적기로 더하시거나 새 세트로 시작해 주세요.',
            한도넘음: true,
          },
          429
        );
        return;
      }

      const 그림체 = 설정모듈.그림체찾기(설정, 값.그림체이름);
      const 개수 = Math.max(1, Math.min(50, Number(값.개수) || 설정.AI.소재개수));

      try {
        const 답 = await AI.소재목록뽑기({
          입력: String(값.입력 || '').trim(),
          그림체: 그림체 || {},
          개수,
          뺄것: Array.isArray(값.뺄것) ? 값.뺄것 : [],
          모델: 설정.AI.목록모델,
        });
        json응답(응답, { 목록: 답.목록, 몇번째, 한도: 설정.AI.목록호출한도 });
      } catch (오류) {
        json응답(
          응답,
          { 오류: 오류.message, 연결안됨: Boolean(오류.연결안됨) },
          오류.연결안됨 ? 503 : 502
        );
      }
      return;
    }

    // ── 이미지 생성 (12장) ──
    //
    // 소재 하나씩 순차로 만든다. 동시에 여러 장 만들지 않는다 —
    // 돈이 나가는 호출이고, 중간에 멈췄을 때 무엇이 만들어졌는지 분명해야 한다.
    //
    // 한 장이 끝날 때마다 **받은 파일 저장소에 넣고** 화면에 알린다.
    // 저장소에 들어가는 순간부터는 사람이 가져온 파일과 구별되지 않는다 (0장 설계 원칙).
    if (주소경로 === '/api/이미지생성' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 항목들 = Array.isArray(값.항목들) ? 값.항목들 : [];

      if (항목들.length === 0) {
        json응답(응답, { 오류: '만들 소재를 받지 못했어요.' }, 400);
        return;
      }
      if (!AI.열쇠있나()) {
        json응답(
          응답,
          {
            오류:
              'AI 연결이 안 돼 있어요. 실행.bat 옆 .env 파일에 OPENAI_API_KEY를 적고 ' +
              '프로그램을 다시 켜 주세요.',
            연결안됨: true,
          },
          503
        );
        return;
      }
      if (만들기.도는중) {
        json응답(응답, { 오류: '이미 만드는 중이에요.' }, 409);
        return;
      }
      if (만들기.부른수 + 항목들.length > 설정.AI.이미지호출한도) {
        json응답(
          응답,
          {
            오류:
              `한 세트에서 이미지 만들기는 ${설정.AI.이미지호출한도}번까지예요. ` +
              `지금까지 ${만들기.부른수}번 불렀어요.`,
            한도넘음: true,
          },
          429
        );
        return;
      }

      await 이미지만들기흘리기(항목들, 설정, 응답);
      return;
    }

    if (주소경로 === '/api/이미지중단' && 요청.method === 'POST') {
      만들기.멈춰 = true;
      json응답(응답, { 멈춤: true });
      return;
    }

    if (주소경로 === '/api/이미지생성초기화' && 요청.method === 'POST') {
      만들기.부른수 = 0;
      만들기.멈춰 = false;
      json응답(응답, { 부른수: 0 });
      return;
    }

    // ── AI 연결 상태 (10장) ──
    // 열쇠 자체는 절대 내려보내지 않는다. 있나 없나와 모델 이름만
    if (주소경로 === '/api/AI상태') {
      json응답(응답, {
        연결됨: AI.열쇠있나(),
        목록모델: 설정.AI.목록모델,
        소재개수: 설정.AI.소재개수,
        목록호출한도: 설정.AI.목록호출한도,
        // 이미지 쪽 (12장). 열쇠 자체는 절대 내려보내지 않는다 (10장)
        이미지모델: 설정.AI.이미지모델,
        이미지품질: 설정.AI.이미지품질,
        이미지호출한도: 설정.AI.이미지호출한도,
        이미지출력단가달러백만토큰: 설정.AI.이미지출력단가달러백만토큰,
        생성크기: 설정모듈.생성크기글(설정),
        이미지부른수: 만들기.부른수,
      });
      return;
    }

    // ── 아이템번호 다시 매기기 (4장 · 8장) ──
    // 삭제·추가 후 항상 1부터 다시 매긴다
    if (주소경로 === '/api/목록번호' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 세트번호 = String(값.세트번호 || '').trim().toUpperCase();
      const 개수 = Math.max(0, Math.min(200, Number(값.개수) || 0));

      const 번호들 = [];
      for (let 자리 = 1; 자리 <= 개수; 자리 += 1) {
        번호들.push(이름모듈.아이템번호(세트번호, 자리));
      }
      json응답(응답, { 번호들 });
      return;
    }

    // ── 화면 3 준비 — 프롬프트 목록과 파일받기 문구 (6장) ──
    if (주소경로 === '/api/제작준비' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 그림체 = 설정모듈.그림체찾기(설정, 값.그림체이름);
      if (!그림체) {
        json응답(응답, { 오류: `"${값.그림체이름}" 그림체가 없어요.` }, 404);
        return;
      }

      const 제출유형 = 값.제출유형 || 설정모듈.오브젝트유형;
      const 항목들 = 제작문구.항목들만들기(
        String(값.세트번호 || '').trim().toUpperCase(),
        값.목록 || [],
        그림체,
        제출유형,
        설정.프롬프트문장
      );

      json응답(응답, {
        항목들,
        전체복사글: 제작문구.전체복사글(항목들),
        파일받기문구: 제작문구.파일받기문구(항목들, 설정.여백px),
      });
      return;
    }

    // ── 파일 받기 — ZIP이면 풀어서 안의 이미지를 쓴다 (6장) ──
    if (주소경로 === '/api/파일받기' && 요청.method === 'POST') {
      const 올린것 = await 올린파일읽기(요청);
      const 담음 = [];
      const 넘김 = [];

      for (const 하나 of 올린것) {
        const 결과 = 받은파일.받기(하나.이름, 하나.덩이);
        담음.push(...결과.담은것);
        넘김.push(...결과.넘긴것);
      }

      json응답(응답, { 담은것: 담음, 넘긴것: 넘김, 모두: 받은파일.모두() });
      return;
    }

    if (주소경로 === '/api/받은파일' && 요청.method === 'GET') {
      json응답(응답, { 모두: 받은파일.모두() });
      return;
    }

    if (주소경로 === '/api/파일버리기' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 됐나 = 받은파일.버리기(값.아이디);
      json응답(응답, { 버렸나: 됐나, 모두: 받은파일.모두() });
      return;
    }

    if (주소경로 === '/api/파일비우기' && 요청.method === 'POST') {
      받은파일.비우기();
      json응답(응답, { 모두: [] });
      return;
    }

    // ── 파일과 목록 짝짓기 (6장) ──
    // 파일명이 맞으면 그 번호로, 아니면 이름 오름차순(자연순)
    if (주소경로 === '/api/짝짓기' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);

      const 모드 = 값.모드;
      if (모드 !== '추가' && 모드 !== '전체') {
        json응답(
          응답,
          {
            오류:
              '짝짓기 모드를 알 수 없어요. "추가" 또는 "전체" 중 하나여야 해요. ' +
              `받은 값: ${JSON.stringify(값.모드)}`,
          },
          400
        );
        return;
      }

      // 짝짓기는 파일 경로를 보고 판단한다 — 파일명에 아이템번호가 박혔나, 아니면 이름 순.
      // 받은파일은 아이디로 저장돼 있으므로 원래 이름을 살린 가짜 경로를 만들어 준다
      const 이름별 = new Map(); // 가짜경로 → 아이디
      const 아이디별 = new Map(); // 아이디 → 가짜경로
      const 본이름 = new Set();

      for (const 하나 of 받은파일.모두()) {
        const 길 = path.join(받은파일.둘곳, 하나.원래이름);
        // 같은 이름이 두 번 오면 뒤엣것이 덮이지 않게 아이디를 붙인다
        const 안겹치는길 = 본이름.has(길) ? 길 + '#' + 하나.아이디 : 길;
        본이름.add(길);
        이름별.set(안겹치는길, 하나.아이디);
        아이디별.set(하나.아이디, 안겹치는길);
      }

      const 항목들 = (값.아이템번호들 || []).map((번호) => ({ 아이템번호: 번호 }));

      let 결과;
      if (모드 === '전체') {
        // 기존 짝은 쓰지 않는다. 서버에 남아 있는 파일 전체를 처음부터 배정한다
        결과 = 짝짓기(항목들, [...아이디별.values()]);
      } else {
        // 기존 짝을 검증해 예약하고, 이번에 새로 받은 파일만 빈 자리에 넣는다.
        // 서버에 없는 아이디는 여기서 걸러 경로가 없는 짝으로 만들어 보낸다 —
        // 짝짓기가 "파일이 없다"고 보고 그 짝만 버린다
        const 기존짝 = (값.기존짝 || []).map((하나) => ({
          아이템번호: 하나 && 하나.아이템번호,
          파일: 하나 && 아이디별.get(하나.아이디) ? 아이디별.get(하나.아이디) : null,
          방법: 하나 && 하나.방법,
        }));

        const 새파일 = (값.배정할파일아이디들 || [])
          .map((아이디) => 아이디별.get(아이디))
          .filter(Boolean);

        결과 = 추가짝짓기(항목들, 기존짝, 새파일);
      }

      json응답(응답, {
        짝: 결과.짝.map((하나) => ({
          아이템번호: 하나.항목.아이템번호,
          아이디: 하나.파일 ? 이름별.get(하나.파일) : null,
          방법: 하나.방법,
        })),
        남은파일: 결과.남은파일.map((길) => 이름별.get(길)).filter(Boolean),
        경고: 결과.경고,
      });
      return;
    }

    // ── 정리 시작 — 여기서 폴더가 만들어진다 (2장 · 7장 · 8장) ──
    if (주소경로 === '/api/세트만들기' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 그림체 = 설정모듈.그림체찾기(설정, 값.그림체이름);
      if (!그림체) {
        json응답(응답, { 오류: `"${값.그림체이름}" 그림체가 없어요.` }, 404);
        return;
      }

      // 화면이 준 짝(아이템번호 → 파일 아이디)을 실제 경로로 바꾼다
      const 짝 = {};
      const 쓴아이디 = new Set();
      for (const [아이템번호, 아이디] of Object.entries(값.짝 || {})) {
        const 하나 = 받은파일.하나찾기(아이디);
        if (!하나) continue;
        짝[아이템번호] = 하나.경로;
        쓴아이디.add(아이디);
      }

      const 이미지들 = 받은파일.모두().map((하나) => 받은파일.하나찾기(하나.아이디).경로);

      const 보고서 = await 세트만들기.만들기(
        {
          입력: 값.입력,
          세트번호: 값.세트번호,
          세트이름: 값.세트이름,
          제출유형: 값.제출유형,
          그림체,
          목록: 값.목록 || [],
          이미지들,
          짝,
        },
        설정
      );

      받은파일.비우기(); // 세트를 만들었으니 잠시 두던 것은 비운다
      json응답(응답, { 보고서 });
      return;
    }

    // ── 화면 4 — 만들어진 폴더를 읽어 보여준다 (9장) ──
    if (주소경로 === '/api/결과보기' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 뿌리 = 결과폴더경로(설정);
      const 세트폴더 = path.join(뿌리, String(값.폴더이름 || ''));

      if (!결과보기.안쪽인가(뿌리, 세트폴더) || !fs.existsSync(세트폴더)) {
        json응답(응답, { 오류: '그 폴더를 찾지 못했어요.' }, 404);
        return;
      }

      json응답(응답, {
        세트폴더,
        트리: 결과보기.트리읽기(세트폴더),
        이미지들: 결과보기.이미지목록(세트폴더, 설정),
      });
      return;
    }

    // ── 결과 폴더 열기 — 탐색기에서 실제 폴더를 연다 (9장) ──
    if (주소경로 === '/api/폴더열기' && 요청.method === 'POST') {
      const 값 = await 몸읽기(요청);
      const 뿌리 = 결과폴더경로(설정);
      const 열곳 = 값.폴더이름 ? path.join(뿌리, String(값.폴더이름)) : 뿌리;

      if (!결과보기.안쪽인가(뿌리, 열곳) || !fs.existsSync(열곳)) {
        json응답(응답, { 오류: '그 폴더를 찾지 못했어요.' }, 404);
        return;
      }

      // 실패하면 200으로 덮지 않는다. 눌러도 아무 일이 없는데 성공했다고 하면
      // 사람이 무엇이 잘못됐는지 알 수 없다 (9장)
      try {
        const 열림 = await 결과보기.탐색기로열기(열곳);
        json응답(응답, { 열었어요: true, 경로: 열림.경로, 방법: 열림.방법 });
      } catch (오류) {
        json응답(응답, { 오류: 오류.message, 경로: path.resolve(열곳) }, 500);
      }
      return;
    }

    // ── 프롬프트 미리보기 (3장 · 5장) ──
    // 화면이 스스로 조립하지 않는다. 규칙이 두 군데 있으면 어긋나기 때문이다
    if (주소경로 === '/api/미리보기') {
      const 그림체이름 = 물음.get('그림체') || '';
      const 제출유형 = 물음.get('제출유형') || 설정모듈.오브젝트유형;
      const 그림체 = 설정모듈.그림체찾기(설정, 그림체이름);

      if (!그림체) {
        json응답(응답, { 오류: `"${그림체이름}" 그림체가 없어요.` }, 404);
        return;
      }
      json응답(응답, {
        그림체: 그림체.이름,
        제출유형,
        줄들: 프롬프트.미리보기(그림체, 제출유형, 설정.프롬프트문장),
      });
      return;
    }

    if (주소경로 === '/api/설정') {
      json응답(응답, {
        고정: 설정.고정,
        고정_왜: 설정.고정_왜,
        점유율: 설정모듈.점유율,
        여백px: 설정.여백px,
        알파임계값: 설정.알파임계값,
        유사도기준: 설정.유사도기준,
        결과폴더: 설정.결과폴더,
        플랫폼: 설정모듈.플랫폼,
        생성크기: 설정모듈.생성크기글(설정),
        AI: { ...설정.AI, 연결됨: AI.열쇠있나() },
        // 화면 1은 둘 다 보여주되 JPG는 회색으로 두고 "다음 범위"라고 적는다 (3장)
        제출유형: [설정모듈.오브젝트유형, 설정모듈.패턴유형],
        쓸수있는제출유형: 설정모듈.쓸수있는제출유형,
      });
      return;
    }

    if (주소경로 === '/api/그림체') {
      json응답(응답, { 그림체: 설정.그림체 });
      return;
    }

    json응답(응답, { 오류: '없는 주소예요: ' + 주소경로 }, 404);
  } catch (오류) {
    json응답(응답, { 오류: 오류.message }, 500);
  }
}

// ── 이미지 만들기 (계획서 12장) ────────────────────
//
// 한 세트 동안의 상태. 화면이 새로고침돼도 한도가 풀리지 않게 서버가 센다
const 만들기 = { 도는중: false, 멈춰: false, 부른수: 0 };

/**
 * 받은 PNG를 직접 재 본다 (12장 D).
 *
 * **우리가 보낸 값을 되풀이하지 않는다.** 2880을 달라고 했는데 1024가 왔어도
 * 요청값을 그대로 보여주면 확인이 아니라 자기 말 반복이다.
 *
 * 크기는 IHDR 26바이트로 읽고, 투명은 실제 알파를 본다 —
 * 알파 채널이 있어도 다 불투명이면 투명 배경이 아니다.
 */
async function 실제로잰것(버퍼, 설정) {
  let 가로 = null;
  let 세로 = null;
  try {
    if (버퍼.toString('latin1', 12, 16) === 'IHDR') {
      가로 = 버퍼.readUInt32BE(16);
      세로 = 버퍼.readUInt32BE(20);
    }
  } catch {
    /* 못 읽으면 null로 둔다. 모르는 것을 안다고 하지 않는다 */
  }

  // 알파 채널이 있어도 다 불투명이면 투명 배경이 아니다. 실제 픽셀을 본다.
  // 검사.js가 나중에 또 읽지만, 한 장에 3분 가까이 걸리는 일이라 문제가 되지 않는다
  let 투명있나 = null;
  try {
    const 그림 = await Jimp.read(버퍼);
    투명있나 = 픽셀.투명한데가있나(그림.bitmap, 설정.알파임계값);
  } catch {
    투명있나 = null;
  }

  return { 가로, 세로, 투명있나 };
}

/** OpenAI 오류를 사람 말로 바꾼다. 원문은 언제나 함께 보낸다 (12장) */
function 오류를사람말로(오류, 크기) {
  if (오류.크기거부) {
    return {
      말: `${크기.replace('x', '×')} 을 못 만든다고 해요. 아래가 OpenAI가 준 원문이에요.`,
      덧붙임: '설정에서 크기를 바꾸거나, 이 내용을 알려 주세요.',
      크기거부: true,
    };
  }
  if (오류.신원확인) {
    return {
      말: '이미지 모델을 쓰려면 OpenAI 개발자 콘솔에서 조직 신원 확인을 먼저 마쳐야 해요.',
      덧붙임: '확인을 마친 뒤 다시 눌러 주세요.',
    };
  }
  if (오류.잔액없음) {
    return {
      말: '잔액이 떨어졌어요. 자동 충전이 꺼져 있어 여기서 멈춰요.',
      덧붙임: 'OpenAI 대시보드에서 충전한 뒤 다시 눌러 주세요.',
    };
  }
  if (오류.너무잦음) {
    return { 말: '요청이 너무 잦다고 해요.', 덧붙임: '잠시 뒤 다시 눌러 주세요.' };
  }
  return { 말: '이미지를 만들지 못했어요.', 덧붙임: '' };
}

/**
 * 소재를 하나씩 만들며 진행 상황을 흘려보낸다 (SSE).
 *
 * 실패한 장은 건너뛰고 계속 간다. 어느 장이 왜 실패했는지 남긴다.
 * 다만 크기 거부 · 신원 확인 · 잔액 없음은 **다음 장도 똑같이 실패하므로** 거기서 멈춘다.
 */
async function 이미지만들기흘리기(항목들, 설정, 응답) {
  만들기.도는중 = true;
  만들기.멈춰 = false;

  응답.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const 크기 = 설정모듈.생성크기글(설정);
  const 보냄 = (갈래, 값) =>
    응답.write(`event: ${갈래}\ndata: ${JSON.stringify(값)}\n\n`);

  보냄('시작', { 모두: 항목들.length, 크기, 품질: 설정.AI.이미지품질, 모델: 설정.AI.이미지모델 });

  let 된수 = 0;
  const 실패들 = [];
  let 쓴것모음 = [];

  for (let 자리 = 0; 자리 < 항목들.length; 자리 += 1) {
    if (만들기.멈춰) {
      보냄('멈춤', { 자리, 된수 });
      break;
    }

    const 항목 = 항목들[자리];
    보냄('만드는중', { 자리, 아이템번호: 항목.아이템번호, 소재: 항목.소재 });

    let 결과 = null;
    let 마지막탈 = null;

    // 429는 잠시 뒤 한 번만 다시 시도한다 (12장)
    for (let 시도 = 0; 시도 < 2; 시도 += 1) {
      try {
        만들기.부른수 += 1;
        결과 = await AI.이미지뽑기({
          프롬프트: 항목.프롬프트,
          크기,
          품질: 설정.AI.이미지품질,
          모델: 설정.AI.이미지모델,
        });
        break;
      } catch (오류) {
        마지막탈 = 오류;
        if (오류.너무잦음 && 시도 === 0) {
          보냄('기다림', { 자리, 초: 20 });
          await new Promise((멈춤) => setTimeout(멈춤, 20_000));
          continue;
        }
        break;
      }
    }

    if (결과) {
      // **여기가 이음매다.** 사람이 놓은 파일과 같은 저장소에 같은 모양으로 들어간다.
      // 파일 이름은 화면 3이 이미 보여주는 이름 그대로라 짝짓기가 번호로 바로 맞춘다
      const 담은것 = 받은파일.담기(항목.파일명, 결과.버퍼, '프로그램');
      된수 += 1;
      if (결과.쓴것) 쓴것모음.push(결과.쓴것);

      // **받은 바이트에서 직접 읽는다.** 우리가 보낸 값을 되풀이하면 확인이 아니다 (12장 D)
      const 잰것 = await 실제로잰것(결과.버퍼, 설정);

      보냄('됨', {
        자리,
        아이템번호: 항목.아이템번호,
        소재: 항목.소재,
        아이디: 담은것.아이디,
        파일명: 항목.파일명,
        크기바이트: 담은것.크기,
        실제가로: 잰것.가로,
        실제세로: 잰것.세로,
        투명있나: 잰것.투명있나,
        쓴것: 결과.쓴것,
      });
      continue;
    }

    const 사람말 = 오류를사람말로(마지막탈, 크기);
    실패들.push({
      자리,
      아이템번호: 항목.아이템번호,
      소재: 항목.소재,
      말: 사람말.말,
      덧붙임: 사람말.덧붙임,
      원문: 마지막탈.원문 || 마지막탈.message,
    });

    보냄('실패', 실패들[실패들.length - 1]);

    // 다음 장도 똑같이 실패할 오류면 그 자리에서 멈춘다
    if (마지막탈.크기거부 || 마지막탈.신원확인 || 마지막탈.잔액없음) {
      보냄('멈춤', { 자리, 된수, 더못감: true, 까닭: 사람말.말 });
      break;
    }
  }

  보냄('끝', {
    된수,
    실패수: 실패들.length,
    실패들,
    부른수: 만들기.부른수,
    한도: 설정.AI.이미지호출한도,
    쓴것모음,
    모두: 받은파일.모두(),
  });

  만들기.도는중 = false;
  만들기.멈춰 = false;
  응답.end();
}

// 열쇠가 없으면 어디에 적어야 하는지 전체 경로로 알려 준다 (10장).
// 화면 2가 AI로 목록을 뽑으므로, 이걸 모르면 프로그램이 반쯤 멈춘 것처럼 보인다
function AI연결알림(설정) {
  if (AI.열쇠있나()) {
    console.log(`  AI 연결됨 — 목록 모델 ${설정.AI.목록모델}`);
    return;
  }

  console.log('');
  console.log('  AI 연결 안 됨 — 소재 목록을 자동으로 뽑지 못해요.');
  console.log('  (직접 적기로는 그대로 쓸 수 있어요)');
  console.log('');
  console.log('  아래 파일을 메모장으로 열어 OPENAI_API_KEY= 뒤에 열쇠를 붙여넣고,');
  console.log('  저장한 다음 이 창을 닫았다가 실행.bat 을 다시 실행하세요.');
  console.log('');
  console.log('    ' + 환경파일);
  console.log('');
  if (!fs.existsSync(환경파일)) {
    console.log('  (지금은 이 파일이 없어요. .env.example 을 복사해 만드세요)');
    console.log('');
  }
}

function 켜기(포트, 남은시도, 설정) {
  서버.once('error', (오류) => {
    if (오류.code === 'EADDRINUSE' && 남은시도 > 0) {
      console.log(`  ${포트}번은 이미 쓰는 중이라 ${포트 + 1}번으로 넘어갑니다.`);
      켜기(포트 + 1, 남은시도 - 1, 설정);
      return;
    }
    console.error('\n  서버를 켜지 못했어요:', 오류.message);
    process.exit(1);
  });

  const 호스트 = 온라인배포 ? '0.0.0.0' : '127.0.0.1';
  서버.listen(포트, 호스트, () => {
    const 주소 = process.env.RENDER_EXTERNAL_URL || `http://localhost:${포트}`;
    console.log('');
    console.log('  스톡 스튜디오가 켜졌어요.');
    console.log('  주소: ' + 주소);
    AI연결알림(설정);
    console.log('');
    console.log('  브라우저가 저절로 열려요. 안 열리면 위 주소를 직접 넣으세요.');
    console.log('  끄려면 이 검은 창을 닫거나 Ctrl+C 를 누르세요.');
    console.log('');
    if (!온라인배포) 브라우저열기(주소);
  });
}

function 브라우저열기(주소) {
  // start 는 첫 따옴표 인자를 창 제목으로 먹으므로 빈 제목을 하나 넣어준다
  spawn('cmd', ['/c', 'start', '', 주소], { detached: true, stdio: 'ignore' }).unref();
}

// 포트는 설정.json에서 온다 (계획서 10장). 초기값 3900
const 시작설정 = 설정모듈.읽기();
const 시작포트 = Number(process.env.PORT) || Number(시작설정.서버포트) || 3900;
켜기(시작포트, 온라인배포 ? 0 : 포트더시도, 시작설정);
