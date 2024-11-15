import { Writable } from "stream";
import { MediaUdp } from "../client/voice/MediaUdp";
declare class AudioStream extends Writable {
    udp: MediaUdp;
    count: number;
    sleepTime: number;
    startTime?: number;
    private noSleep;
    constructor(udp: MediaUdp, noSleep?: boolean);
    _write(chunk: any, _: BufferEncoding, callback: (error?: Error | null) => void): void;
}
export { AudioStream };
