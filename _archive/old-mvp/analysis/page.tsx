"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// MediaPipe types
type PoseLandmarkerType = any;
type NormalizedLandmark = { x: number; y: number; z: number; visibility?: number };

// Pose landmark indices
const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT: 31,
  RIGHT_FOOT: 32,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
};

// Skeleton connections for drawing
const POSE_CONNECTIONS = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], [27, 31], // left leg
  [24, 26], [26, 28], [28, 32], // right leg
  [11, 23], [12, 24], // spine sides
];

interface FrameMetrics {
  hipHinge: number;
  weightDistribution: number;
  guardHeight: number;
  chinExposure: number;
  stanceWidth: number;
  shoulderRotation: number;
}

interface AggregatedMetrics {
  avgHipHinge: number;
  avgWeightDistribution: number;
  avgGuardHeight: number;
  chinExposure: number;
  stanceWidth: number;
  shoulderRotation: number;
  duration: number;
}

function calcAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (magAB === 0 || magCB === 0) return 180;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

function dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeFrameMetrics(lms: NormalizedLandmark[]): FrameMetrics | null {
  const required = [
    LANDMARKS.NOSE,
    LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
    LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
    LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE,
    LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE,
    LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST,
  ];
  for (const idx of required) {
    if (!lms[idx] || (lms[idx].visibility !== undefined && lms[idx].visibility! < 0.3)) {
      return null;
    }
  }

  // Hip hinge: right shoulder → right hip → right knee
  const hipHinge = calcAngle(
    lms[LANDMARKS.RIGHT_SHOULDER],
    lms[LANDMARKS.RIGHT_HIP],
    lms[LANDMARKS.RIGHT_KNEE]
  );

  // Weight distribution: hip midpoint X relative to feet midpoint X
  const hipMidX = (lms[LANDMARKS.LEFT_HIP].x + lms[LANDMARKS.RIGHT_HIP].x) / 2;
  const leftFoot = lms[LANDMARKS.LEFT_FOOT] || lms[LANDMARKS.LEFT_ANKLE];
  const rightFoot = lms[LANDMARKS.RIGHT_FOOT] || lms[LANDMARKS.RIGHT_ANKLE];
  const frontFootX = Math.min(lms[LANDMARKS.LEFT_ANKLE].x, lms[LANDMARKS.RIGHT_ANKLE].x);
  const backFootX = Math.max(lms[LANDMARKS.LEFT_ANKLE].x, lms[LANDMARKS.RIGHT_ANKLE].x);
  const footRange = backFootX - frontFootX;
  const weightDistribution = footRange > 0.01
    ? Math.max(0, Math.min(1, (hipMidX - frontFootX) / footRange))
    : 0.5;

  // Guard height: are wrists at or above nose Y? (Y increases downward)
  // Negative = hands above nose (good), Positive = hands below nose (dropped)
  const noseY = lms[LANDMARKS.NOSE].y;
  const leftWristY = lms[LANDMARKS.LEFT_WRIST].y;
  const rightWristY = lms[LANDMARKS.RIGHT_WRIST].y;
  const avgWristY = (leftWristY + rightWristY) / 2;
  const guardHeight = noseY - avgWristY; // positive means hands above nose

  // Chin exposure: nose Y relative to shoulder midpoint Y
  // How much the nose Y exceeds the shoulder midpoint Y (lower = tucked)
  const shoulderMidY = (lms[LANDMARKS.LEFT_SHOULDER].y + lms[LANDMARKS.RIGHT_SHOULDER].y) / 2;
  const shoulderMidX = (lms[LANDMARKS.LEFT_SHOULDER].x + lms[LANDMARKS.RIGHT_SHOULDER].x) / 2;
  const noseRelativeY = lms[LANDMARKS.NOSE].y - shoulderMidY;
  const shoulderHeight = Math.abs(shoulderMidY - (lms[LANDMARKS.LEFT_HIP].y + lms[LANDMARKS.RIGHT_HIP].y) / 2);
  const chinExposure = shoulderHeight > 0 ? Math.max(0, Math.min(1, noseRelativeY / shoulderHeight * -1 + 0.5)) : 0.5;
  // Remap: ~0 = chin way up (exposed), ~1 = chin tucked down toward shoulders

  // Stance width: ankle distance / shoulder width
  const ankleWidth = dist2D(lms[LANDMARKS.LEFT_ANKLE], lms[LANDMARKS.RIGHT_ANKLE]);
  const shoulderWidth = dist2D(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER]);
  const stanceWidth = shoulderWidth > 0.01 ? ankleWidth / shoulderWidth : 1.0;

  // Shoulder rotation: angle of shoulder line relative to horizontal
  const dX = lms[LANDMARKS.RIGHT_SHOULDER].x - lms[LANDMARKS.LEFT_SHOULDER].x;
  const dY = lms[LANDMARKS.RIGHT_SHOULDER].y - lms[LANDMARKS.LEFT_SHOULDER].y;
  const shoulderRotation = Math.abs(Math.atan2(dY, dX) * 180 / Math.PI);

  return {
    hipHinge,
    weightDistribution,
    guardHeight,
    chinExposure,
    stanceWidth,
    shoulderRotation,
  };
}

