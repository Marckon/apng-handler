import { crc32 } from "./crc32";
import { bytes2String, decimal2Bytes, string2IntArray } from "./uint8Tools";
/**
 * @file tool functions to operate png
 */

import { bytes2Decimal } from "./uint8Tools";

/**
 * png signature is placed in the very first of png stream
 * png 签名字节数组，位于文件首部（8个字节）
 */
export const PNG_SIGNATURE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// const PNG_SIGNATURE_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * apng chunk type, this is not covered whole png chunk type
 * apng块类型, 尚未包含全部的png块类型
 *
 * acTL: apng特有 动画控制块
 * fcTL: apng特有 帧控制块
 * fdAT: apng特有 帧数据块
 * IDAT: 图片数据块
 * IEND: 图片尾部块，表示png流最后一个块
 * IHDR: 图片头部，第一个png流数据块
 * PLTE: 与索引的PNG图像关联的调色板表
 * */
export type ChunkType = "acTL" | "fcTL" | "IDAT" | "fdAT" | "IEND" | "IHDR" | "PLTE" | "tEXt";

/**
 * validate apng file
 */
export function validateAPNG(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    for (var i = 0; i < PNG_SIGNATURE_BYTES.length; i++) {
      if (PNG_SIGNATURE_BYTES[i] != bytes[i]) {
        return reject();
      }
    }

    parseChunks(bytes, ({ type }) => {
      if (type == "acTL") {
        resolve();
        return false;
      }
      return true;
    });

    reject();
  });
}

interface CBParam {
  type: ChunkType;
  /* original data bytes */
  bytes: Uint8Array;
  off: number;
  length: number;
}
/**
 * handle png chunks, call the fun param whenever encountering a chunk
 * 处理png的字节数据，会在遇到一个chunk的时候调用fun回调
 * @param bytes png data
 * @param fun a callback to handle chunk
 */
export function parseChunks(bytes: Uint8Array, fun: ({ type, bytes, off, length }: CBParam) => boolean | undefined) {
  // exclude 8 bytes of PNG signature
  let off = 8;
  let type: ChunkType;
  let res = true;
  do {
    // length information is at the first 4 bytes of a chunk
    // length is not calculating itself, chunkType and crc32 chunks byte length, which is 12 bytes in total
    const length = bytes2Decimal(bytes, off);

    // chunk type is placed after length bytes and its length is 4 bytes
    type = bytes2String(bytes, off + 4, 4) as ChunkType;

    // should stopped
    res = fun(type, bytes, off, length);

    off += 12 + length;
  } while (res !== false && type != "IEND" && off < bytes.length);
}

/**
 * make chunk bytes
 * 创建chunk字节数组
 * @param type chunk type
 * @param dataBytes data bytes, not including length, chunkType and crc32
 */
export const makeChunkBytes = function (type: ChunkType, dataBytes: Uint8Array) {
  var crcLen = type.length + dataBytes.length;
  var bytes = new Uint8Array(new ArrayBuffer(crcLen + 8));
  // 1. put length info
  bytes.set(decimal2Bytes(dataBytes.length), 0);
  // 2. put chunk type info
  bytes.set(string2IntArray(type), 4);
  // 3. put data
  bytes.set(dataBytes, 8);
  var crc = crc32(bytes, 4, crcLen);
  // 4. append crc32
  bytes.set(decimal2Bytes(crc), crcLen + 4);
  return bytes;
};

/**
 * create acTL chunk bytes
 * 创建acTL块
 * @param numFrames frame numbers
 * @param numPlay play numbers 0 means infinite loop
 */
export function createAcTL(numFrames: number, numPlay: number) {
  const dataBytes = new Uint8Array(8);
  dataBytes.set(decimal2Bytes(numFrames), 0);
  dataBytes.set(decimal2Bytes(numPlay), 4);
  return makeChunkBytes("acTL", dataBytes);
}

/**
 * @see https://wiki.mozilla.org/APNG_Specification#.60fcTL.60:_The_Frame_Control_Chunk
 * 渲染下一帧前如何处理当前帧
 */
export enum DisposeOP {
  /* 在渲染下一帧之前不会对此帧进行任何处理；输出缓冲区的内容保持不变。 */
  NONE,
  /* 在渲染下一帧之前，将输出缓冲区的帧区域清除为完全透明的黑色。 */
  TRANSPARENT,
  /* 在渲染下一帧之前，将输出缓冲区的帧区域恢复为先前的内容。 */
  PREVIOUS,
}

/**
 * @see https://wiki.mozilla.org/APNG_Specification#.60fcTL.60:_The_Frame_Control_Chunk
 * 当前帧渲染时的混合模式
 */
export enum BlendOP {
  /* 该帧的所有颜色分量（包括alpha）都将覆盖该帧的输出缓冲区的当前内容 */
  SOURCE,
  /* 直接覆盖 */
  OVER,
}

export interface Frame {
  /* sequence number */
  seq: number;
  /* frame width */
  width: number;
  /* frame height */
  height: number;
  /* offset X default is 0 */
  left?: number;
  /* offset Y default is 0 */
  top?: number;
  /* Frame delay fraction numerator */
  delayN?: number;
  /* Frame delay fraction denominator */
  delayD?: number;
  dispose?: DisposeOP;
  blend?: BlendOP;
  delay?: number;
  dataParts?: Uint8Array[];
}
/* 创建fcTL块 */
export function createFcTL(param: Frame) {
  const {
    seq,
    width,
    height,
    left = 0,
    top = 0,
    delayN = 1,
    delayD = 10,
    dispose = DisposeOP.TRANSPARENT,
    blend = BlendOP.SOURCE,
  } = param;
  const dataBytes = new Uint8Array(26);
  dataBytes.set(decimal2Bytes(seq), 0);
  dataBytes.set(decimal2Bytes(width), 4);
  dataBytes.set(decimal2Bytes(height), 8);
  dataBytes.set(decimal2Bytes(left), 12);
  dataBytes.set(decimal2Bytes(top), 16);
  dataBytes.set(decimal2Bytes(delayN, 2), 20);
  dataBytes.set(decimal2Bytes(delayD, 2), 22);
  dataBytes.set(decimal2Bytes(dispose, 1), 24);
  dataBytes.set(decimal2Bytes(blend, 1), 25);
  return makeChunkBytes("fcTL", dataBytes);
}

/**
 * create fdAT based on current IDAT chunk data bytes
 * 创建fdAT，根据当前图片的idat
 * @param seq sequence number
 * @param iDat IDAT data bytes
 */
export function createFdAT(seq: number, iDat: Uint8Array) {
  const dataBytes = new Uint8Array(4 + iDat.length);
  dataBytes.set(decimal2Bytes(seq), 0);
  dataBytes.set(iDat, 4);
  return makeChunkBytes("fdAT", dataBytes);
}
