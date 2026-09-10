// PNG에 색공간과 해상도를 넣는다 (계획서 7장)
//
// jimp는 IHDR · IDAT · IEND 세 개만 쓴다. sRGB 선언도 dpi도 넣지 못한다.
// 그래서 png-chunks-extract / png-chunks-encode 로 청크를 직접 끼운다.
//
// 검사가 아니라 부여다. ChatGPT가 주는 PNG에는 이 청크가 대개 없어서
// "sRGB인가"를 물으면 전량 제외된다. 그래서 묻지 않고 써 넣는다.

const 청크뽑기 = require('png-chunks-extract');
const 청크넣기 = require('png-chunks-encode');

const 인치당미터 = 0.0254;

// sRGB 청크가 있으면 gAMA도 함께 두는 것이 PNG 규격의 권고다.
// sRGB의 감마는 1/2.2 를 100000배 한 45455로 정해져 있다.
const sRGB감마 = 45455;

// 0 = Perceptual. 그림에 쓰는 기본값
const 렌더링의도 = 0;

function 네바이트(값) {
  const 통 = Buffer.alloc(4);
  통.writeUInt32BE(값 >>> 0);
  return 통;
}

function sRGB청크() {
  return { name: 'sRGB', data: new Uint8Array([렌더링의도]) };
}

function gAMA청크() {
  return { name: 'gAMA', data: new Uint8Array(네바이트(sRGB감마)) };
}

// pHYs — 미터당 픽셀 수로 적는다. 단위 1은 미터
function pHYs청크(해상도dpi) {
  const 미터당픽셀 = Math.round(해상도dpi / 인치당미터);
  return {
    name: 'pHYs',
    data: new Uint8Array(
      Buffer.concat([네바이트(미터당픽셀), 네바이트(미터당픽셀), Buffer.from([1])])
    ),
  };
}

/**
 * PNG 버퍼에 sRGB · gAMA · pHYs를 넣는다.
 * 이미 있던 색공간·해상도 청크는 지우고 새로 넣는다.
 * 셋 다 IHDR 바로 뒤, IDAT 앞에 와야 한다 (PNG 규격).
 */
function 색공간과해상도넣기(png버퍼, 해상도dpi) {
  const 청크들 = 청크뽑기(png버퍼);
  const 지울것 = new Set(['sRGB', 'iCCP', 'gAMA', 'cHRM', 'pHYs']);
  const 남긴것 = 청크들.filter((하나) => !지울것.has(하나.name));

  const 아이에이치 = 남긴것.findIndex((하나) =>하나.name === 'IHDR');
  if (아이에이치 < 0) throw new Error('PNG가 아니에요 (IHDR이 없어요).');

  남긴것.splice(아이에이치 + 1, 0, sRGB청크(), gAMA청크(), pHYs청크(해상도dpi));
  return Buffer.from(청크넣기(남긴것));
}

// 확인용 — 어떤 청크가 들어 있나
function 청크이름들(png버퍼) {
  return 청크뽑기(png버퍼).map((하나) => 하나.name);
}

// 확인용 — pHYs에 적힌 dpi를 되읽는다
function dpi읽기(png버퍼) {
  const 찾음 = 청크뽑기(png버퍼).find((하나) => 하나.name === 'pHYs');
  if (!찾음) return null;
  const 통 = Buffer.from(찾음.data);
  if (통[8] !== 1) return null; // 단위가 미터가 아니면 dpi로 못 바꾼다
  return Math.round(통.readUInt32BE(0) * 인치당미터);
}

module.exports = { 색공간과해상도넣기, 청크이름들, dpi읽기, 인치당미터 };
