import type { Point, TrackPoint } from '@/types';

export type Spot = Point & { w?: number; h?: number };

export function pointAt(track: TrackPoint[], time: number): Spot {
  const first = track[0];
  const last = track[track.length - 1];
  if (time <= first.t) return first;
  if (time >= last.t) return last;

  let low = 0;
  let high = track.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (track[mid].t <= time) low = mid;
    else high = mid;
  }
  const a = track[low];
  const b = track[high];
  const k = (time - a.t) / (b.t - a.t || 1);
  const mix = (p: number, q: number) => p + (q - p) * k;
  const spot: Spot = { x: mix(a.x, b.x), y: mix(a.y, b.y) };
  if (a.w !== undefined && a.h !== undefined && b.w !== undefined && b.h !== undefined) {
    spot.w = mix(a.w, b.w);
    spot.h = mix(a.h, b.h);
  }
  return spot;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function shiftTrack(track: TrackPoint[], dx: number, dy: number): TrackPoint[] {
  return track.map((point) => ({ ...point, x: clamp01(point.x + dx), y: clamp01(point.y + dy) }));
}
