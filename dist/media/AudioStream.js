"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStream = void 0;
const stream_1 = require("stream");
class AudioStream extends stream_1.Writable {
    constructor(udp, noSleep = false) {
        super();
        this.udp = udp;
        this.count = 0;
        this.sleepTime = 20;
        this.noSleep = noSleep;
    }
    _write(chunk, _, callback) {
        this.count++;
        if (!this.startTime)
            this.startTime = performance.now();
        this.udp.sendAudioFrame(chunk);
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
exports.AudioStream = AudioStream;
