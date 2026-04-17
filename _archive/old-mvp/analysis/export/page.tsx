"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PoseLandmarkerType = any;
type NormalizedLandmark = { x: number; y: number; z: number; visibility?: number };

type GuideKey =
  | "skeleton"
  | "hipHinge"
  | "chinHeight"
  | "elbowFlare"
  | "stanceWidth"
  | "shoulderFrame";

type ColorMode = "wrong" | "right" | "neutral";
type ExportMode = "overlay" | "preview";

const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const SKELETON_CONNECTIONS = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
] as const;

const DEFAULT_GUIDES: Record<GuideKey, boolean> = {
  skeleton: true,
  hipHinge: true,
  chinHeight: true,
  elbowFlare: true,
  stanceWidth: true,
  shoulderFrame: true,
};

function isVisible(lm?: NormalizedLandmark, min = 0.35) {
  return !!lm && (lm.visibility ?? 1) >= min;
}

function point(lm: NormalizedLandmark, w: number, h: number) {
  return { x: lm.x * w, y: lm.y * h };
}

function midpoint(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  width = 4,
  dash: number[] = []
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  color: string,
  radius = 6
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
) {
  ctx.save();
  ctx.font = "700 20px Inter, Arial, sans-serif";
  ctx.textBaseline = "middle";
  const paddingX = 10;
  const paddingY = 7;
  const metrics = ctx.measureText(text);
  const width = metrics.width + paddingX * 2;
  const height = 30;
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.beginPath();
  ctx.roundRect(x, y - height / 2, width, height, 8);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x + paddingX, y);
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  width = 4
) {
  drawLine(ctx, from, to, color, width);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 12;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - Math.PI / 6), to.y - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - head * Math.cos(angle + Math.PI / 6), to.y - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function angleDegrees(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (!magAB || !magCB) return 0;
  const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

function getPalette(mode: ColorMode) {
  if (mode === "wrong") {
    return {
      primary: "#FF4D4D",
      secondary: "#FF9C9C",
      accent: "#FFD0D0",
      tint: "rgba(255,0,0,0.12)",
    };
  }
  if (mode === "right") {
    return {
      primary: "#32D16D",
      secondary: "#89F0AD",
      accent: "#D7FFE4",
      tint: "rgba(34,197,94,0.12)",
    };
  }
  return {
    primary: "#C4985A",
    secondary: "#F0C98D",
    accent: "#FFF1D9",
    tint: "rgba(196,152,90,0.12)",
  };
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  lms: NormalizedLandmark[],
  width: number,
  height: number,
  guides: Record<GuideKey, boolean>,
  colorMode: ColorMode,
  showLabels: boolean,
  showPoints: boolean,
  lineWidth: number
) {
  const palette = getPalette(colorMode);
  const visible = (idx: number) => isVisible(lms[idx]);

  if (guides.skeleton) {
    for (const [aIdx, bIdx] of SKELETON_CONNECTIONS) {
      if (!visible(aIdx) || !visible(bIdx)) continue;
      drawLine(ctx, point(lms[aIdx], width, height), point(lms[bIdx], width, height), palette.secondary, Math.max(2, lineWidth - 1));
    }
  }

  if (guides.hipHinge && visible(LANDMARKS.RIGHT_SHOULDER) && visible(LANDMARKS.RIGHT_HIP) && visible(LANDMARKS.RIGHT_KNEE)) {
    const shoulder = point(lms[LANDMARKS.RIGHT_SHOULDER], width, height);
    const hip = point(lms[LANDMARKS.RIGHT_HIP], width, height);
    const knee = point(lms[LANDMARKS.RIGHT_KNEE], width, height);
    drawLine(ctx, shoulder, hip, palette.primary, lineWidth + 1);
    drawLine(ctx, hip, knee, palette.primary, lineWidth + 1);
    if (showLabels) {
      const angle = angleDegrees(lms[LANDMARKS.RIGHT_SHOULDER], lms[LANDMARKS.RIGHT_HIP], lms[LANDMARKS.RIGHT_KNEE]);
      drawLabel(ctx, `Hip hinge ${angle}°`, hip.x + 12, hip.y - 18, palette.accent);
    }
  }

  if (guides.chinHeight && visible(LANDMARKS.NOSE) && visible(LANDMARKS.LEFT_SHOULDER) && visible(LANDMARKS.RIGHT_SHOULDER)) {
    const nose = point(lms[LANDMARKS.NOSE], width, height);
    const shoulderMid = point(midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER]), width, height);
    drawLine(ctx, shoulderMid, { x: shoulderMid.x, y: nose.y }, palette.secondary, lineWidth, [8, 6]);
    drawLine(ctx, { x: shoulderMid.x, y: nose.y }, nose, palette.primary, lineWidth);
    drawArrow(ctx, { x: nose.x + 55, y: nose.y - 45 }, nose, palette.primary, lineWidth);
    if (showLabels) drawLabel(ctx, "Chin height", nose.x + 18, nose.y - 26, palette.accent);
  }

  if (guides.elbowFlare && visible(LANDMARKS.LEFT_SHOULDER) && visible(LANDMARKS.LEFT_ELBOW) && visible(LANDMARKS.LEFT_WRIST)) {
    const shoulder = point(lms[LANDMARKS.LEFT_SHOULDER], width, height);
    const elbow = point(lms[LANDMARKS.LEFT_ELBOW], width, height);
    const wrist = point(lms[LANDMARKS.LEFT_WRIST], width, height);
    drawLine(ctx, shoulder, elbow, palette.primary, lineWidth);
    drawLine(ctx, elbow, wrist, palette.primary, lineWidth);
    drawArrow(ctx, { x: elbow.x + 44, y: elbow.y - 34 }, elbow, palette.secondary, lineWidth);
    if (showLabels) {
      const angle = angleDegrees(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.LEFT_ELBOW], lms[LANDMARKS.LEFT_WRIST]);
      drawLabel(ctx, `Elbow ${angle}°`, elbow.x + 12, elbow.y - 18, palette.accent);
    }
  }

  if (guides.stanceWidth && visible(LANDMARKS.LEFT_ANKLE) && visible(LANDMARKS.RIGHT_ANKLE)) {
    const leftAnkle = point(lms[LANDMARKS.LEFT_ANKLE], width, height);
    const rightAnkle = point(lms[LANDMARKS.RIGHT_ANKLE], width, height);
    drawLine(ctx, leftAnkle, rightAnkle, palette.primary, lineWidth + 1);
    drawDot(ctx, leftAnkle, palette.secondary, 7);
    drawDot(ctx, rightAnkle, palette.secondary, 7);
    if (showLabels) {
      const midX = (leftAnkle.x + rightAnkle.x) / 2;
      const midY = (leftAnkle.y + rightAnkle.y) / 2;
      drawLabel(ctx, "Stance width", midX - 55, midY - 22, palette.accent);
    }
  }

  if (guides.shoulderFrame && visible(LANDMARKS.LEFT_SHOULDER) && visible(LANDMARKS.RIGHT_SHOULDER) && visible(LANDMARKS.LEFT_HIP) && visible(LANDMARKS.RIGHT_HIP)) {
    const leftShoulder = point(lms[LANDMARKS.LEFT_SHOULDER], width, height);
    const rightShoulder = point(lms[LANDMARKS.RIGHT_SHOULDER], width, height);
    const leftHip = point(lms[LANDMARKS.LEFT_HIP], width, height);
    const rightHip = point(lms[LANDMARKS.RIGHT_HIP], width, height);
    drawLine(ctx, leftShoulder, rightShoulder, palette.primary, lineWidth);
    drawLine(ctx, leftHip, rightHip, palette.secondary, lineWidth, [10, 6]);
    if (showLabels) {
      const anchorX = Math.min(leftShoulder.x, rightShoulder.x);
      const anchorY = Math.min(leftShoulder.y, rightShoulder.y) - 18;
      drawLabel(ctx, "Frame / shoulder tilt", anchorX, anchorY, palette.accent);
    }
  }

  if (showPoints) {
    const highlighted = [
      LANDMARKS.NOSE,
      LANDMARKS.LEFT_SHOULDER,
      LANDMARKS.RIGHT_SHOULDER,
      LANDMARKS.LEFT_ELBOW,
      LANDMARKS.LEFT_WRIST,
      LANDMARKS.RIGHT_HIP,
      LANDMARKS.RIGHT_KNEE,
      LANDMARKS.LEFT_ANKLE,
      LANDMARKS.RIGHT_ANKLE,
    ];
    for (const idx of highlighted) {
      if (!visible(idx)) continue;
      drawDot(ctx, point(lms[idx], width, height), palette.accent, 5);
    }
  }
}

