import { createFdAT, makeChunkBytes } from "./../utils/pngTools";
import { parseChunks, PNG_SIGNATURE_BYTES, createAcTL, createFcTL } from "../utils/pngTools";

interface Params {
  /* png buffers */
  buffers: ArrayBuffer[];
  /* play numbers, 0 represents for infinite loop and is default value */
  playNum?: number;
  /* currently all png frames are in the seem dimensions  */
  width: number;
  height: number;
}

/**
 * assemble png buffers to apng buffer
 * 根据png序列生产apng数据
 */
export function apngAssembler(params: Params) {
  const { buffers = [], playNum = 0, width, height } = params;
  const bb: BlobPart[] = [];

  /* 1. put PNG SIGNATURE in the first 8 bytes */
  bb.push(PNG_SIGNATURE_BYTES);

  // use first frame's IHDR, IEND, IDAT. Note that IDAT could be multiple chunks
  let IDATParts: Uint8Array[] = [];
  let IHDR: Uint8Array;
  let IEND: Uint8Array;
  parseChunks(new Uint8Array(buffers[0]), ({ type, bytes, off, length }) => {
    if (type === "IHDR") {
      /* off+8: 8 means length info (4) and chunk type info (4) */
      IHDR = bytes.subarray(off + 8, off + 8 + length);
    }
    if (type === "IDAT") {
      IDATParts.push(bytes.subarray(off + 8, off + 8 + length));
    }
    if (type === "IEND") {
      IEND = bytes.subarray(off + 8, off + 8 + length);
    }
    return true;
  });

  /* 2. put IHDR after PNG signature */
  bb.push(makeChunkBytes("IHDR", IHDR));

  /* 3. put acTL after IHDR */
  bb.push(createAcTL(buffers.length, playNum));

  /* 4. put first fcTL after acTL, first seq is 0 */
  bb.push(createFcTL({ seq: 0, width, height }));

  /* 5. put first frame's IDAT chunk, used as degraded image */
  for (let IDAT of IDATParts) {
    bb.push(makeChunkBytes("IDAT", IDAT));
  }

  /* 6. assemble each frame from the 2nd frame */
  // now the seq is 1 (0 seq is the first fcTL)
  let seq = 1;
  for (let i = 1; i < buffers.length; i++) {
    /* 6.1 push fcTL */
    bb.push(createFcTL({ seq, width, height }));
    // note that seq is shared by fcTL and fdAT, whenever push one of those chunk, seq should increase 1
    seq += 1;

    let iDatParts: Uint8Array[] = [];
    parseChunks(new Uint8Array(buffers[i]), ({ type, bytes, off, length }) => {
      if (type === "IDAT") {
        iDatParts.push(bytes.subarray(off + 8, off + 8 + length));
      }
      return true;
    });

    /* 6.2 push fdAT, use current buffer data */
    for (let j = 0; j < iDatParts.length; j++) {
      bb.push(createFdAT(seq, iDatParts[j]));
      seq++;
    }
  }

  /* 7. push last chunk--IEND */
  bb.push(makeChunkBytes("IEND", IEND));

  return new Blob(bb, { type: "image/apng" });
}
