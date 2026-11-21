import { HALO_RADIUS, isActive } from '@/lib/overlay';
import { pointAt } from '@/lib/track';
import type { Annotation, Player, Point, ProjectData } from '@/types';

const HIT_TOLERANCE = 0.025;
const LABEL_HALF_WIDTH = 0.12;
const LABEL_HEIGHT = 0.08;

export type Target = { kind: 'player'; player: Player } | { kind: 'annotation'; annotation: Annotation };

// Distances are measured in frame-height units so sideways and vertical distances match on screen.
function toHeightUnits(point: Point, aspect: number): Point {
  return { x: point.x * aspect, y: point.y };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0 ? 0 : Math.min(Math.max(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0), 1);
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

function touchesAnnotation(annotation: Annotation, point: Point, aspect: number): boolean {
  const from = toHeightUnits(annotation.from, aspect);
  if (annotation.kind === 'label') {
    return (
      Math.abs(point.x - from.x) <= LABEL_HALF_WIDTH &&
      point.y <= from.y + HIT_TOLERANCE &&
      point.y >= from.y - LABEL_HEIGHT
    );
  }
  const to = toHeightUnits(annotation.to, aspect);
  if (annotation.kind === 'circle') return distance(point, from) <= distance(from, to) + HIT_TOLERANCE;
  return distanceToSegment(point, from, to) <= HIT_TOLERANCE;
}

export function targetAt(data: ProjectData, time: number, point: Point, aspect: number): Target | null {
  const target = toHeightUnits(point, aspect);
  for (let i = data.annotations.length - 1; i >= 0; i--) {
    const annotation = data.annotations[i];
    if (isActive(annotation, time) && touchesAnnotation(annotation, target, aspect)) {
      return { kind: 'annotation', annotation };
    }
  }
  for (let i = data.players.length - 1; i >= 0; i--) {
    const player = data.players[i];
    const centre = toHeightUnits(pointAt(player.track, time), aspect);
    if (isActive(player, time) && distance(target, centre) <= HALO_RADIUS + HIT_TOLERANCE) {
      return { kind: 'player', player };
    }
  }
  return null;
}

export function dragPatch(annotation: Annotation, start: Point, current: Point): Partial<Annotation> {
  const minX = Math.min(annotation.from.x, annotation.to.x);
  const maxX = Math.max(annotation.from.x, annotation.to.x);
  const minY = Math.min(annotation.from.y, annotation.to.y);
  const maxY = Math.max(annotation.from.y, annotation.to.y);
  const dx = Math.min(Math.max(current.x - start.x, -minX), 1 - maxX);
  const dy = Math.min(Math.max(current.y - start.y, -minY), 1 - maxY);
  return {
    from: { x: annotation.from.x + dx, y: annotation.from.y + dy },
    to: { x: annotation.to.x + dx, y: annotation.to.y + dy },
  };
}
