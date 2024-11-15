"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioPacketizer = void 0;
const BaseMediaPacketizer_1 = require("./BaseMediaPacketizer");
const frame_size = (48000 / 100) * 2;
class AudioPacketizer extends BaseMediaPacketizer_1.BaseMediaPacketizer {
    constructor(connection) {
        super(connection, 0x78);
        this.srInterval = 5 * 48000 / frame_size; // ~5 seconds
    }
    sendFrame(frame) {
        super.sendFrame(frame);
        const packet = this.createPacket(frame);
        this.mediaUdp.sendPacket(packet);
        this.onFrameSent(packet.length);
    }
    createPacket(chunk) {
        const header = this.makeRtpHeader();
        const nonceBuffer = this.mediaUdp.getNewNonceBuffer();
        return Buffer.concat([header, this.encryptData(chunk, nonceBuffer), nonceBuffer.subarray(0, 4)]);
    }
    onFrameSent(bytesSent) {
        super.onFrameSent(1, bytesSent);
        this.incrementTimestamp(frame_size);
    }
}
exports.AudioPacketizer = AudioPacketizer;
