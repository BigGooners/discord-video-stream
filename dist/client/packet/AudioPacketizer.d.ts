import { MediaUdp } from "../voice/MediaUdp";
import { BaseMediaPacketizer } from "./BaseMediaPacketizer";
export declare class AudioPacketizer extends BaseMediaPacketizer {
    constructor(connection: MediaUdp);
    sendFrame(frame: any): void;
    createPacket(chunk: any): Buffer;
    onFrameSent(bytesSent: number): void;
}
