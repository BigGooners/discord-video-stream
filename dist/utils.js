"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeVideoCodec = normalizeVideoCodec;
function normalizeVideoCodec(codec) {
    if (/H\.?264|AVC/i.test(codec))
        return "H264";
    if (/H\.?265|HEVC/i.test(codec))
        return "H265";
    if (/VP(8|9)/i.test(codec))
        return codec.toUpperCase();
    if (/AV1/i.test(codec))
        return "AV1";
    throw new Error(`Unknown codec: ${codec}`);
}
