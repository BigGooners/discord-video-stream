"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoStream = void 0;
const stream_1 = require("stream");
class VideoStream extends stream_1.Writable {
    constructor(udp, fps = 30, noSleep = false) {
        super();
        this.udp = udp;
        this.count = 0;
        this.sleepTime = 1000 / fps;
        this.noSleep = noSleep;
    }
    setSleepTime(time) {
        this.sleepTime = time;
    }
    _write(frame, encoding, callback) {
        this.count++;
        if (!this.startTime)
            this.startTime = performance.now();
        this.udp.sendVideoFrame(frame);
        const next = ((this.count + 1) * this.sleepTime) - (performance.now() - this.startTime);
        if (this.noSleep) {
            callback();
        }
        else {
            setTimeout(() => {
                callback();
            }, next);
        }
    }
}
exports.VideoStream = VideoStream;
