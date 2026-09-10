// 번호와 파일명 규칙 (계획서 8장)
//
//   세트번호    O 또는 P + 두 자리        O03
//   아이템번호  세트번호-두 자리          O03-01
//   파일명      아이템번호_소재명.확장자   O03-01_스테이플러.png
//   유사 표시   파일명 뒤 _check          O03-03_연필꽂이_check.png
//
// 파일명은 두 플랫폼(어도비스톡 · 미리캔버스) 모두 같은 것 하나만 쓴다.

const fs = require('fs');
const { 패턴유형 } = require('./설정');

// 윈도우 파일명에 못 쓰는 글자. 띄어쓰기는 여기 넣지 않는다 — 언더바로 바꿀 것이라서
const 창에서금지 = /[\\/:*?"<>|]/g;
const 안보이는글자 = new RegExp('[\u0000-\u001f\u007f]', 'g');

const 소재명최대 = 40;

// 제출 유형이 접두어를 정한다 — 오브젝트는 O, 패턴은 P
function 접두어(제출유형) {
  return 제출유형 === 패턴유형 ? 'P' : 'O';
}

// 결과 폴더를 읽어 같은 접두어 중 가장 큰 값 +1. 없으면 01부터
function 다음세트번호(결과폴더경로, 접두) {
  let 최대 = 0;

  if (fs.existsSync(결과폴더경로)) {
    for (const 이름 of fs.readdirSync(결과폴더경로)) {
      const 맞음 = 이름.match(/^([OP])(\d{2})(?:_|$)/);
      if (맞음 && 맞음[1] === 접두) 최대 = Math.max(최대, Number(맞음[2]));
    }
  }

  return 접두 + String(최대 + 1).padStart(2, '0');
}

function 세트번호맞나(값) {
  return /^[OP]\d{2}$/.test(String(값 || '').trim().toUpperCase());
}

function 세트번호있나(결과폴더경로, 세트번호) {
  if (!fs.existsSync(결과폴더경로)) return false;
  return fs
    .readdirSync(결과폴더경로)
    .some((이름) => 이름.toUpperCase().startsWith(세트번호.toUpperCase() + '_') ||
      이름.toUpperCase() === 세트번호.toUpperCase());
}

function 아이템번호(세트번호, 순번) {
  return `${세트번호}-${String(순번).padStart(2, '0')}`;
}

// 소재명을 파일명으로 바꾸는 규칙 (8장) — 순서대로 적용한다
function 소재명정리(소재) {
  const 정리 = String(소재 || '')
    .trim() //                      1. 앞뒤 공백을 뗀다
    .replace(안보이는글자, '')
    .replace(창에서금지, '') //      3. Windows 금지문자를 뺀다
    .replace(/\s+/g, '_') //         2. 띄어쓰기를 언더바로 바꾼다
    .replace(/^[._]+/, '')
    .replace(/[._]+$/, '') //        4. 끝의 마침표와 공백을 뗀다
    .slice(0, 소재명최대) //         5. 40자를 넘으면 자른다
    .replace(/[._]+$/, ''); //          자른 자리가 언더바로 끝나면 다시 뗀다

  return 정리 || '아이템'; //        6. 비면 아이템으로 채운다
}

/**
 * 세트 안에서 같은 소재명이 두 번 나오면 뒤에 -2, -3을 붙인다 (8장).
 * 아이템번호가 앞에 있어 실제로 겹치지는 않지만, 사람이 헷갈리므로 표시해 준다.
 * @param {string[]} 소재들
 * @returns {string[]} 정리된 이름
 */
function 소재명들정리(소재들) {
  const 센것 = new Map();

  return 소재들.map((소재) => {
    const 기본 = 소재명정리(소재);
    const 몇번째 = (센것.get(기본) || 0) + 1;
    센것.set(기본, 몇번째);
    return 몇번째 === 1 ? 기본 : `${기본}-${몇번째}`;
  });
}

// 세트 폴더 이름 — 세트이름의 띄어쓰기는 없앤다 (O03_사무실소품)
function 세트폴더이름(세트번호, 세트이름) {
  const 정리 = String(세트이름 || '')
    .trim()
    .replace(안보이는글자, '')
    .replace(창에서금지, '')
    .replace(/\s+/g, '')
    .replace(/^[.]+/, '')
    .replace(/[.]+$/, '')
    .slice(0, 소재명최대)
    .replace(/[.]+$/, '');
  return 정리 ? `${세트번호}_${정리}` : 세트번호;
}

function 확장자정리(파일명) {
  const 글 = String(파일명);
  const 점 = 글.lastIndexOf('.');
  if (점 < 0) return '.png';
  const 끝 = 글.slice(점).toLowerCase();
  return 끝 === '.jpeg' ? '.jpg' : 끝;
}

// 이미 정리된 소재명을 받는다 (소재명들정리를 거친 값)
function 파일명(항목번호, 정리된소재, 확장자, 유사표시 = false) {
  return `${항목번호}_${정리된소재}${유사표시 ? '_check' : ''}${확장자}`;
}

// 파일명에 _check가 붙었나
function 유사표시붙었나(이름) {
  return /_check(\.[^.]+)?$/i.test(String(이름));
}

// _check를 뗀 이름 — 업로드준비에는 이 이름으로 넣는다 (8장)
function 유사표시뗌(이름) {
  return String(이름).replace(/_check(?=\.[^.]+$|$)/i, '');
}

module.exports = {
  접두어,
  다음세트번호,
  세트번호맞나,
  세트번호있나,
  아이템번호,
  소재명정리,
  소재명들정리,
  세트폴더이름,
  확장자정리,
  파일명,
  유사표시붙었나,
  유사표시뗌,
  소재명최대,
};
