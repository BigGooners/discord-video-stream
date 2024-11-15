// Import necessary modules
import ffmpeg from 'fluent-ffmpeg';
import { IvfTransformer } from "../client/processing/IvfSplitter";
import prism from "prism-media";
import { AudioStream } from "./AudioStream";
import { MediaUdp } from '../client/voice/MediaUdp';
import { StreamOutput } from '@dank074/fluent-ffmpeg-multistream-ts';
import { Readable, PassThrough, Transform } from 'stream';
import { H264NalSplitter, H265NalSplitter } from '../client/processing/AnnexBNalSplitter';
import { VideoStream } from './VideoStream';
import { normalizeVideoCodec } from '../utils';
import zmq from 'zeromq';

// ZeroMQ for real-time commands
const zmqSocket = new zmq.Request();
zmqSocket.connect("tcp://127.0.0.1:5555");

export let command: ffmpeg.FfmpegCommand;

export function streamLivestreamVideo(
    input: string | Readable,
    mediaUdp: MediaUdp,
    includeAudio = true,
    customHeaders?: Record<string, string>
) {
    return new Promise<string>((resolve, reject) => {
        const streamOpts = mediaUdp.mediaConnection.streamOptions;
        const videoCodec = normalizeVideoCodec(streamOpts.videoCodec);
        const videoStream = new VideoStream(mediaUdp, streamOpts.fps, streamOpts.readAtNativeFps);
        
        let videoOutput: Transform;
        switch(videoCodec) {
            case 'H264':
                videoOutput = new H264NalSplitter();
                break;
            case 'H265':
                videoOutput = new H265NalSplitter();
                break;
            case 'VP8':
                videoOutput = new IvfTransformer();
                break;
            default:
                throw new Error("Codec not supported");
        }

        let headers: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.3",
            "Connection": "keep-alive",
            ...customHeaders
        };

        let isHttpUrl = false;
        let isHls = false;
        if (typeof input === "string") {
            isHttpUrl = input.startsWith('http') || input.startsWith('https');
            isHls = input.includes('m3u');
        }

        try {
            const command = ffmpeg(input)
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
                command.output(StreamOutput(videoOutput).url, { end: false })
                    .noAudio()
                    .size(`${streamOpts.width}x${streamOpts.height}`)
                    .fpsOutput(streamOpts.fps)
                    .videoBitrate(`${streamOpts.bitrateKbps}k`)
                    .format('ivf')
                    .outputOption('-deadline', 'realtime');
            } else if (videoCodec === "H265") {
                command.output(StreamOutput(videoOutput).url, { end: false })
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
            } else {
                command.output(StreamOutput(videoOutput).url, { end: false })
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
                const audioStream = new AudioStream(mediaUdp);
                const opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
                command.output(StreamOutput(opus).url, { end: false })
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
            
        } catch (e) {
            //audioStream.end();
            //videoStream.end();
            command = undefined;
            reject("cannot play video " + e.message);
        }
    });
}

// Real-time control functions
export async function updateOverlayText(newText: string) {
    const vidCommand = `drawtext reinit text='${newText}'`;
    await zmqSocket.send(vidCommand);
}

export async function applyColorFilter(brightness: number, contrast: number, saturation: number, hue: number) {
    const vidCommand = `hue=b=${brightness}:c=${contrast}:s=${saturation}:h=${hue}`;
    await zmqSocket.send(vidCommand);
}

export async function jumpToTime(timeInSeconds: number) {
    const vidCommand = `seek ${timeInSeconds}`;
    await zmqSocket.send(vidCommand);
}

export async function changePlaybackSpeed(speedFactor: number) {
    const vidCommand = `setpts=${1 / speedFactor}*PTS`;
    await zmqSocket.send(vidCommand);
}
// Other utility functions
export function getInputMetadata(input: string | Readable): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
        const instance = ffmpeg(input).on('error', (err) => reject(err));
        instance.ffprobe((err, metadata) => {
            if (err) reject(err);
            resolve(metadata);
            instance.kill('SIGINT');
        });
    });
}

export function inputHasAudio(metadata: ffmpeg.FfprobeData) {
    return metadata.streams.some((stream) => stream.codec_type === 'audio');
}

export function inputHasVideo(metadata: ffmpeg.FfprobeData) {
    return metadata.streams.some((stream) => stream.codec_type === 'video');
}
