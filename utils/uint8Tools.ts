/**
 * @file contains common tools to operate Uint8Array
 */

/**
 * transfer bytes slice to decimal number
 * 将Uint8Array字节数组的部分切片转换为一个十进制数
 * @param bytes Uint8Array to operate
 * @param off start index
 * @param bLen how many bytes represent for the number, default is 4
 */
export const bytes2Decimal = function (bytes: Uint8Array, off: number, bLen = 4) {
  let x = 0;
  // Force the most-significant byte to unsigned.
  x += (bytes[0 + off] << 24) >>> 0;
  for (let i = 1; i < bLen; i++) x += bytes[i + off] << ((3 - i) * 8);
  return x;
};

/**
 * transfer bytes slice to decimal number
 * @description: if you don't understand bytes2Decimal above, then this function shows
 * a more readable approach.
 */
export const _bytes2Decimal = (bytes: Uint8Array, off: number, bLen = 4) => {
  let x = "";
  for (let i = off; i < off + bLen; i++) {
    x += ("00000000" + bytes[i].toString(2)).slice(-8);
  }
  return parseInt(x, 2);
};

/**
 * transfer bytes slice to string
 * 从字节数组中给定的位置截取并转换为一个字符串
 * @param bytes Uint8Array to operate
 * @param off start index
 * @param bLen how many bytes represent for the string
 */
export const bytes2String = function (bytes: Uint8Array, off: number, bLen: number) {
  const chars = bytes.subarray(off, off + bLen);
  return String.fromCharCode(...chars);
};

/**
 * transfer decimal number to 8-bit integer array
 * 将十进制数转换为8位二进制字节数组
 * @param x number to transfer
 * @param bLen how many bytes represent for the number, default is 4
 */
export const decimal2Bytes = function (x: number, bLen = 4) {
  const res: Array<number> = [];
  for (let i = 0; i < bLen; i++) {
    res.unshift((x >>> (i * 8)) & 0xff);
  }
  return res;
};

/**
 * transfer string to int array
 * 字符串转整型数组
 */
export const string2IntArray = (str: string) => {
  let res = [];
  for (let i = 0; i < str.length; i++) res.push(str.charCodeAt(i));
  return res;
};
