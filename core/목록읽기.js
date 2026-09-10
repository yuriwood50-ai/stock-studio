// 투입 폴더의 세트.txt 읽기 (계획서 12장 개발 순서 2번)
//
// 탭이 있으면 탭 기준, 없으면 | 기준으로 나눈다. 빈 줄은 무시한다.
//
// **화면 2의 붙여넣기는 없앴다** (4장 · 0장 개정표). AI가 표를 채우므로
// 시트에서 옮겨 올 일이 없어졌고, /api/목록파싱도 같이 뺐다.
// 여기 남은 것은 `세트 정리.bat`(build.js)이 읽는 투입 폴더 입구다 — 다른 길이다.
// 목록파싱은 그 입구가 쓰는 내부 함수로만 남았다.

const { 오브젝트유형, 패턴유형 } = require('./설정');

function 줄나누기(한줄) {
  const 칸 = 한줄.includes('\t') ? 한줄.split('\t') : 한줄.split('|');
  return 칸.map((하나) => 하나.trim());
}

/** 여러 줄 글을 [{소재, 형태}] 로 */
function 목록파싱(글) {
  const 결과 = [];

  for (const 한줄 of String(글 || '').split(/\r?\n/)) {
    if (!한줄.trim()) continue;
    const 칸 = 줄나누기(한줄);
    if (!칸[0]) continue;
    결과.push({ 소재: 칸[0], 형태: 칸[1] || '' });
  }

  return 결과;
}

// 제출 유형을 적당히 알아듣는다
function 제출유형정리(값) {
  const 글 = String(값 || '').trim();
  if (!글) return 오브젝트유형;
  if (/패턴|배경 ?있|jpg|jpeg/i.test(글)) return 패턴유형;
  return 오브젝트유형;
}

/**
 * 투입 폴더의 세트.txt를 읽는다.
 *
 *   세트이름: 사무실 소품
 *   만들고 싶은 것: 아이콘형 사무실 소품 이미지
 *   그림체: 손그림동화
 *   제출유형: 투명 배경 · PNG
 *   세트번호:
 *
 *   소재
 *   스테이플러<탭>3/4 시점 · 무광 금속과 플라스틱
 */
function 세트글읽기(글) {
  const 줄들 = String(글 || '').split(/\r?\n/);
  const 머리 = {};
  const 목록줄 = [];
  let 목록칸인가 = false;

  for (const 한줄 of 줄들) {
    const 정리 = 한줄.trim();

    if (정리.startsWith('#') || (!목록칸인가 && !정리)) continue;

    if (!목록칸인가 && /^소재\s*$/.test(정리)) {
      목록칸인가 = true;
      continue;
    }

    if (목록칸인가) {
      목록줄.push(한줄);
      continue;
    }

    // 표 머리글을 그대로 붙여넣은 경우도 목록으로 본다
    if (한줄.includes('\t') || 한줄.includes('|')) {
      목록칸인가 = true;
      목록줄.push(한줄);
      continue;
    }

    const 자리 = 정리.indexOf(':');
    if (자리 > 0) 머리[정리.slice(0, 자리).trim()] = 정리.slice(자리 + 1).trim();
  }

  return {
    입력: 머리['만들고 싶은 것'] || 머리['입력'] || '',
    세트이름: 머리['세트이름'] || 머리['세트 이름'] || '',
    세트번호: (머리['세트번호'] || '').toUpperCase(),
    그림체이름: 머리['그림체'] || '',
    제출유형: 제출유형정리(머리['제출유형'] || 머리['제출 유형']),
    목록: 목록파싱(목록줄.join('\n')),
  };
}

module.exports = { 목록파싱, 줄나누기, 세트글읽기, 제출유형정리 };
