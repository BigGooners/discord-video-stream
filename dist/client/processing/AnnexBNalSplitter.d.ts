import { Transform, TransformCallback } from "stream";
import { type AnnexBHelpers } from "./AnnexBHelper";
/**
 * Outputs a buffer containing length-delimited nalu units
 * that belong to the same access unit.
 * Expects an Annex B bytestream as input.
 *
 * In an Annex B stream, 1 frame is equal to 1 access unit, and an access
 * unit is composed of 1 to n Nal units
 */
declare class AnnexBNalSplitter extends Transform {
    private _buffer;
    private _accessUnit;
    protected _nalFunctions: AnnexBHelpers;
    /**
     * Removes emulation prevention bytes from a nalu frame
     * @description there are chances that 0x000001 or 0x00000001 exists in the bitstream of a NAL unit.
     * So a emulation prevention bytes, 0x03, is presented when there is 0x000000, 0x000001, 0x000002 and 0x000003
     * to make them become 0x00000300, 0x00000301, 0x00000302 and 0x00000303 respectively
     * @param data
     * @returns frame with emulation prevention bytes removed
     */
    rbsp(data: Buffer): Buffer;
    /**
     * Finds the first NAL unit header in a buffer as efficient as possible
     * @param buf buffer of data
     * @returns the index of the first NAL unit header and its length
     */
    findNalStart(buf: Buffer): {
        index: number;
        length: number;
    } | null;
    removeEpbs(frame: Buffer, unitType: number): Buffer;
    processFrame(frame: Buffer): void;
    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void;
}
export declare class H264NalSplitter extends AnnexBNalSplitter {
    constructor();
    removeEpbs(frame: Buffer, unitType: number): Buffer;
}
export declare class H265NalSplitter extends AnnexBNalSplitter {
    constructor();
    removeEpbs(frame: Buffer, unitType: number): Buffer;
}
export {};
