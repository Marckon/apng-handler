/**
 * copied from apng-canvas https://github.com/davidmz/apng-canvas and rewrote it to typescript file
 * crc32 is appended to each chunk of png, it has a specific algorithm
 * you can find W3C's implementation sample here: https://www.w3.org/TR/PNG/#D-CRCAppendix
 * and this code is crc32 algorithm TS implementation
 * ---
 * crc32算法的TS实现，参考链接获取更多详情
 */
let table = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[i] = c;
}

/* generate a crc32 big number */
export function crc32(bytes: Uint8Array, start: number, length: number): number {
  start = start || 0;
  length = length || bytes.length - start;
  let crc = -1;
  for (let i = start, l = start + length; i < l; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  }
  return crc ^ -1;
}
