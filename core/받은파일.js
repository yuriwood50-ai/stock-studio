// 화면 3에서 받은 파일을 잠시 두는 곳 (계획서 6장)
//
// 브라우저가 ZIP을 풀 수 없다 (2장이 고른 adm-zip은 서버 쪽 라이브러리다).
// 그래서 받자마자 서버로 올려 여기에 풀어 두고, 화면은 미리보기만 받아 간다.
// 정리 시작을 누르면 여기 있는 파일로 세트를 만든다.
//
// 파일을 나눠 받아도 되므로 (6장 7번) 계속 쌓인다. 세트를 만들고 나면 비운다.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const 둘곳 = path.join(os.tmpdir(), 'stock-studio-받은파일');

const 이미지확장자 = new Set(['.png', '.jpg', '.jpeg']);
const 압축확장자 = new Set(['.zip']);

// 아이디 → {아이디, 원래이름, 경로, 크기, 어디서}
const 담은것 = new Map();

function 폴더준비() {
  fs.mkdirSync(둘곳, { recursive: true });
}

function 새아이디() {
  return crypto.randomBytes(8).toString('hex');
}

function 이미지인가(이름) {
  return 이미지확장자.has(path.extname(이름).toLowerCase());
}

function 압축인가(이름) {
  return 압축확장자.has(path.extname(이름).toLowerCase());
}

// 맥에서 압축하면 __MACOSX 와 . 로 시작하는 것이 딸려 온다. 걸러 낸다
function 쓸모없나(안쪽이름) {
  return 안쪽이름
    .split(/[\\/]/)
    .some((조각) => 조각 === '__MACOSX' || 조각.startsWith('.'));
}

function 담기(원래이름, 덩이, 어디서) {
  폴더준비();
  const 아이디 = 새아이디();
  const 확장자 = path.extname(원래이름).toLowerCase();
  const 경로 = path.join(둘곳, 아이디 + 확장자);

  fs.writeFileSync(경로, 덩이);

  const 하나 = {
    아이디,
    원래이름,
    경로,
    크기: 덩이.length,
    어디서: 어디서 || '직접',
  };
  담은것.set(아이디, 하나);
  return 하나;
}

/**
 * 파일 하나를 받는다. ZIP이면 풀어서 안의 이미지를 쓴다 (6장).
 * @returns {{담은것: object[], 넘긴것: string[]}}
 */
function 받기(원래이름, 덩이) {
  const 담음 = [];
  const 넘김 = [];

  if (압축인가(원래이름)) {
    let 압축;
    try {
      압축 = new AdmZip(덩이);
    } catch {
      넘김.push(`${원래이름} — 압축을 열지 못했어요`);
      return { 담은것: 담음, 넘긴것: 넘김 };
    }

    for (const 안쪽 of 압축.getEntries()) {
      if (안쪽.isDirectory) continue;
      if (쓸모없나(안쪽.entryName)) continue;

      const 안쪽이름 = path.basename(안쪽.entryName);
      if (!이미지인가(안쪽이름)) {
        넘김.push(`${안쪽이름} — 이미지가 아니에요`);
        continue;
      }
      담음.push(담기(안쪽이름, 안쪽.getData(), 원래이름));
    }

    if (담음.length === 0 && 넘김.length === 0) {
      넘김.push(`${원래이름} — 안에 이미지가 없어요`);
    }
    return { 담은것: 담음, 넘긴것: 넘김 };
  }

  if (!이미지인가(원래이름)) {
    넘김.push(`${원래이름} — 이미지도 압축도 아니에요`);
    return { 담은것: 담음, 넘긴것: 넘김 };
  }

  담음.push(담기(원래이름, 덩이));
  return { 담은것: 담음, 넘긴것: 넘김 };
}

function 모두() {
  return [...담은것.values()].map((하나) => ({
    아이디: 하나.아이디,
    원래이름: 하나.원래이름,
    크기: 하나.크기,
    어디서: 하나.어디서,
  }));
}

function 하나찾기(아이디) {
  return 담은것.get(아이디) || null;
}

function 버리기(아이디) {
  const 하나 = 담은것.get(아이디);
  if (!하나) return false;
  try {
    fs.unlinkSync(하나.경로);
  } catch {
    /* 이미 없으면 그만 */
  }
  담은것.delete(아이디);
  return true;
}

function 비우기() {
  for (const 아이디 of [...담은것.keys()]) 버리기(아이디);
}

// 담기를 내보내는 이유 — 프로그램이 만든 이미지도 **같은 저장소**에 들어가야 한다 (12장).
// 사람이 가져온 것과 프로그램이 만든 것이 여기서 하나로 합쳐지고,
// 그 뒤 짝짓기 · 검사 · 폴더는 어느 쪽인지 모른 채 똑같이 돈다.
// 어디서에 '프로그램'을 넣으면 나중에 무엇으로 만든 세트인지 셀 수 있다 (9장).
module.exports = { 받기, 담기, 모두, 하나찾기, 버리기, 비우기, 둘곳, 이미지인가, 압축인가 };
