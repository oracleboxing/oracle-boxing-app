# Video Analysis - Technical Reference

## Tech Stack

**MediaPipe Pose Landmarker** (Google)
- Runs entirely in-browser (WASM + GPU)
- Zero server costs, zero API calls
- Detects 33 body landmarks in real-time
- npm: `@mediapipe/tasks-vision`

**Official Docs:**
- Overview: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- Web JS Guide: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Python Guide: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python

## How It Works

1. User uploads a video or opens their camera
2. MediaPipe processes each frame client-side
3. Returns 33 landmark coordinates (x, y, z) per frame
4. We overlay a skeleton on the video using Canvas
5. We calculate joint angles from the landmark positions
6. Boxing Brain interprets the angles and gives coaching feedback

## 33 Pose Landmarks

```
0:  nose              17: left pinky
1:  left eye inner    18: right pinky
2:  left eye          19: left index
3:  left eye outer    20: right index
4:  right eye inner   21: left thumb
5:  right eye         22: right thumb
6:  right eye outer   23: left hip
7:  left ear          24: right hip
8:  right ear         25: left knee
9:  left mouth        26: right knee
10: right mouth       27: left ankle
11: left shoulder     28: right ankle
12: right shoulder    29: left heel
13: left elbow        30: right heel
14: right elbow       31: left foot index
15: left wrist        32: right foot index
16: right wrist
```

## Key Boxing Angles

| Measurement | Landmarks | What it tells you |
|-------------|-----------|-------------------|
| Lead elbow | 11→13→15 (L) or 12→14→16 (R) | Jab extension, guard tightness |
| Rear elbow | Opposite side | Cross extension, rear guard |
| Knee bend | 23→25→27 (L) or 24→26→28 (R) | Stance depth, athletic position |
| Hip hinge | 12→24→26 (R) or 11→23→25 (L) | Weight distribution, hip engagement |
| Shoulder rotation | 11→12 line angle | Side-on vs square stance |
| Guard height | Wrist Y vs nose Y | Hands up or dropped |
| Head position | Nose X vs hip midpoint X | Leaning forward (bad) vs centered |

## Model Options

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `pose_landmarker_lite` | 5MB | Fastest | Good enough for most use |
| `pose_landmarker_full` | 13MB | Medium | Better accuracy |
| `pose_landmarker_heavy` | 30MB | Slowest | Best accuracy |

Start with lite. Upgrade to full if accuracy isn't good enough.

## Running Modes

- `IMAGE` - Single photo analysis
- `VIDEO` - Uploaded video (frame-by-frame)
- `LIVE_STREAM` - Webcam real-time

## Code Example (Next.js)

```typescript
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// Initialize
const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    delegate: "GPU",
  },
  runningMode: "VIDEO",
  numPoses: 1,
});

// Detect on video frame
const result = poseLandmarker.detectForVideo(videoElement, performance.now());
// result.landmarks[0] = array of 33 {x, y, z} points

// Calculate angle between 3 points
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return Math.round(angle);
}
```

## APECS Reference

APECS is a commercial motion analysis app we're using as inspiration:
- Frame-by-frame video scrubbing
- Angle measurements between body points
- Green marker auto-tracking
- PDF reports with angles and notes
- $2.49-$5.99/mo pricing

**What we're building that APECS doesn't have:**
- Boxing-specific AI feedback (via Boxing Brain)
- Technique comparison against correct form
- Integration with our drill library and workout system
- Community context (what the student is working on)

## Python (Offline Processing)

For batch processing or server-side analysis:

```bash
pip install mediapipe
```

```python
import mediapipe as mp

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Process frame
results = pose.process(rgb_frame)
if results.pose_landmarks:
    for landmark in results.pose_landmarks.landmark:
        print(landmark.x, landmark.y, landmark.z, landmark.visibility)
```

Note: Python requires `pip3` which isn't currently available on the server. Install when needed.

## Test Page

A working test page is at `/analysis` in the app. Upload a video or use your camera to see the pose detection in action with angle overlays.