export default function PoseOverlayExportPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const landmarkerRef = useRef<PoseLandmarkerType>(null);
  const lastTimeRef = useRef<number>(-1);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>("boxing-clip");
  const [mpLoading, setMpLoading] = useState(true);
  const [mpError, setMpError] = useState<string | null>(null);
  const [guides, setGuides] = useState<Record<GuideKey, boolean>>(DEFAULT_GUIDES);
  const [colorMode, setColorMode] = useState<ColorMode>("wrong");
  const [exportMode, setExportMode] = useState<ExportMode>("overlay");
  const [showLabels, setShowLabels] = useState(true);
  const [showPoints, setShowPoints] = useState(false);
  const [lineWidth, setLineWidth] = useState(4);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string>("Upload a clip to start.");

  const activeGuides = useMemo(
    () => Object.entries(guides).filter(([, value]) => value).map(([key]) => key).join("-") || "plain",
    [guides]
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const { PoseLandmarker, FilesetResolver } = vision;
        const resolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setMpLoading(false);
          setStatus("Model loaded. Upload a clip.");
        }
      } catch (error: any) {
        if (!cancelled) {
          setMpError(error?.message || "Failed to load MediaPipe Pose");
          setMpLoading(false);
          setStatus("Model failed to load.");
        }
      }
    }
    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationRef.current);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const renderFrame = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    const landmarker = landmarkerRef.current;
    const ctx = canvas.getContext("2d");
    if (!landmarker || !ctx || video.videoWidth === 0 || video.videoHeight === 0) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (exportMode === "preview") {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const result = landmarker.detectForVideo(video, Math.max(1, video.currentTime * 1000));
    const landmarks = result?.landmarks?.[0] as NormalizedLandmark[] | undefined;
    if (!landmarks) return;

    drawGuides(ctx, landmarks, canvas.width, canvas.height, guides, colorMode, showLabels, showPoints, lineWidth);
  }, [colorMode, exportMode, guides, lineWidth, showLabels, showPoints]);

  const tickPreview = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      animationRef.current = requestAnimationFrame(tickPreview);
      return;
    }

    if (video.paused || video.ended || video.readyState < 2) {
      if (!video.paused && !video.ended) {
        animationRef.current = requestAnimationFrame(tickPreview);
      }
      return;
    }

    if (video.currentTime !== lastTimeRef.current) {
      lastTimeRef.current = video.currentTime;
      renderFrame(video, canvas);
    }

    animationRef.current = requestAnimationFrame(tickPreview);
  }, [renderFrame]);

  const startPreview = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(tickPreview);
  }, [tickPreview]);

  const onVideoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoFileName(file.name.replace(/\.[^.]+$/, "") || "boxing-clip");
    setStatus(`Loaded ${file.name}`);
    lastTimeRef.current = -1;
    cancelAnimationFrame(animationRef.current);
  }, [videoUrl]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const exportOverlay = useCallback(async () => {
    if (!videoUrl || !landmarkerRef.current) {
      setStatus("Need a video and a loaded pose model first.");
      return;
    }

    setExporting(true);
    setStatus("Rendering overlay export...");

    const exportVideo = document.createElement("video");
    exportVideo.src = videoUrl;
    exportVideo.muted = true;
    exportVideo.playsInline = true;
    exportVideo.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      exportVideo.onloadedmetadata = () => resolve();
      exportVideo.onerror = () => reject(new Error("Could not load video for export"));
    });

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportVideo.videoWidth;
    exportCanvas.height = exportVideo.videoHeight;

    const mimeType =
      MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

    const stream = exportCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    let stoppedResolve: (() => void) | null = null;
    const stopped = new Promise<void>((resolve) => {
      stoppedResolve = resolve;
    });
    recorder.onstop = () => stoppedResolve?.();

    let raf = 0;
    let lastTime = -1;

    const render = () => {
      if (exportVideo.ended) {
        recorder.stop();
        return;
      }

      if (!exportVideo.paused && exportVideo.readyState >= 2 && exportVideo.currentTime !== lastTime) {
        lastTime = exportVideo.currentTime;
        renderFrame(exportVideo, exportCanvas);
      }

      raf = requestAnimationFrame(render);
    };

    recorder.start(200);
    await exportVideo.play();
    render();
    await stopped;
    cancelAnimationFrame(raf);

    const blob = new Blob(chunks, { type: mimeType });
    const filename = `${videoFileName}-${exportMode}-${colorMode}-${activeGuides}.webm`;
    downloadBlob(blob, filename);
    setStatus(`Exported ${filename}`);
    setExporting(false);
  }, [activeGuides, colorMode, downloadBlob, exportMode, renderFrame, videoFileName, videoUrl]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 80px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Pose Overlay Export</h1>
        <p style={{ margin: "8px 0 0", color: "#666", maxWidth: 760 }}>
          Upload a clip, choose which boxing guides to draw, then export either a black-background overlay
          for Premiere or a preview version with the original video underneath.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, alignItems: "start" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff" }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Clip</label>
          <input type="file" accept="video/*" onChange={onVideoUpload} />

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Colour mode</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["wrong", "right", "neutral"] as ColorMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: colorMode === mode ? "2px solid #111" : "1px solid #d1d5db",
                    background: colorMode === mode ? "#f3f4f6" : "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Export mode</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["overlay", "preview"] as ExportMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExportMode(mode)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: exportMode === mode ? "2px solid #111" : "1px solid #d1d5db",
                    background: exportMode === mode ? "#f3f4f6" : "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {mode === "overlay" ? "Overlay only" : "Preview with video"}
                </button>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
              Overlay-only exports use a black background, so you can drop them in Premiere and use Screen/Add.
            </p>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Guides to draw</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {([
                ["skeleton", "Skeleton"],
                ["hipHinge", "Hip hinge"],
                ["chinHeight", "Chin height"],
                ["elbowFlare", "Elbow flare"],
                ["stanceWidth", "Stance width"],
                ["shoulderFrame", "Shoulder / frame"],
              ] as [GuideKey, string][]).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={guides[key]}
                    onChange={(e) => setGuides((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
              Show labels
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />
              Show landmark dots
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Line width: {lineWidth}px</label>
            <input type="range" min={2} max={8} step={1} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} />
          </div>

          <button
            onClick={exportOverlay}
            disabled={!videoUrl || exporting || mpLoading || !!mpError}
            style={{
              width: "100%",
              marginTop: 18,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: exporting ? "#9ca3af" : "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            {exporting ? "Exporting..." : "Export overlay"}
          </button>

          <div style={{ marginTop: 12, fontSize: 13, color: mpError ? "#b91c1c" : "#4b5563" }}>
            {mpLoading ? "Loading MediaPipe Pose..." : mpError || status}
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, background: "#fff" }}>
          <div style={{ position: "relative", background: "#000", borderRadius: 12, overflow: "hidden" }}>
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  onPlay={startPreview}
                  onSeeked={startPreview}
                  style={{ width: "100%", display: "block", opacity: exportMode === "overlay" ? 0.18 : 1 }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                />
              </>
            ) : (
              <div style={{ aspectRatio: "16 / 9", display: "grid", placeItems: "center", color: "#9ca3af" }}>
                Upload a clip to preview guides.
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 8, fontSize: 13, color: "#4b5563" }}>
            <div><strong>Good for:</strong> hip hinge, chin height, elbow flare, stance width, shoulder tilt, clean wrong/right overlays.</div>
            <div><strong>Premiere tip:</strong> for overlay-only exports, put the WebM above the source clip and try <strong>Screen</strong> or <strong>Linear Dodge (Add)</strong>.</div>
            <div><strong>Workflow:</strong> export multiple passes, like <em>wrong-red-elbow</em>, <em>right-green-hip</em>, <em>neutral-stance-width</em>, then stack or trim them in the edit.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
