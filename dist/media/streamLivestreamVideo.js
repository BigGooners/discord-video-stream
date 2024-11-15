"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamLivestreamVideo = streamLivestreamVideo;
exports.updateOverlayText = updateOverlayText;
exports.applyColorFilter = applyColorFilter;
exports.jumpToTime = jumpToTime;
exports.changePlaybackSpeed = changePlaybackSpeed;
exports.getInputMetadata = getInputMetadata;
exports.inputHasAudio = inputHasAudio;
exports.inputHasVideo = inputHasVideo;
// Import necessary modules
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const IvfSplitter_1 = require("../client/processing/IvfSplitter");
const prism_media_1 = __importDefault(require("prism-media"));
const AudioStream_1 = require("./AudioStream");
const fluent_ffmpeg_multistream_ts_1 = require("@dank074/fluent-ffmpeg-multistream-ts");
const AnnexBNalSplitter_1 = require("../client/processing/AnnexBNalSplitter");
const VideoStream_1 = require("./VideoStream");
const utils_1 = require("../utils");
const p_cancelable_1 = __importDefault(require("p-cancelable"));
const zeromq_1 = __importDefault(require("zeromq"));
// ZeroMQ for real-time commands
const zmqSocket = new zeromq_1.default.Request();
zmqSocket.connect("tcp://127.0.0.1:5555");
function streamLivestreamVideo(input, mediaUdp, includeAudio = true, customHeaders) {
    return new p_cancelable_1.default((resolve, reject, onCancel) => __awaiter(this, void 0, void 0, function* () {
        const streamOpts = mediaUdp.mediaConnection.streamOptions;
        const videoCodec = (0, utils_1.normalizeVideoCodec)(streamOpts.videoCodec);
        const videoStream = new VideoStream_1.VideoStream(mediaUdp, streamOpts.fps, streamOpts.readAtNativeFps);
        let videoOutput;
        switch (videoCodec) {
            case 'H264':
                videoOutput = new AnnexBNalSplitter_1.H264NalSplitter();
                break;
            case 'H265':
                videoOutput = new AnnexBNalSplitter_1.H265NalSplitter();
                break;
            case 'VP8':
                videoOutput = new IvfSplitter_1.IvfTransformer();
                break;
            default:
                throw new Error("Codec not supported");
        }
        let headers = Object.assign({ "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.3", "Connection": "keep-alive" }, customHeaders);
        let isHttpUrl = false;
        let isHls = false;
        if (typeof input === "string") {
            isHttpUrl = input.startsWith('http') || input.startsWith('https');
            isHls = input.includes('m3u');
        }
        try {
            const command = (0, fluent_ffmpeg_1.default)(input)
                .addOption('-loglevel', '0')
                .addOption('-fflags', 'nobuffer')
                .addOption('-analyzeduration', '0')
                .on('end', () => {
                resolve("video ended");
            })
                .on("error", (err) => {
                reject('cannot play video ' + err.message);
            });
            if (videoCodec === 'VP8') {
                command.output((0, fluent_ffmpeg_multistream_ts_1.StreamOutput)(videoOutput).url, { end: false })
                    .noAudio()
                    .size(`${streamOpts.width}x${streamOpts.height}`)
                    .fpsOutput(streamOpts.fps)
                    .videoBitrate(`${streamOpts.bitrateKbps}k`)
                    .format('ivf')
                    .outputOption('-deadline', 'realtime');
            }
            else if (videoCodec === "H265") {
                command.output((0, fluent_ffmpeg_multistream_ts_1.StreamOutput)(videoOutput).url, { end: false })
                    .noAudio()
                    .size(`${streamOpts.width}x${streamOpts.height}`)
                    .fpsOutput(streamOpts.fps)
                    .videoBitrate(`${streamOpts.bitrateKbps}k`)
                    .format('hevc')
                    .outputOptions([
                    '-tune zerolatency',
                    '-pix_fmt yuv420p',
                    `-preset ${streamOpts.h26xPreset}`,
                    '-profile:v main',
                    `-g ${streamOpts.fps}`,
                    `-bf 0`,
                    `-x265-params keyint=${streamOpts.fps}:min-keyint=${streamOpts.fps}`,
                    '-bsf:v hevc_metadata=aud=insert'
                ]);
            }
            else {
                command.output((0, fluent_ffmpeg_multistream_ts_1.StreamOutput)(videoOutput).url, { end: false })
                    .noAudio()
                    .size(`${streamOpts.width}x${streamOpts.height}`)
                    .fpsOutput(streamOpts.fps)
                    .videoBitrate(`${streamOpts.bitrateKbps}k`)
                    .format('h264')
                    .outputOptions([
                    '-tune zerolatency',
                    '-pix_fmt yuv420p',
                    `-preset ${streamOpts.h26xPreset}`,
                    '-profile:v baseline',
                    `-g ${streamOpts.fps}`,
                    `-bf 0`,
                    `-x264-params keyint=${streamOpts.fps}:min-keyint=${streamOpts.fps}`,
                    '-bsf:v h264_metadata=aud=insert'
                ]);
            }
            videoOutput.pipe(videoStream, { end: false });
            if (includeAudio) {
                const audioStream = new AudioStream_1.AudioStream(mediaUdp);
                const opus = new prism_media_1.default.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
                command.output((0, fluent_ffmpeg_multistream_ts_1.StreamOutput)(opus).url, { end: false })
                    .noVideo()
                    .audioChannels(2)
                    .audioFrequency(48000)
                    .format('s16le');
                opus.pipe(audioStream, { end: false });
            }
            if (isHttpUrl) {
                command.inputOption('-headers', Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\r\n"));
                if (!isHls) {
                    command.inputOptions([
                        '-reconnect 1',
                        '-reconnect_at_eof 1',
                        '-reconnect_streamed 1',
                        '-reconnect_delay_max 4294'
                    ]);
                }
            }
            command.run();
            onCancel(() => command.kill("SIGINT"));
        }
        catch (e) {
            reject("cannot play video " + e.message);
        }
    }));
}
// Real-time control functions
function updateOverlayText(newText) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `drawtext reinit text='${newText}'`;
        yield zmqSocket.send(command);
    });
}
function applyColorFilter(brightness, contrast, saturation, hue) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `hue=b=${brightness}:c=${contrast}:s=${saturation}:h=${hue}`;
        yield zmqSocket.send(command);
    });
}
function jumpToTime(timeInSeconds) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `seek ${timeInSeconds}`;
        yield zmqSocket.send(command);
    });
}
function changePlaybackSpeed(speedFactor) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `setpts=${1 / speedFactor}*PTS`;
        zmqSocket.send(command);
    });
}
// Other utility functions
function getInputMetadata(input) {
    return new Promise((resolve, reject) => {
        const instance = (0, fluent_ffmpeg_1.default)(input).on('error', (err) => reject(err));
        instance.ffprobe((err, metadata) => {
            if (err)
                reject(err);
            resolve(metadata);
            instance.kill('SIGINT');
        });
    });
}
function inputHasAudio(metadata) {
    return metadata.streams.some((stream) => stream.codec_type === 'audio');
}
function inputHasVideo(metadata) {
    return metadata.streams.some((stream) => stream.codec_type === 'video');
}
