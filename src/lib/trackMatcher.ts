import type { Point } from '@/types';

// Pure matching logic for following one person through a clip. Kept free of DOM/video
// so it can be reasoned about and tested on its own.

export type Look = number[];
export type Candidate = Point & { w: number; h: number; look: Look | null };
export type Sample = Point & { t: number; w: number; h: number };

export type MatcherState = {
  last: Sample; // last confident position
  velocity: Point; // frame units per second
  reference: Look | null; // appearance of the followed person (shirt colours)
  uncertainSince: number | null;
  // A similar-looking person was right next to ours at the last match, so one box may hide two people.
  neighbourNear: boolean;
};

export type StepResult =
  | { kind: 'match'; sample: Sample }
  | { kind: 'wait' } // nothing usable this sample; keep predicting
  | { kind: 'lost' }
  | { kind: 'crowded' };

// Base search radius per sample, in heights of the followed person.
export const MATCH_HEIGHTS = 0.6;
const SAMPLE_SECONDS = 0.25;
// How long we keep predicting through misses or ambiguity before giving up.
export const MAX_GAP_SECONDS = 1.25;
export const MAX_UNCERTAIN_SECONDS = 2;
const WEIGHT_POSITION = 1;
const WEIGHT_SIZE = 0.6;
const WEIGHT_LOOK = 1.5;
const MAX_COST = 1.6;
// Below this colour similarity a detection is someone else (e.g. the player hiding ours), never a match.
const MIN_SIMILARITY = 0.6;
// Within this many heights a similar-looking person counts as a neighbour that could swap with ours.
const NEIGHBOUR_HEIGHTS = 1;
// When two neighbours merge into one box, wait this long for them to separate before trusting it.
const MERGE_WAIT_SECONDS = 1;
// The best candidate must beat the runner-up by this much to be trusted.
const MIN_MARGIN = 0.3;
const VELOCITY_BLEND = 0.5;
const LOOK_BLEND = 0.1;
// Cap prediction so a noisy velocity cannot throw the search window across the pitch.
const MAX_PREDICT_HEIGHTS = 3;

const DARK_V = 0.2;
const GREY_S = 0.25;
const WHITE_V = 0.6;
const HUE_BINS = 12;
export const LOOK_BINS = 3 + HUE_BINS;

export function createMatcher(start: Sample, reference: Look | null): MatcherState {
  return { last: start, velocity: { x: 0, y: 0 }, reference, uncertainSince: null, neighbourNear: false };
}

// Colour histogram of the torso area of a box, from RGBA pixels of a square canvas.
export function lookOf(
  pixels: Uint8ClampedArray,
  size: number,
  box: { originX: number; originY: number; width: number; height: number },
): Look | null {
  const x0 = Math.max(0, Math.floor(box.originX + box.width * 0.25));
  const x1 = Math.min(size, Math.ceil(box.originX + box.width * 0.75));
  const y0 = Math.max(0, Math.floor(box.originY + box.height * 0.15));
  const y1 = Math.min(size, Math.ceil(box.originY + box.height * 0.5));
  const bins = new Array<number>(LOOK_BINS).fill(0);
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * size + x) * 4;
      bins[binOf(pixels[i], pixels[i + 1], pixels[i + 2])]++;
      count++;
    }
  }
  if (count === 0) return null;
  return bins.map((value) => value / count);
}

function binOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  if (v < DARK_V) return 0;
  if (s < GREY_S) return v < WHITE_V ? 1 : 2;
  let hue: number;
  if (max === r) hue = ((g - b) / (max - min) + 6) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  return 3 + Math.min(HUE_BINS - 1, Math.floor((hue / 6) * HUE_BINS));
}

