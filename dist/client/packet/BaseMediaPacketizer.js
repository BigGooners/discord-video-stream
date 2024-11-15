"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMediaPacketizer = exports.max_int32bit = exports.max_int16bit = void 0;
const libsodium_wrappers_1 = require("libsodium-wrappers");
exports.max_int16bit = Math.pow(2, 16);
exports.max_int32bit = Math.pow(2, 32);
const ntpEpoch = new Date("Jan 01 1900 GMT").getTime();
class BaseMediaPacketizer {
    constructor(connection, payloadType, extensionEnabled = false) {
        this._mediaUdp = connection;
        this._payloadType = payloadType;
        this._sequence = 0;
        this._timestamp = 0;
        this._totalBytes = 0;
        this._prevTotalPackets = 0;
        this._mtu = 1200;
        this._extensionEnabled = extensionEnabled;
        this._ssrc = 0;
        this._srInterval = 512; // Sane fallback value for interval
    }
    get ssrc() {
        return this._ssrc;
    }
    set ssrc(value) {
        this._ssrc = value;
        this._totalBytes = this._totalPackets = this._prevTotalPackets = 0;
    }
    /**
     * The interval (number of packets) between 2 consecutive RTCP Sender
     * Report packets
     */
    get srInterval() {
        return this._srInterval;
    }
    set srInterval(interval) {
        this._srInterval = interval;
    }
    sendFrame(frame) {
        // override this
        this._lastPacketTime = Date.now();
    }
    onFrameSent(packetsSent, bytesSent) {
        if (!this._mediaUdp.mediaConnection.streamOptions.rtcpSenderReportEnabled)
            return;
        this._totalPackets = this._totalPackets + packetsSent;
        this._totalBytes = (this._totalBytes + bytesSent) % exports.max_int32bit;
        // Not using modulo here, since the number of packet sent might not be
        // exactly a multiple of the interval
        if (Math.floor(this._totalPackets / this._srInterval) - Math.floor(this._prevTotalPackets / this._srInterval) > 0) {
            const senderReport = this.makeRtcpSenderReport();
            this._mediaUdp.sendPacket(senderReport);
            this._prevTotalPackets = this._totalPackets;
        }
    }
    /**
     * Partitions a buffer into chunks of length this.mtu
     * @param data buffer to be partitioned
     * @returns array of chunks
     */
    partitionDataMTUSizedChunks(data) {
        let i = 0;
        let len = data.length;
        const out = [];
        while (len > 0) {
            const size = Math.min(len, this._mtu);
            out.push(data.subarray(i, i + size));
            len -= size;
            i += size;
        }
        return out;
    }
    getNewSequence() {
        this._sequence = (this._sequence + 1) % exports.max_int16bit;
        return this._sequence;
    }
    incrementTimestamp(incrementBy) {
        this._timestamp = (this._timestamp + incrementBy) % exports.max_int32bit;
    }
    makeRtpHeader(isLastPacket = true) {
        const packetHeader = Buffer.alloc(12);
        packetHeader[0] = 2 << 6 | ((this._extensionEnabled ? 1 : 0) << 4); // set version and flags
        packetHeader[1] = this._payloadType; // set packet payload
        if (isLastPacket)
            packetHeader[1] |= 0b10000000; // mark M bit if last frame
        packetHeader.writeUIntBE(this.getNewSequence(), 2, 2);
        packetHeader.writeUIntBE(this._timestamp, 4, 4);
        packetHeader.writeUIntBE(this._ssrc, 8, 4);
        return packetHeader;
    }
    makeRtcpSenderReport() {
        const packetHeader = Buffer.allocUnsafe(8);
        packetHeader[0] = 0x80; // RFC1889 v2, no padding, no reception report count
        packetHeader[1] = 0xc8; // Type: Sender Report (200)
        // Packet length (always 0x06 for some reason)
        packetHeader[2] = 0x00;
        packetHeader[3] = 0x06;
        packetHeader.writeUInt32BE(this._ssrc, 4);
        const senderReport = Buffer.allocUnsafe(20);
        // Convert from floating point to 32.32 fixed point
        // Convert each part separately to reduce precision loss
        const ntpTimestamp = (this._lastPacketTime - ntpEpoch) / 1000;
        const ntpTimestampMsw = Math.floor(ntpTimestamp);
        const ntpTimestampLsw = Math.round((ntpTimestamp - ntpTimestampMsw) * exports.max_int32bit);
        senderReport.writeUInt32BE(ntpTimestampMsw, 0);
        senderReport.writeUInt32BE(ntpTimestampLsw, 4);
        senderReport.writeUInt32BE(this._timestamp, 8);
        senderReport.writeUInt32BE(this._totalPackets % exports.max_int32bit, 12);
        senderReport.writeUInt32BE(this._totalBytes, 16);
        const nonceBuffer = this._mediaUdp.getNewNonceBuffer();
        return Buffer.concat([
            packetHeader,
            (0, libsodium_wrappers_1.crypto_secretbox_easy)(senderReport, nonceBuffer, this._mediaUdp.mediaConnection.secretkey),
            nonceBuffer.subarray(0, 4)
        ]);
    }
    /**
     * Creates a single extension of type playout-delay
     * Discord seems to send this extension on every video packet
     * @see https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/playout-delay
     * @returns playout-delay extension @type Buffer
     */
    createHeaderExtension() {
        const extensions = [{ id: 5, len: 2, val: 0 }];
        /**
         *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |      defined by profile       |           length              |
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
        */
        const profile = Buffer.alloc(4);
        profile[0] = 0xBE;
        profile[1] = 0xDE;
        profile.writeInt16BE(extensions.length, 2); // extension count
        const extensionsData = [];
        for (let ext of extensions) {
            /**
             * EXTENSION DATA - each extension payload is 32 bits
             */
            const data = Buffer.alloc(4);
            /**
             *  0 1 2 3 4 5 6 7
                +-+-+-+-+-+-+-+-+
                |  ID   |  len  |
                +-+-+-+-+-+-+-+-+

            where len = actual length - 1
            */
            data[0] = (ext.id & 0b00001111) << 4;
            data[0] |= ((ext.len - 1) & 0b00001111);
            /**  Specific to type playout-delay
             *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4
                +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                |       MIN delay       |       MAX delay       |
                +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            */
            data.writeUIntBE(ext.val, 1, 2); // not quite but its 0 anyway
            extensionsData.push(data);
        }
        return Buffer.concat([profile, ...extensionsData]);
    }
    // encrypts all data that is not in rtp header.
    // rtp header extensions and payload headers are also encrypted
    encryptData(message, nonceBuffer) {
        return (0, libsodium_wrappers_1.crypto_secretbox_easy)(message, nonceBuffer, this._mediaUdp.mediaConnection.secretkey);
    }
    get mediaUdp() {
        return this._mediaUdp;
    }
    get mtu() {
        return this._mtu;
    }
}
exports.BaseMediaPacketizer = BaseMediaPacketizer;
