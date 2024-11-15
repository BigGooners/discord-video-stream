import { MediaUdp } from "../voice/MediaUdp";
export declare const max_int16bit: number;
export declare const max_int32bit: number;
export declare class BaseMediaPacketizer {
    private _ssrc;
    private _payloadType;
    private _mtu;
    private _sequence;
    private _timestamp;
    private _totalBytes;
    private _totalPackets;
    private _prevTotalPackets;
    private _lastPacketTime;
    private _srInterval;
    private _mediaUdp;
    private _extensionEnabled;
    constructor(connection: MediaUdp, payloadType: number, extensionEnabled?: boolean);
    get ssrc(): number;
    set ssrc(value: number);
    /**
     * The interval (number of packets) between 2 consecutive RTCP Sender
     * Report packets
     */
    get srInterval(): number;
    set srInterval(interval: number);
    sendFrame(frame: any): void;
    onFrameSent(packetsSent: number, bytesSent: number): void;
    /**
     * Partitions a buffer into chunks of length this.mtu
     * @param data buffer to be partitioned
     * @returns array of chunks
     */
    partitionDataMTUSizedChunks(data: Buffer): Buffer[];
    getNewSequence(): number;
    incrementTimestamp(incrementBy: number): void;
    makeRtpHeader(isLastPacket?: boolean): Buffer;
    makeRtcpSenderReport(): Buffer;
    /**
     * Creates a single extension of type playout-delay
     * Discord seems to send this extension on every video packet
     * @see https://webrtc.googlesource.com/src/+/refs/heads/main/docs/native-code/rtp-hdrext/playout-delay
     * @returns playout-delay extension @type Buffer
     */
    createHeaderExtension(): Buffer;
    encryptData(message: string | Uint8Array, nonceBuffer: Buffer): Uint8Array;
    get mediaUdp(): MediaUdp;
    get mtu(): number;
}
