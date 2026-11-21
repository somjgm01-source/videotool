import { FilesetResolver, ObjectDetector, type ObjectDetectorResult } from '@mediapipe/tasks-vision';
import { seekVideo } from '@/lib/video';
import type { Point, TrackPoint } from '@/types';

const MODEL_PATH = '/models/efficientdet_lite0.tflite';
const WASM_PATH = '/mediapipe/wasm';
const DETECT_SIZE = 320;
const SAMPLE_SECONDS = 0.25;
const MIN_PERSON_SCORE = 0.25;
const LOCATE_SHARE = 0.4;
const TRACK_HEIGHTS = 9;
const MIN_TRACK_SIDE = 320;
const MATCH_HEIGHTS = 0.6;
const MAX_MISSES = 2;

export type Box = Point & { w: number; h: number };
export type PersonSample = TrackPoint & { w: number; h: number };
export type TrackStop = 'finished' | 'lost' | 'crowded' | 'cancelled';
export type TrackResult = { track: TrackPoint[]; endedAt: number; stop: TrackStop };
export type TrackProgress = (fraction: number, track: TrackPoint[]) => void;

// A square crop of the video frame, in source pixels.
type Region = { x: number; y: number; side: number };

let detectorPromise: Promise<ObjectDetector> | null = null;

function loadDetector(): Promise<ObjectDetector> {
  if (!detectorPromise) {
    detectorPromise = FilesetResolver.forVisionTasks(WASM_PATH)
      .then((vision) =>
        ObjectDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH },
          runningMode: 'IMAGE',
          scoreThreshold: MIN_PERSON_SCORE,
          categoryAllowlist: ['person'],
          maxResults: 40,
        }),
      )
      .catch((err: unknown) => {
        detectorPromise = null;
        throw err;
      });
  }
  return detectorPromise;
}

function createSurface(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = DETECT_SIZE;
  canvas.height = DETECT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot analyse video frames.');
  return { canvas, ctx };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function regionAround(centre: Point, side: number, frameWidth: number, frameHeight: number): Region {
  return {
    x: clamp(Math.round(centre.x - side / 2), 0, frameWidth - side),
    y: clamp(Math.round(centre.y - side / 2), 0, frameHeight - side),
    side,
  };
}

// Full-resolution crops keep small players large enough for the detector to see them.
function detectInRegion(
  detector: ObjectDetector,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  region: Region,
): Box[] {
  ctx.drawImage(video, region.x, region.y, region.side, region.side, 0, 0, DETECT_SIZE, DETECT_SIZE);
  return toBoxes(detector.detect(canvas), region, video.videoWidth, video.videoHeight);
}

function toBoxes(result: ObjectDetectorResult, region: Region, frameWidth: number, frameHeight: number): Box[] {
  const scale = region.side / DETECT_SIZE;
  return result.detections.flatMap((detection) => {
    const box = detection.boundingBox;
    if (!box) return [];
    const centreX = region.x + (box.originX + box.width / 2) * scale;
    const centreY = region.y + (box.originY + box.height / 2) * scale;
    return [
      {
        x: centreX / frameWidth,
        y: centreY / frameHeight,
        w: (box.width * scale) / frameWidth,
        h: (box.height * scale) / frameHeight,
      },
    ];
  });
}

// Distances are in frame-height units so sideways and vertical movement compare fairly.
function distanceInHeights(a: Point, b: Point, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

function personAt(boxes: Box[], point: Point, aspect: number): Box | null {
  let best: Box | null = null;
  let bestDistance = Infinity;
  for (const box of boxes) {
    const inside = Math.abs(point.x - box.x) <= box.w / 2 && Math.abs(point.y - box.y) <= box.h / 2;
    if (!inside) continue;
    const distance = distanceInHeights(point, box, aspect);
    if (distance < bestDistance) {
      best = box;
      bestDistance = distance;
    }
  }
  return best;
}

function requireFrameSize(video: HTMLVideoElement): { width: number; height: number } {
  if (!video.videoWidth || !video.videoHeight) throw new Error('The clip is not ready to analyse yet.');
  return { width: video.videoWidth, height: video.videoHeight };
}

export async function detectPersonAt(video: HTMLVideoElement, point: Point): Promise<Box | null> {
  const detector = await loadDetector();
  const { width, height } = requireFrameSize(video);
  const { canvas, ctx } = createSurface();
  const side = Math.round(LOCATE_SHARE * Math.min(width, height));
  const region = regionAround({ x: point.x * width, y: point.y * height }, side, width, height);
  return personAt(detectInRegion(detector, video, canvas, ctx, region), point, width / height);
}

export async function trackPerson(
  src: string,
  start: PersonSample,
  onProgress: TrackProgress,
  signal: AbortSignal,
): Promise<TrackResult> {
  const detector = await loadDetector();
  const video = await openVideo(src);
  try {
    const { width, height } = requireFrameSize(video);
    const aspect = width / height;
    const shortSide = Math.min(width, height);
    const { canvas, ctx } = createSurface();
    const span = Math.max(video.duration - start.t, 0);
    const track: TrackPoint[] = [start];
    let previous: PersonSample = start;
    let misses = 0;
    let firstMissAt = start.t;

    for (let t = start.t + SAMPLE_SECONDS; t <= video.duration; t += SAMPLE_SECONDS) {
      if (signal.aborted) return { track, endedAt: previous.t, stop: 'cancelled' };
      await seekVideo(video, t);
      const side = Math.min(shortSide, Math.max(MIN_TRACK_SIDE, Math.round(TRACK_HEIGHTS * previous.h * height)));
      const region = regionAround({ x: previous.x * width, y: previous.y * height }, side, width, height);
      const candidates = detectInRegion(detector, video, canvas, ctx, region).filter(
        (box) => distanceInHeights(box, previous, aspect) <= MATCH_HEIGHTS * previous.h,
      );

      if (candidates.length > 1) return { track, endedAt: t, stop: 'crowded' };
      if (candidates.length === 0) {
        if (misses === 0) firstMissAt = t;
        misses++;
        if (misses >= MAX_MISSES) return { track, endedAt: firstMissAt, stop: 'lost' };
      } else {
        misses = 0;
        const [box] = candidates;
        previous = { t, x: box.x, y: box.y, w: box.w, h: box.h };
        track.push(previous);
      }
      onProgress(span > 0 ? (t - start.t) / span : 1, track.slice());
    }

    onProgress(1, track);
    return { track, endedAt: previous.t, stop: 'finished' };
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

function openVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('The clip could not be opened to follow the player.'));
    video.src = src;
  });
}
