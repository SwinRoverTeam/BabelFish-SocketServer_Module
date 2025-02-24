"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = __importDefault(require("child_process"));
//const command = `ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -preset ultrafast -tune zerolatency -f rtsp rtsp://0.0.0.0:8554/stream1`;
class CameraStream {
    constructor(cameraInit = 0, streamInit = 0) {
        this.ffmpeg = null;
        this.streamNumber = streamInit;
        this.cameraNumber = cameraInit;
    }
    start() {
        return new Promise((resolve, reject) => {
            var _a, _b;
            const command = `ffmpeg -f v4l2 -i /dev/video${this.cameraNumber} -c:v libx264 -preset ultrafast -tune zerolatency -f rtsp rtsp://0.0.0.0:8554/stream${this.streamNumber}`;
            this.ffmpeg = child_process_1.default.spawn(command, {
                shell: true,
            });
            if (!this.ffmpeg) {
                reject("Failed to start ffmpeg");
            }
            else {
                (_a = this.ffmpeg.stdout) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
                    console.log(`stdout: ${data}`);
                });
                (_b = this.ffmpeg.stderr) === null || _b === void 0 ? void 0 : _b.on("data", (data) => {
                    console.log(`stderr: ${data}`);
                });
                this.ffmpeg.on("close", (code) => {
                    var _a;
                    (_a = this.ffmpeg) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
                    console.log(`child process exited with code ${code}`);
                });
                resolve(true);
            }
        });
    }
    stop() {
        if (this.ffmpeg) {
            this.ffmpeg.kill();
        }
    }
    async switchCamera(CameraNumber) {
        this.cameraNumber = CameraNumber;
        this.stop();
        await this.start();
    }
}
exports.default = CameraStream;
