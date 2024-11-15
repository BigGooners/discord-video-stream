"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaUdp = void 0;
const dgram_1 = __importDefault(require("dgram"));
const net_1 = require("net");
const AudioPacketizer_1 = require("../packet/AudioPacketizer");
const BaseMediaPacketizer_1 = require("../packet/BaseMediaPacketizer");
const VideoPacketizerAnnexB_1 = require("../packet/VideoPacketizerAnnexB");
const VideoPacketizerVP8_1 = require("../packet/VideoPacketizerVP8");
const utils_1 = require("../../utils");
// credit to discord.js
function parseLocalPacket(message) {
    const packet = Buffer.from(message);
    const ip = packet.subarray(8, packet.indexOf(0, 8)).toString('utf8');
    if (!(0, net_1.isIPv4)(ip)) {
        throw new Error('Malformed IP address');
    }
    const port = packet.readUInt16BE(packet.length - 2);
    return { ip, port };
}
class MediaUdp {
    constructor(voiceConnection) {
        this._nonce = 0;
        this._mediaConnection = voiceConnection;
        this._audioPacketizer = new AudioPacketizer_1.AudioPacketizer(this);
        const videoCodec = (0, utils_1.normalizeVideoCodec)(this.mediaConnection.streamOptions.videoCodec);
        switch (videoCodec) {
            case "H264":
                this._videoPacketizer = new VideoPacketizerAnnexB_1.VideoPacketizerH264(this);
                break;
            case "H265":
                this._videoPacketizer = new VideoPacketizerAnnexB_1.VideoPacketizerH265(this);
                break;
            case "VP8":
                this._videoPacketizer = new VideoPacketizerVP8_1.VideoPacketizerVP8(this);
                break;
            default:
                throw new Error(`Packetizer not implemented for ${videoCodec}`);
        }
    }
    getNewNonceBuffer() {
        const nonceBuffer = Buffer.alloc(24);
        this._nonce = (this._nonce + 1) % BaseMediaPacketizer_1.max_int32bit;
        nonceBuffer.writeUInt32BE(this._nonce, 0);
        return nonceBuffer;
    }
    get audioPacketizer() {
        return this._audioPacketizer;
    }
    get videoPacketizer() {
        return this._videoPacketizer;
    }
    get mediaConnection() {
        return this._mediaConnection;
    }
    sendAudioFrame(frame) {
        if (!this.ready)
            return;
        this.audioPacketizer.sendFrame(frame);
    }
    sendVideoFrame(frame) {
        if (!this.ready)
            return;
        this.videoPacketizer.sendFrame(frame);
    }
    sendPacket(packet) {
        return new Promise((resolve, reject) => {
            try {
                this._socket.send(packet, 0, packet.length, this._mediaConnection.port, this._mediaConnection.address, (error, bytes) => {
                    if (error) {
                        console.log("ERROR", error);
                        reject(error);
                    }
                    resolve();
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
    handleIncoming(buf) {
        //console.log("RECEIVED PACKET", buf);
    }
    get ready() {
        return this._ready;
    }
    set ready(val) {
        this._ready = val;
    }
    stop() {
        var _a;
        try {
            this.ready = false;
            (_a = this._socket) === null || _a === void 0 ? void 0 : _a.disconnect();
        }
        catch (e) { }
    }
    createUdp() {
        return new Promise((resolve, reject) => {
            this._socket = dgram_1.default.createSocket('udp4');
            this._socket.on('error', (error) => {
                console.error("Error connecting to media udp server", error);
                reject(error);
            });
            this._socket.once('message', (message) => {
                if (message.readUInt16BE(0) !== 2) {
                    reject('wrong handshake packet for udp');
                }
                try {
                    const packet = parseLocalPacket(message);
                    this._mediaConnection.self_ip = packet.ip;
                    this._mediaConnection.self_port = packet.port;
                    this._mediaConnection.setProtocols();
                }
                catch (e) {
                    reject(e);
                }
                resolve();
                this._socket.on('message', this.handleIncoming);
            });
            const blank = Buffer.alloc(74);
            blank.writeUInt16BE(1, 0);
            blank.writeUInt16BE(70, 2);
            blank.writeUInt32BE(this._mediaConnection.ssrc, 4);
            this._socket.send(blank, 0, blank.length, this._mediaConnection.port, this._mediaConnection.address, (error, bytes) => {
                if (error) {
                    reject(error);
                }
            });
        });
    }
}
exports.MediaUdp = MediaUdp;