// Bhattacharyya coefficient: 1 means identical colour mix, 0 means nothing in common.
export function similarity(a: Look, b: Look): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.sqrt(a[i] * b[i]);
  return sum;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function predict(state: MatcherState, t: number, aspect: number): Point {
  const dt = t - state.last.t;
  let dx = state.velocity.x * dt;
  let dy = state.velocity.y * dt;
  const travel = Math.hypot(dx * aspect, dy);
  const limit = MAX_PREDICT_HEIGHTS * state.last.h;
  if (travel > limit) {
    dx *= limit / travel;
    dy *= limit / travel;
  }
  return { x: clamp01(state.last.x + dx), y: clamp01(state.last.y + dy) };
}

// The search radius grows the longer we have gone without a confident match.
export function reach(state: MatcherState, t: number): number {
  const steps = Math.max(1, (t - state.last.t) / SAMPLE_SECONDS);
  return MATCH_HEIGHTS * state.last.h * (1 + 0.5 * (steps - 1));
}

function costOf(state: MatcherState, candidate: Candidate, predicted: Point, radius: number, aspect: number): number {
  const distance = Math.hypot((candidate.x - predicted.x) * aspect, candidate.y - predicted.y);
  const position = distance / radius;
  const size = Math.abs(Math.log(candidate.h / state.last.h));
  const look =
    state.reference && candidate.look ? 1 - similarity(state.reference, candidate.look) : 0;
  return WEIGHT_POSITION * position + WEIGHT_SIZE * size + WEIGHT_LOOK * look;
}

// Decide which detection (if any) is the followed person at time t. Mutates state.
export function step(state: MatcherState, t: number, detections: Candidate[], aspect: number): StepResult {
  const predicted = predict(state, t, aspect);
  const radius = reach(state, t);
  const lookalikes = detections.filter(
    (box) => !state.reference || !box.look || similarity(state.reference, box.look) >= MIN_SIMILARITY,
  );
  const scored = lookalikes
    .filter((box) => Math.hypot((box.x - predicted.x) * aspect, box.y - predicted.y) <= radius)
    .map((box) => ({ box, cost: costOf(state, box, predicted, radius, aspect) }))
    .filter((item) => item.cost <= MAX_COST)
    .sort((a, b) => a.cost - b.cost);

  const [best, second] = scored;
  const confident = best !== undefined && (second === undefined || second.cost - best.cost >= MIN_MARGIN);

  if (!confident) {
    if (best !== undefined) {
      // Someone is there but we cannot tell who: keep predicting until they separate.
      if (state.uncertainSince === null) state.uncertainSince = t;
      return t - state.uncertainSince > MAX_UNCERTAIN_SECONDS ? { kind: 'crowded' } : { kind: 'wait' };
    }
    return t - state.last.t > MAX_GAP_SECONDS ? { kind: 'lost' } : { kind: 'wait' };
  }

  const { box } = best;
  const dt = t - state.last.t;
  // Two similar players became one box: it could be either of them, so coast until they split.
  if (state.neighbourNear && scored.length === 1 && dt <= MERGE_WAIT_SECONDS) return { kind: 'wait' };

  if (dt > 0) {
    state.velocity = {
      x: state.velocity.x * (1 - VELOCITY_BLEND) + ((box.x - state.last.x) / dt) * VELOCITY_BLEND,
      y: state.velocity.y * (1 - VELOCITY_BLEND) + ((box.y - state.last.y) / dt) * VELOCITY_BLEND,
    };
  }
  // Only learn appearance when the person stands alone, so a neighbour's colours never leak in.
  const look = box.look;
  if (scored.length === 1 && look) {
    state.reference = state.reference
      ? state.reference.map((value, i) => value * (1 - LOOK_BLEND) + look[i] * LOOK_BLEND)
      : look;
  }
  state.uncertainSince = null;
  state.neighbourNear = lookalikes.some(
    (other) => other !== box && Math.hypot((other.x - box.x) * aspect, other.y - box.y) <= NEIGHBOUR_HEIGHTS * box.h,
  );
  state.last = { t, x: box.x, y: box.y, w: box.w, h: box.h };
  return { kind: 'match', sample: state.last };
}
