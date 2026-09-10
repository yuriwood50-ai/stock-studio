// 만들어진 결과 폴더를 화면 4에 보여주기 위해 읽는다 (계획서 9장)
//
// - 폴더 구조 트리. _check 파일은 색을 달리 표시할 수 있게 표시를 붙인다
// - 통과한 이미지 목록 (썸네일 주소로 쓸 상대 경로)
// - 결과 폴더 열기 — 탐색기에서 실제 폴더를 연다
//
// 결과 폴더 밖은 읽지도 열지도 않는다.

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const 이름 = require('./이름');

/** 결과 폴더 안쪽인가 — 밖으로 나가는 경로는 막는다 */
function 안쪽인가(결과폴더, 대상) {
  const 뿌리 = path.resolve(결과폴더);
  const 곳 = path.resolve(대상);
  return 곳 === 뿌리 || 곳.startsWith(뿌리 + path.sep);
}

/**
 * 폴더 트리를 읽는다.
 * @returns {{이름, 폴더인가, 유사표시, 크기, 상대경로, 안에}}
 */
function 트리읽기(뿌리, 지금 = 뿌리, 깊이 = 0) {
  const 상대경로 = path.relative(뿌리, 지금).split(path.sep).join('/');
  const 잰것 = fs.statSync(지금);

  if (!잰것.isDirectory()) {
    return {
      이름: path.basename(지금),
      폴더인가: false,
      유사표시: 이름.유사표시붙었나(path.basename(지금)),
      크기: 잰것.size,
      상대경로,
    };
  }

  const 안에 = [];
  if (깊이 < 6) {
    const 목록 = fs.readdirSync(지금).sort((가, 나) => {
      const 가폴더 = fs.statSync(path.join(지금, 가)).isDirectory();
      const 나폴더 = fs.statSync(path.join(지금, 나)).isDirectory();
      if (가폴더 !== 나폴더) return 가폴더 ? -1 : 1;
      return 가.localeCompare(나, 'ko', { numeric: true });
    });

    for (const 하나 of 목록) {
      안에.push(트리읽기(뿌리, path.join(지금, 하나), 깊이 + 1));
    }
  }

  return {
    이름: path.basename(지금) || '.',
    폴더인가: true,
    유사표시: false,
    상대경로,
    안에,
  };
}

/**
 * PNG 머리에서 가로·세로만 읽는다 — 24바이트면 된다.
 *
 * 파일 전체를 디코딩할 필요가 없다. IHDR 청크는 늘 맨 앞에 있고
 * 16~23바이트가 가로·세로다.
 */
function png크기(길) {
  let 손 = null;
  try {
    손 = fs.openSync(길, 'r');
    const 머리 = Buffer.alloc(24);
    const 읽음 = fs.readSync(손, 머리, 0, 24, 0);
    if (읽음 < 24) return null;
    // \x89PNG\r\n\x1a\n 로 시작하고 8바이트 뒤가 IHDR 이어야 한다
    if (머리.toString('latin1', 1, 4) !== 'PNG' || 머리.toString('latin1', 12, 16) !== 'IHDR') {
      return null;
    }
    return { 가로: 머리.readUInt32BE(16), 세로: 머리.readUInt32BE(20) };
  } catch {
    return null;
  } finally {
    if (손 !== null) {
      try {
        fs.closeSync(손);
      } catch {
        /* 이미 닫혔으면 그만 */
      }
    }
  }
}

/** 그 세트를 만들 때 쓴 조건 — 00_세트정보/세트.json 에 남아 있다 (8장) */
function 세트정보읽기(세트폴더) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(세트폴더, '00_세트정보', '세트.json'), 'utf8')
    );
  } catch {
    return null;
  }
}

/**
 * 03_이미지 안의 통과한 파일들 — 썸네일로 보여줄 것 (9장)
 *
 * **눈으로 재게 하지 않는다.** 크기 · 넓이 · 여백 · 갈 곳을 숫자로 딸려 보낸다.
 * 여백은 그 세트를 만들 때 쓴 값이라 세트.json 에서 읽는다 —
 * 설정을 나중에 바꿔도 이 세트의 값은 그대로여야 한다.
 */
