import ChildProcess from "child_process";

//const command = `ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -preset ultrafast -tune zerolatency -f rtsp rtsp://0.0.0.0:8554/stream1`;


class CameraStream {
    ffmpeg: ChildProcess.ChildProcess | null = null;
    cameraNumber: number;
    streamNumber: number;
    constructor(cameraInit: number = 0, streamInit: number = 0) {
        this.streamNumber = streamInit;
        this.cameraNumber = cameraInit;
    }
    start() {
        return new Promise((resolve, reject) => {
            const command = `ffmpeg -f v4l2 -i /dev/video${this.cameraNumber} -c:v libx264 -preset ultrafast -tune zerolatency -f rtsp rtsp://0.0.0.0:8554/stream${this.streamNumber}`;
            this.ffmpeg = ChildProcess.spawn(command, {
                shell: true,
            });
            if (!this.ffmpeg) {
                reject("Failed to start ffmpeg");
            } else {
                this.ffmpeg.stdout?.on("data", (data) => {
                    console.log(`stdout: ${data}`);
                });
                this.ffmpeg.stderr?.on("data", (data) => {
                    console.log(`stderr: ${data}`);
                });
                this.ffmpeg.on("close", (code) => {
                    this.ffmpeg?.removeAllListeners();
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
    async switchCamera(CameraNumber: number) {
        this.cameraNumber = CameraNumber;
        this.stop();
        await this.start();
    }
}


export default CameraStream;