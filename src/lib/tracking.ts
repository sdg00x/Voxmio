import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { ZoneGate, zoneAt } from "./music";
export async function trackHands(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  onChord: (i: number) => void,
  onStatus: (s: string) => void,
) {
  const vision = await FilesetResolver.forVisionTasks(
    `${import.meta.env.BASE_URL}wasm`,
  );
  const model = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "CPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
  let frame = 0,
    lastTime = -1,
    lastRun = 0,
    stopped = false;
  const gate = new ZoneGate();
  const draw = (now: number) => {
    if (stopped) return;
    try {
      if (
        video.readyState >= 2 &&
        video.currentTime !== lastTime &&
        now - lastRun > 65
      ) {
        lastTime = video.currentTime;
        lastRun = now;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const points = model.detectForVideo(video, now).landmarks[0];
        if (points) {
          ctx.fillStyle = "#c4b5fd";
          ctx.strokeStyle = "#a78bfa";
          ctx.lineWidth = 3;
          for (const link of HandLandmarker.HAND_CONNECTIONS) {
            const a = points[link.start],
              b = points[link.end];
            ctx.beginPath();
            ctx.moveTo((1 - a.x) * canvas.width, a.y * canvas.height);
            ctx.lineTo((1 - b.x) * canvas.width, b.y * canvas.height);
            ctx.stroke();
          }
          for (const p of points) {
            ctx.beginPath();
            ctx.arc(
              (1 - p.x) * canvas.width,
              p.y * canvas.height,
              4,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          const hit = gate.update(zoneAt(1 - points[9].x), now);
          if (hit !== null) onChord(hit);
        } else gate.update(null, now);
      }
      frame = requestAnimationFrame(draw);
    } catch {
      onStatus(
        "Tracking paused. Restart the camera to retry; chord pads still work.",
      );
    }
  };
  onStatus("Hand tracking ready — move an open hand across the four zones.");
  frame = requestAnimationFrame(draw);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    model.close();
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };
}