function 이미지목록(세트폴더, 설정) {
  const 이미지폴더 = path.join(세트폴더, '03_이미지');
  if (!fs.existsSync(이미지폴더)) return [];

  const 세트정보 = 세트정보읽기(세트폴더);
  const 조건 = (세트정보 && 세트정보.생성조건) || {};
  const 여백px = 조건.여백px != null ? 조건.여백px : (설정 && 설정.여백px);
  const 최소MP = 조건.최소크기MP != null ? 조건.최소크기MP : 4;

  return fs
    .readdirSync(이미지폴더)
    .filter((하나) => /\.(png|jpe?g)$/i.test(하나))
    .sort((가, 나) => 가.localeCompare(나, 'ko', { numeric: true }))
    .map((하나) => {
      const 길 = path.join(이미지폴더, 하나);
      const 잰것 = png크기(길);
      const 넓이MP = 잰것 ? (잰것.가로 * 잰것.세로) / 1_000_000 : null;

      return {
        이름: 하나,
        유사표시: 이름.유사표시붙었나(하나),
        상대경로: '03_이미지/' + 하나,
        크기: fs.statSync(길).size,
        가로: 잰것 ? 잰것.가로 : null,
        세로: 잰것 ? 잰것.세로 : null,
        넓이MP,
        여백px,
        // 4MP를 넘으면 양쪽, 못 넘으면 미리캔버스만 (7장 10번).
        // 짧은 축 700px 미만은 애초에 여기 없다 — 제외됐다
        어디에: 넓이MP == null ? null : 넓이MP >= 최소MP ? '양쪽' : '미리캔버스',
      };
    });
}

/**
 * 탐색기에서 실제 폴더를 연다 (9장)
 *
 * 앞 판은 `detached: true` + `unref()` 로 완전히 끊어 보냈는데, 그러면 안 열렸다.
 * explorer.exe 는 실행 직후 **다른 프로세스에 일을 넘기고 스스로 끝난다.**
 * 끊긴 상태에서 그 넘김이 실패하면 창이 안 뜨는데, `error` 이벤트도 안 듣고 있어서
 * 서버는 성공했다고 답했다. 눌러도 아무 일이 없고 아무 말도 없었던 이유다.
 *
 * 지금은
 *   - 끊어 보내지 않는다 (detached · unref 안 씀)
 *   - 절대 경로로 넘긴다. 경로에 한글이 있어 상대 경로면 엉뚱한 데를 연다
 *   - `error` 를 듣는다. 실행 자체가 안 되면 start 로 한 번 더 해 보고, 그것도 안 되면 던진다
 *   - 종료 코드는 그대로 무시한다 — explorer.exe 는 성공해도 1을 준다
 */
function 탐색기로열기(경로) {
  const 절대경로 = path.resolve(경로);

  return new Promise((풀림, 깨짐) => {
    console.log(`  탐색기 열기: explorer.exe "${절대경로}"`);

    let 끝났나 = false;
    const 아이 = spawn('explorer.exe', [절대경로], { stdio: 'ignore' });

    아이.on('error', (오류) => {
      if (끝났나) return;
      끝났나 = true;
      console.warn(`  explorer.exe 를 실행하지 못했어요: ${오류.message}`);
      console.warn('  start 로 다시 해 봅니다.');

      // 대체 방법 — 셸의 start 로 한 번 더
      exec(`start "" "${절대경로}"`, { shell: true }, (탈) => {
        if (!탈) {
          console.log('  start 로 열었습니다.');
          풀림({ 방법: 'start', 경로: 절대경로 });
          return;
        }
        console.error(`  폴더를 열지 못했어요: ${절대경로}`);
        console.error(`  까닭: ${탈.message}`);
        깨짐(new Error(`폴더를 열지 못했어요: ${절대경로}`));
      });
    });

    // 창이 뜨는 것까지 기다리지 않는다. 실행이 걸리지 않고 넘어가면 된 것으로 본다
    아이.on('spawn', () => {
      if (끝났나) return;
      끝났나 = true;
      풀림({ 방법: 'explorer', 경로: 절대경로 });
    });
  });
}

module.exports = { 안쪽인가, 트리읽기, 이미지목록, 탐색기로열기 };
