import { Frame, makeChunkBytes, PNG_SIGNATURE_BYTES } from "./../utils/pngTools";
import { bytes2Decimal, decimal2Bytes } from "./../utils/uint8Tools";
/**
 * @file same thoughts as apng-js
 */

import { parseChunks, validateAPNG } from "../utils/pngTools";

interface Anim {
  width?: number;
  height?: number;
  numFrames?: number;
  numPlays?: number;
  playTime?: number;
  /* data needed to assemble to a png */
  frames: Frame[];
}

function assemblePNG(preBlob: Blob, postBlob: Blob, IHDR: Uint8Array, anim: Anim) {
  const res: Blob[] = [];

  for (let frame of anim.frames) {
    let bb: BlobPart[] = [];

    /* 1. push signature */
    bb.push(PNG_SIGNATURE_BYTES);

    /* 2. create IHDR */
    IHDR.set(decimal2Bytes(frame.width), 0);
    IHDR.set(decimal2Bytes(frame.height), 4);
    bb.push(makeChunkBytes("IHDR", IHDR));

    /* 3. push other chunks that we may not handled like PLTE  */
    bb.push(preBlob);

    /* 4. generate IDAT from fdAT and push in to bb */
    for (let IDATData of frame.dataParts) {
      bb.push(makeChunkBytes("IDAT", IDATData));
    }

    /* 5. push post blob */
    bb.push(postBlob);

    res.push(new Blob(bb, { type: "image/png" }));
  }

  return res;
}

export function apngDecoder(buffer: ArrayBuffer): Promise<Blob[]> {
  const bytes = new Uint8Array(buffer);

  return new Promise((resolve, reject) => {
    validateAPNG(bytes)
      .then(() => {
        const preDataParts: Uint8Array[] = [];
        const postDataParts: Uint8Array[] = [];
        let headerDataBytes: Uint8Array = null;
        let anim: Anim = { frames: [] };
        /* current frame */
        let frame: Frame = null;

        parseChunks(bytes, ({ type, bytes, off, length }) => {
          switch (type) {
            case "IHDR":
              /* off+8: 8 means length info (4) and chunk type info (4) */
              headerDataBytes = bytes.subarray(off + 8, off + 8 + length);
              anim.width = bytes2Decimal(bytes, off + 8);
              anim.height = bytes2Decimal(bytes, off + 12);
              return true;
            case "acTL":
              anim.numFrames = bytes2Decimal(bytes, off + 8);
              anim.numPlays = bytes2Decimal(bytes, off + 12);
              return true;
            case "fcTL":
              if (frame) anim.frames.push(frame);
              const delayN = bytes2Decimal(bytes, off + 8 + 20, 2);
              let delayD = bytes2Decimal(bytes, off + 8 + 22, 2);
              /* If the denominator is 0, it is to be treated as if it were 100 (that is, `delay_num` then specifies 1/100ths of a second) */
              if (delayD === 0) delayD = 100;

              frame = {
                seq: bytes2Decimal(bytes, off + 8),
                width: bytes2Decimal(bytes, off + 8 + 4),
                height: bytes2Decimal(bytes, off + 8 + 8),
                left: bytes2Decimal(bytes, off + 8 + 12),
                top: bytes2Decimal(bytes, off + 8 + 16),
                delay: (1000 * delayN) / delayD <= 10 ? 100 : (1000 * delayN) / delayD,
                dispose: bytes[off + 8 + 24],
                blend: bytes[off + 8 + 25],
                dataParts: [],
              };
              anim.playTime += frame.delay;

              return true;
            case "fdAT":
              if (frame) frame.dataParts.push(bytes.subarray(off + 8 + 4, off + 8 + length));
              return true;
            case "IDAT":
              if (frame) frame.dataParts.push(bytes.subarray(off + 8, off + 8 + length));
              return true;
            case "IEND":
              postDataParts.push(bytes.subarray(off, off + 12 + length));
              return true;
            default:
              preDataParts.push(bytes.subarray(off, off + 12 + length));
              return true;
          }
        });

        /* put last frame */
        if (frame) anim.frames.push(frame);

        if (anim.frames.length == 0) {
          return reject("Not an animated PNG");
        }

        return resolve(assemblePNG(new Blob(preDataParts), new Blob(postDataParts), headerDataBytes, anim));
      })
      .catch(() => {
        reject("not apng file");
      });
  });
}
