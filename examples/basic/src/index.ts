import { Client, StageChannel } from "discord.js-selfbot-v13";
import { command, streamLivestreamVideo, MediaUdp, getInputMetadata, inputHasAudio, Streamer } from "@dank074/discord-video-stream";
import config from "./config.json";

const streamer = new Streamer(new Client());

// ready event
streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user.tag} is ready ---`);
});

// message event
streamer.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    if (!config.acceptedAuthors.includes(msg.author.id)) return;

    if (!msg.content) return;

    if (msg.content.startsWith(`$play-live`)) {
        const args = parseArgs(msg.content)
        if (!args) return;

        const channel = msg.author.voice.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await streamer.joinVoice(msg.guildId, channel.id);

        if(channel instanceof StageChannel)
        {
            await streamer.client.user.voice.setSuppressed(false);
        }

        const streamUdpConn = await streamer.createStream({
            width: config.streamOpts.width, 
            height: config.streamOpts.height, 
            fps: config.streamOpts.fps, 
            bitrateKbps: config.streamOpts.bitrateKbps,
            maxBitrateKbps: config.streamOpts.maxBitrateKbps, 
            hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
            videoCodec: config.streamOpts.videoCodec === 'H264' ? 'H264' : 'VP8'
        });

        await playVideo(args.url, streamUdpConn);

        streamer.stopStream();
        return;
    } else if (msg.content.startsWith("$play-cam")) {
        const args = parseArgs(msg.content);
        if (!args) return;

        const channel = msg.author.voice.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        const vc = await streamer.joinVoice(msg.guildId, channel.id, {
            width: config.streamOpts.width, 
            height: config.streamOpts.height, 
            fps: config.streamOpts.fps, 
            bitrateKbps: config.streamOpts.bitrateKbps,
            maxBitrateKbps: config.streamOpts.maxBitrateKbps, 
            hardwareAcceleratedDecoding: config.streamOpts.hardware_acceleration,
            videoCodec: config.streamOpts.videoCodec === 'H264' ? 'H264' : 'VP8'
        });

        if(channel instanceof StageChannel)
        {
            await streamer.client.user.voice.setSuppressed(false);
        }

        streamer.signalVideo(msg.guildId, channel.id, true);

        playVideo(args.url, vc);

        return;
    } else if (msg.content.startsWith("$disconnect")) {
        command?.kill("SIGINT");

        streamer.leaveVoice();
    } else if(msg.content.startsWith("$stop-stream")) {
        command?.kill('SIGINT');

        const stream = streamer.voiceConnection?.streamConnection;

        if(!stream) return;

        streamer.stopStream();
    }
});

// login
streamer.client.login(config.token);

async function playVideo(video: string, udpConn: MediaUdp) {
    let includeAudio = true;

    try {
        const metadata = await getInputMetadata(video);
        //console.log(JSON.stringify(metadata.streams));
        includeAudio = inputHasAudio(metadata);
    } catch(e) {
        console.log(e);
        return;
    }

    console.log("Started playing video");

    udpConn.mediaConnection.setSpeaking(true);
    udpConn.mediaConnection.setVideoStatus(true);
    try {
        const res = await streamLivestreamVideo(video, udpConn, includeAudio);

        console.log("Finished playing video " + res);
    } catch (e) {
        console.log(e);
    } finally {
        udpConn.mediaConnection.setSpeaking(false);
        udpConn.mediaConnection.setVideoStatus(false);
    }
    command?.kill("SIGINT");
}

function parseArgs(message: string): Args | undefined {
    const args = message.split(" ");
    if (args.length < 2) return;

    const url = args[1];

    return { url }
}

type Args = {
    url: string;
}