function averageMetrics(frames: FrameMetrics[], duration: number): AggregatedMetrics {
  if (frames.length === 0) {
    return {
      avgHipHinge: 170,
      avgWeightDistribution: 0.5,
      avgGuardHeight: 0,
      chinExposure: 0.5,
      stanceWidth: 1.3,
      shoulderRotation: 30,
      duration,
    };
  }
  const sum = frames.reduce(
    (acc, f) => ({
      hipHinge: acc.hipHinge + f.hipHinge,
      weightDistribution: acc.weightDistribution + f.weightDistribution,
      guardHeight: acc.guardHeight + f.guardHeight,
      chinExposure: acc.chinExposure + f.chinExposure,
      stanceWidth: acc.stanceWidth + f.stanceWidth,
      shoulderRotation: acc.shoulderRotation + f.shoulderRotation,
    }),
    { hipHinge: 0, weightDistribution: 0, guardHeight: 0, chinExposure: 0, stanceWidth: 0, shoulderRotation: 0 }
  );
  const n = frames.length;
  return {
    avgHipHinge: sum.hipHinge / n,
    avgWeightDistribution: sum.weightDistribution / n,
    avgGuardHeight: sum.guardHeight / n,
    chinExposure: sum.chinExposure / n,
    stanceWidth: sum.stanceWidth / n,
    shoulderRotation: sum.shoulderRotation / n,
    duration,
  };
}

