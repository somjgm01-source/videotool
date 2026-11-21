import { pointAt, type Spot } from '@/lib/track';
import type { Annotation, Point, ProjectData } from '@/types';

const CAPTION_SECONDS = 3;
const FONT_FAMILY = 'Inter, system-ui, sans-serif';
export const HALO_RADIUS = 0.055;

export type OverlayOptions = {
  draft: Annotation | null;
  captions: boolean;
};

export type Timed = { t: number; duration: number };

export function paintFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  data: ProjectData,
  options: OverlayOptions,
) {
  ctx.drawImage(video, 0, 0, width, height);
  drawOverlay(ctx, width, height, video.currentTime, data, options);
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  data: ProjectData,
  options: OverlayOptions,
) {
  for (const player of data.players) {
    if (isActive(player, time)) drawHalo(ctx, width, height, player, pointAt(player.track, time));
  }
  for (const annotation of data.annotations) {
    if (isActive(annotation, time)) drawAnnotation(ctx, width, height, annotation);
  }
  if (options.draft) drawAnnotation(ctx, width, height, options.draft);
  if (options.captions) drawCaption(ctx, width, height, time, data);
}

export function isActive(item: Timed, time: number): boolean {
  return time >= item.t && time <= item.t + item.duration;
}

function drawHalo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: { name: string; color: string },
  centre: Spot,
) {
  const cx = centre.x * width;
  const cy = centre.y * height;
  const radius = Math.max(HALO_RADIUS * height, 22);

  ctx.save();
  ctx.lineWidth = Math.max(3, width / 400);
  ctx.strokeStyle = player.color;
  ctx.fillStyle = player.color;
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.restore();

  let labelBottom = cy - radius;
  if (centre.w !== undefined && centre.h !== undefined) {
    const boxWidth = centre.w * width;
    const boxHeight = centre.h * height;
    ctx.save();
    ctx.lineWidth = Math.max(2, width / 500);
    ctx.strokeStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 10;
    roundedRectPath(ctx, cx - boxWidth / 2, cy - boxHeight / 2, boxWidth, boxHeight, Math.min(boxWidth, boxHeight) * 0.12);
    ctx.stroke();
    ctx.restore();
    labelBottom = cy - boxHeight / 2;
  }

  drawPill(ctx, player.name, cx, labelBottom - 8, player.color, '#020617', Math.max(14, width / 90));
}

function drawAnnotation(ctx: CanvasRenderingContext2D, width: number, height: number, annotation: Annotation) {
  const from = { x: annotation.from.x * width, y: annotation.from.y * height };
  const to = { x: annotation.to.x * width, y: annotation.to.y * height };
  const size = Math.max(14, width / 90);

  if (annotation.kind === 'label') {
    drawPill(ctx, annotation.text || 'Note', from.x, from.y, annotation.color, '#020617', size);
    return;
  }

  const lineWidth = Math.max(3, width / 350);
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.strokeStyle = annotation.color;
  ctx.fillStyle = annotation.color;
  ctx.shadowColor = 'rgba(2, 6, 23, 0.6)';
  ctx.shadowBlur = 6;

  if (annotation.kind === 'circle') {
    const radius = Math.hypot(to.x - from.x, to.y - from.y);
    ctx.beginPath();
    ctx.arc(from.x, from.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    if (annotation.kind === 'arrow') drawArrowHead(ctx, from, to, lineWidth * 4);
  }
  ctx.restore();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawCaption(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, data: ProjectData) {
  const marker = data.markers
    .filter((item) => time >= item.t && time - item.t < CAPTION_SECONDS)
    .sort((a, b) => b.t - a.t)[0];
  if (!marker || !marker.note) return;
  drawPill(ctx, marker.note, width / 2, height * 0.94, 'rgba(2, 6, 23, 0.85)', '#f8fafc', Math.max(18, width / 60));
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  bottomY: number,
  background: string,
  foreground: string,
  size: number,
) {
  ctx.save();
  ctx.font = `600 ${size}px ${FONT_FAMILY}`;
  const padX = size * 0.6;
  const padY = size * 0.35;
  const boxWidth = ctx.measureText(text).width + padX * 2;
  const boxHeight = size + padY * 2;
  const left = centerX - boxWidth / 2;
  const top = bottomY - boxHeight;

  roundedRectPath(ctx, left, top, boxWidth, boxHeight, boxHeight / 2);
  ctx.fillStyle = background;
  ctx.fill();

  ctx.fillStyle = foreground;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, left + padX, top + padY);
  ctx.restore();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
