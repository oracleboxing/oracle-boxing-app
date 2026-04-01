"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

// MediaPipe types
type PoseLandmarker = any;
type DrawingUtils = any;

export default function AnalysisPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [drawingUtils, setDrawingUtils] = useState<DrawingUtils | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [mode, setMode] = useState<"upload" | "webcam">("upload");
  const [landmarks, setLandmarks] = useState<any>(null);
  const animationRef = useRef<number>(0);

  // Initialize MediaPipe
  useEffect(() => {
    async function init() {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const { PoseLandmarker, FilesetResolver, DrawingUtils } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const landmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        setPoseLandmarker(landmarker);

        // Set up drawing utils
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            setDrawingUtils(new DrawingUtils(ctx));
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load MediaPipe:", err);
        setLoading(false);
      }
    }
    init();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Calculate angle between three points
  function calculateAngle(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
  ): number {
    const radians =
      Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return Math.round(angle);
  }

  // Draw landmarks and angles on canvas
  const drawResults = useCallback(
    (result: any) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || !drawingUtils) return;

      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        setLandmarks(lm);

        // Import connector constants
        import("@mediapipe/tasks-vision").then((vision) => {
          // Draw skeleton
          drawingUtils.drawConnectors(lm, vision.PoseLandmarker.POSE_CONNECTIONS, {
            color: "#C4985A",
            lineWidth: 2,
          });
          drawingUtils.drawLandmarks(lm, {
            color: "#37322F",
            fillColor: "#C4985A",
            lineWidth: 1,
            radius: 3,
          });

          // Draw key boxing angles
          // Right elbow angle (shoulder-elbow-wrist): landmarks 12, 14, 16
          const rightElbow = calculateAngle(lm[12], lm[14], lm[16]);
          drawAngleLabel(ctx, lm[14], rightElbow, "R Elbow", canvas);

          // Left elbow angle: landmarks 11, 13, 15
          const leftElbow = calculateAngle(lm[11], lm[13], lm[15]);
          drawAngleLabel(ctx, lm[13], leftElbow, "L Elbow", canvas);

          // Right knee angle: landmarks 24, 26, 28
          const rightKnee = calculateAngle(lm[24], lm[26], lm[28]);
          drawAngleLabel(ctx, lm[26], rightKnee, "R Knee", canvas);

          // Left knee angle: landmarks 23, 25, 27
          const leftKnee = calculateAngle(lm[23], lm[25], lm[27]);
          drawAngleLabel(ctx, lm[25], leftKnee, "L Knee", canvas);

          // Hip hinge angle (shoulder-hip-knee)
          const rightHip = calculateAngle(lm[12], lm[24], lm[26]);
          drawAngleLabel(ctx, lm[24], rightHip, "R Hip", canvas);
        });
      }
    },
    [drawingUtils]
  );

  function drawAngleLabel(
    ctx: CanvasRenderingContext2D,
    point: { x: number; y: number },
    angle: number,
    label: string,
    canvas: HTMLCanvasElement
  ) {
    const x = point.x * canvas.width;
    const y = point.y * canvas.height;
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.fillStyle = "#37322F";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    const text = `${label}: ${angle}°`;
    ctx.strokeText(text, x + 8, y - 8);
    ctx.fillText(text, x + 8, y - 8);
  }

  // Process video frames
  const detectPose = useCallback(() => {
    const video = videoRef.current;
    if (!video || !poseLandmarker || video.paused || video.ended) {
      setDetecting(false);
      return;
    }

    const result = poseLandmarker.detectForVideo(video, performance.now());
    drawResults(result);
    animationRef.current = requestAnimationFrame(detectPose);
  }, [poseLandmarker, drawResults]);

  // Handle video upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !videoRef.current) return;

    const url = URL.createObjectURL(file);
    videoRef.current.src = url;
    videoRef.current.load();
  }

  // Start webcam
  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode("webcam");
    } catch (err) {
      console.error("Webcam error:", err);
    }
  }

  // Toggle detection
  function toggleDetection() {
    if (detecting) {
      cancelAnimationFrame(animationRef.current);
      setDetecting(false);
    } else {
      setDetecting(true);
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play();
      }
      detectPose();
    }
  }

  return (
    <div className="p-4 pb-24">
      <PageHeader
        title="Video Analysis"
        subtitle="Upload a video or use your camera to analyse your boxing form"
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-[var(--text-secondary)] text-sm">Loading MediaPipe Pose Landmarker...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex gap-2 mb-4">
            <label className="flex-1 cursor-pointer">
              <div className="bg-[var(--accent-primary)] text-white rounded-lg py-2 px-4 text-sm font-medium text-center">
                Upload Video
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={startWebcam}
              className="flex-1 border border-[var(--border)] rounded-lg py-2 px-4 text-sm font-medium text-[var(--text-primary)]"
            >
              Use Camera
            </button>
          </div>

          {/* Video + Canvas overlay */}
          <div className="relative rounded-lg overflow-hidden bg-black mb-4">
            <video
              ref={videoRef}
              className="w-full"
              playsInline
              controls={mode === "upload"}
              onPlay={() => {
                if (poseLandmarker && !detecting) {
                  setDetecting(true);
                  detectPose();
                }
              }}
              onPause={() => {
                cancelAnimationFrame(animationRef.current);
                setDetecting(false);
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
          </div>

          {/* Angle readout */}
          {landmarks && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                Joint Angles
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <AngleCard
                  label="L Elbow"
                  angle={calculateAngle(landmarks[11], landmarks[13], landmarks[15])}
                />
                <AngleCard
                  label="R Elbow"
                  angle={calculateAngle(landmarks[12], landmarks[14], landmarks[16])}
                />
                <AngleCard
                  label="L Knee"
                  angle={calculateAngle(landmarks[23], landmarks[25], landmarks[27])}
                />
                <AngleCard
                  label="R Knee"
                  angle={calculateAngle(landmarks[24], landmarks[26], landmarks[28])}
                />
                <AngleCard
                  label="R Hip"
                  angle={calculateAngle(landmarks[12], landmarks[24], landmarks[26])}
                />
                <AngleCard
                  label="L Hip"
                  angle={calculateAngle(landmarks[11], landmarks[23], landmarks[25])}
                />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-4 bg-[var(--surface-secondary)] rounded-lg">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
              How to use
            </h3>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1">
              <li>1. Upload a video of your boxing or use your camera</li>
              <li>2. Play the video - pose detection starts automatically</li>
              <li>3. Gold skeleton overlay shows your body landmarks</li>
              <li>4. Key joint angles displayed in real-time</li>
              <li>5. Pause to freeze-frame and study your form</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function AngleCard({ label, angle }: { label: string; angle: number }) {
  return (
    <div className="bg-[var(--surface-secondary)] rounded-lg p-2">
      <span className="text-[var(--text-secondary)] text-xs">{label}</span>
      <p className="text-[var(--text-primary)] font-semibold">{angle}°</p>
    </div>
  );
}
