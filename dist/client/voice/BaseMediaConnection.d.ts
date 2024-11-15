import { MediaUdp } from "./MediaUdp";
import WebSocket from 'ws';
type VoiceConnectionStatus = {
    hasSession: boolean;
    hasToken: boolean;
    started: boolean;
    resuming: boolean;
};
export type SupportedVideoCodec = "H264" | "H265" | "VP8" | "VP9" | "AV1";
export interface StreamOptions {
    /**
     * Video output width
     */
    width?: number;
    /**
     * Video output height
     */
    height?: number;
    /**
     * Video output frames per second
     */
    fps?: number;
    /**
     * Video output bitrate in kbps
     */
    bitrateKbps?: number;
    maxBitrateKbps?: number;
    /**
     * Enables hardware accelerated video decoding. Enabling this option might result in an exception
     * being thrown by Ffmpeg process if your system does not support hardware acceleration
     */
    hardwareAcceleratedDecoding?: boolean;
    /**
     * Output video codec. **Only** supports H264, H265, and VP8 currently
     */
    videoCodec?: SupportedVideoCodec;
    /**
     * Ffmpeg will read frames at native framerate. Disabling this make ffmpeg read frames as
     * fast as possible and `setTimeout` will be used to control output fps instead. Enabling this
     * can result in certain streams having video/audio out of sync (see https://github.com/dank074/Discord-video-stream/issues/52)
     */
    readAtNativeFps?: boolean;
    /**
     * Enables sending RTCP sender reports. Helps the receiver synchronize the audio/video frames, except in some weird
     * cases which is why you can disable it
     */
    rtcpSenderReportEnabled?: boolean;
    /**
     * Encoding preset for H264 or H265. The faster it is, the lower the quality
     */
    h26xPreset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
}
export declare abstract class BaseMediaConnection {
    private interval;
    udp: MediaUdp;
    guildId: string;
    channelId: string;
    botId: string;
    ws: WebSocket;
    ready: (udp: MediaUdp) => void;
    status: VoiceConnectionStatus;
    server: string;
    token: string;
    session_id: string;
    self_ip: string;
    self_port: number;
    address: string;
    port: number;
    ssrc: number;
    videoSsrc: number;
    rtxSsrc: number;
    modes: string[];
    secretkey: Uint8Array;
    private _streamOptions;
    constructor(guildId: string, botId: string, channelId: string, options: StreamOptions, callback: (udp: MediaUdp) => void);
    abstract get serverId(): string;
    get streamOptions(): StreamOptions;
    set streamOptions(options: StreamOptions);
    stop(): void;
    setSession(session_id: string): void;
    setTokens(server: string, token: string): void;
    start(): void;
    handleReady(d: any): void;
    handleSession(d: any): void;
    setupEvents(): void;
    setupHeartbeat(interval: number): void;
    sendOpcode(code: number, data: any): void;
    identify(): void;
    resume(): void;
    setProtocols(): void;
    setVideoStatus(bool: boolean): void;
    setSpeaking(speaking: boolean): void;
    sendVoice(): Promise<void>;
}
export {};