export default function AnalysisPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const landmarkerRef = useRef<PoseLandmarkerType>(null);
  const metricsAccRef = useRef<FrameMetrics[]>([]);
  const lastVideoTimeRef = useRef<number>(-1);

  const [mpLoading, setMpLoading] = useState(true);
  const [mpError, setMpError] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<FrameMetrics | null>(null);
  const [aggregated, setAggregated] = useState<AggregatedMetrics | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);

  // Init MediaPipe
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const { PoseLandmarker, FilesetResolver } = vision;

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

        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setMpLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMpError(err?.message || "Failed to load MediaPipe");
          setMpLoading(false);
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const drawSkeleton = useCallback(
    (lms: NormalizedLandmark[], ctx: CanvasRenderingContext2D, w: number, h: number) => {
      // Draw connections
      ctx.strokeStyle = "#C4985A";
      ctx.lineWidth = 2;
      for (const [a, b] of POSE_CONNECTIONS) {
        if (!lms[a] || !lms[b]) continue;
        if ((lms[a].visibility ?? 1) < 0.3 || (lms[b].visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(lms[a].x * w, lms[a].y * h);
        ctx.lineTo(lms[b].x * w, lms[b].y * h);
        ctx.stroke();
      }
      // Draw landmark dots
      for (const lm of lms) {
        if ((lm.visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#37322F";
        ctx.fill();
        ctx.strokeStyle = "#C4985A";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    []
  );

  const drawAngleLabel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      lm: NormalizedLandmark,
      text: string,
      w: number,
      h: number
    ) => {
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#C4985A";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      const x = lm.x * w + 8;
      const y = lm.y * h - 6;
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    },
    []
  );

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (video.paused || video.ended) {
      if (video.ended) {
        // Final aggregation
        const dur = video.duration || 0;
        const agg = averageMetrics(metricsAccRef.current, dur);
        setAggregated(agg);
        setVideoEnded(true);
      }
      return;
    }

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (video.currentTime === lastVideoTimeRef.current) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastVideoTimeRef.current = video.currentTime;

    // Sync canvas size
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const timestampMs = performance.now();
      const result = landmarker.detectForVideo(video, timestampMs);
      if (result?.landmarks?.[0]) {
        const lms: NormalizedLandmark[] = result.landmarks[0];
        drawSkeleton(lms, ctx, canvas.width, canvas.height);

        const m = computeFrameMetrics(lms);
        if (m) {
          metricsAccRef.current.push(m);
          setCurrentMetrics(m);

          // Draw angle labels
          if (lms[LANDMARKS.RIGHT_HIP]) {
            drawAngleLabel(ctx, lms[LANDMARKS.RIGHT_HIP], `${m.hipHinge.toFixed(0)}°`, canvas.width, canvas.height);
          }
          const frontPct = Math.round(m.weightDistribution * 100);
          if (lms[LANDMARKS.RIGHT_ANKLE]) {
            drawAngleLabel(ctx, lms[LANDMARKS.RIGHT_ANKLE], `W:${frontPct}%`, canvas.width, canvas.height);
          }
        }
      }
    } catch (e) {
      // Silently skip frame errors
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [drawSkeleton, drawAngleLabel]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);
      setCurrentMetrics(null);
      setAggregated(null);
      setFeedback(null);
      setVideoEnded(false);
      metricsAccRef.current = [];
      lastVideoTimeRef.current = -1;
      cancelAnimationFrame(animationRef.current);
    },
    [videoUrl]
  );

  const handleVideoPlay = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(processFrame);
  }, [processFrame]);

  const handleVideoEnded = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    const video = videoRef.current;
    const dur = video?.duration || 0;
    const agg = averageMetrics(metricsAccRef.current, dur);
    setAggregated(agg);
    setVideoEnded(true);
  }, []);

  const handleGetReview = useCallback(async () => {
    const video = videoRef.current;
    const dur = video?.duration || 0;
    const agg = aggregated || averageMetrics(metricsAccRef.current, dur);
    setAggregated(agg);
    setLoadingFeedback(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/analysis/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: agg }),
      });
      const data = await res.json();
      if (data.feedback) {
        setFeedback(data.feedback);
      } else {
        setFeedback("Could not generate feedback. Please try again.");
      }
    } catch {
      setFeedback("Network error. Please try again.");
    } finally {
      setLoadingFeedback(false);
    }
  }, [aggregated]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const frontPct = currentMetrics
    ? Math.round(currentMetrics.weightDistribution * 100)
    : null;
  const backPct = frontPct !== null ? 100 - frontPct : null;

  const isReadyToAnalyse =
    !mpLoading && (videoEnded || (metricsAccRef.current.length > 0));

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        padding: "16px 16px 80px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Form Analysis
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            margin: "4px 0 0",
          }}
        >
          Upload a boxing video to analyse your technique
        </p>
      </div>

      {/* MediaPipe status */}
      {mpLoading && (
        <div
          style={{
            background: "var(--surface-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>⏳</span>
          Loading pose detection model...
        </div>
      )}
      {mpError && (
        <div
          style={{
            background: "rgba(184,84,80,0.1)",
            border: "1px solid var(--accent-red)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--accent-red)",
          }}
        >
          ⚠️ Pose detection unavailable: {mpError}. You can still upload and analyse.
        </div>
      )}

      {/* Upload */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: videoFile
            ? "var(--surface-secondary)"
            : "var(--accent-gold)",
          color: videoFile ? "var(--text-primary)" : "#fff",
          border: videoFile
            ? "1px solid var(--border)"
            : "none",
          borderRadius: 12,
          padding: "14px 20px",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 16,
          transition: "opacity 0.2s",
        }}
      >
        <span style={{ fontSize: 18 }}>📹</span>
        {videoFile ? videoFile.name.slice(0, 30) : "Upload Boxing Video"}
        <input
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </label>

      {/* Video + Canvas overlay */}
      {videoUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: 12,
            overflow: "hidden",
            background: "#000",
            marginBottom: 16,
            border: "1px solid var(--border)",
          }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            onPlay={handleVideoPlay}
            onEnded={handleVideoEnded}
            style={{ width: "100%", display: "block" }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Live Metrics Panel */}
      {videoUrl && (
        <div
          style={{
            background: "var(--surface-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              margin: "0 0 12px",
            }}
          >
            Live Metrics
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <MetricCard
              label="Weight"
              value={
                currentMetrics
                  ? `Front ${Math.round(currentMetrics.weightDistribution * 100)}% / Back ${100 - Math.round(currentMetrics.weightDistribution * 100)}%`
                  : "—"
              }
            />
            <MetricCard
              label="Hip Hinge"
              value={
                currentMetrics
                  ? `${currentMetrics.hipHinge.toFixed(0)}°`
                  : "—"
              }
            />
            <MetricCard
              label="Chin"
              value={
                currentMetrics
                  ? currentMetrics.chinExposure > 0.55
                    ? "Exposed ⚠️"
                    : "Tucked ✅"
                  : "—"
              }
              good={currentMetrics ? currentMetrics.chinExposure <= 0.55 : null}
            />
            <MetricCard
              label="Guard"
              value={
                currentMetrics
                  ? currentMetrics.guardHeight > -0.03
                    ? "High ✅"
                    : "Dropped ⚠️"
                  : "—"
              }
              good={currentMetrics ? currentMetrics.guardHeight > -0.03 : null}
            />
            <MetricCard
              label="Stance"
              value={
                currentMetrics
                  ? currentMetrics.stanceWidth >= 1.2
                    ? "Wide ✅"
                    : "Narrow ⚠️"
                  : "—"
              }
              good={currentMetrics ? currentMetrics.stanceWidth >= 1.2 : null}
            />
            <MetricCard
              label="Shoulder"
              value={
                currentMetrics
                  ? `${currentMetrics.shoulderRotation.toFixed(0)}°`
                  : "—"
              }
            />
          </div>
          {metricsAccRef.current.length > 0 && (
            <p
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 10,
                marginBottom: 0,
                textAlign: "right",
              }}
            >
              {metricsAccRef.current.length} frames analysed
            </p>
          )}
        </div>
      )}

      {/* Get Form Review button */}
      {videoUrl && (
        <button
          onClick={handleGetReview}
          disabled={loadingFeedback || mpLoading}
          style={{
            width: "100%",
            background:
              loadingFeedback || mpLoading
                ? "var(--border)"
                : "var(--accent-gold)",
            color:
              loadingFeedback || mpLoading ? "var(--text-secondary)" : "#fff",
            border: "none",
            borderRadius: 12,
            padding: "15px 20px",
            fontSize: 16,
            fontWeight: 700,
            cursor: loadingFeedback || mpLoading ? "not-allowed" : "pointer",
            marginBottom: 16,
            transition: "opacity 0.2s",
          }}
        >
          {loadingFeedback ? "Analysing..." : "🥊 Get Form Review"}
        </button>
      )}

      {/* Averaged metrics summary (post analysis) */}
      {aggregated && (
        <div
          style={{
            background: "var(--surface-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              margin: "0 0 12px",
            }}
          >
            Session Average
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <MetricCard
              label="Hip Hinge"
              value={`${aggregated.avgHipHinge.toFixed(0)}°`}
            />
            <MetricCard
              label="Weight"
              value={`Front ${Math.round(aggregated.avgWeightDistribution * 100)}%`}
            />
            <MetricCard
              label="Guard"
              value={aggregated.avgGuardHeight > -0.03 ? "High ✅" : "Dropped ⚠️"}
              good={aggregated.avgGuardHeight > -0.03}
            />
            <MetricCard
              label="Stance"
              value={aggregated.stanceWidth >= 1.2 ? "Wide ✅" : "Narrow ⚠️"}
              good={aggregated.stanceWidth >= 1.2}
            />
          </div>
        </div>
      )}

      {/* AI Feedback */}
      {feedback && (
        <div
          style={{
            background: "var(--surface-elevated)",
            border: "1px solid var(--accent-gold)",
            borderRadius: 12,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--accent-gold)",
              textTransform: "uppercase",
              margin: "0 0 12px",
            }}
          >
            🥊 Coach Feedback
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-primary)",
              lineHeight: 1.6,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {feedback}
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean | null;
}) {
  return (
    <div
      style={{
        background: "var(--surface-elevated)",
        border: `1px solid ${
          good === true
            ? "var(--accent-green)"
            : good === false
            ? "var(--accent-red)"
            : "var(--border)"
        }`,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          margin: "0 0 4px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color:
            good === true
              ? "var(--accent-green)"
              : good === false
              ? "var(--accent-red)"
              : "var(--text-primary)",
          margin: 0,
        }}
      >
        {value}
      </p>
    </div>
  );
}
