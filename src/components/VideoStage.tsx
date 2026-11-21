import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { dragPatch, targetAt, type Target } from '@/lib/hitTest';
import { paintFrame, type OverlayOptions } from '@/lib/overlay';
import { shiftTrack } from '@/lib/track';
import { DEFAULT_DRAWING_COLOR, type Annotation, type Player, type Point, type ProjectData, type ShapeKind, type Tool } from '@/types';

type Props = {
  videoRef: RefObject<HTMLVideoElement>;
  src: string;
  aspectRatio: string;
  tool: Tool;
  data: ProjectData;
  following: Record<string, number>;
  onPlaceHalo: (point: Point) => void;
  onDraw: (kind: ShapeKind, from: Point, to: Point) => void;
  onUpdatePlayer: (playerId: string, patch: Partial<Player>) => void;
  onUpdateAnnotation: (annotationId: string, patch: Partial<Annotation>) => void;
  onTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
};

type Draft = { kind: ShapeKind; from: Point; to: Point };
type Drag = { target: Target; start: Point };

const MIN_DRAW_DISTANCE = 0.01;
const DEFAULT_ASPECT = 16 / 9;

function toPoint(event: PointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
    y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
  };
}

function aspectOf(video: HTMLVideoElement): number {
  return video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : DEFAULT_ASPECT;
}

export default function VideoStage({
  videoRef,
  src,
  aspectRatio,
  tool,
  data,
  following,
  onPlaceHalo,
  onDraw,
  onUpdatePlayer,
  onUpdateAnnotation,
  onTimeChange,
  onPlayingChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const latest = useRef({ data, draft });

  useEffect(() => {
    latest.current = { data, draft };
  }, [data, draft]);

  useEffect(() => {
    let frameId = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext('2d');
        const current = latest.current;
        if (ctx && video.readyState >= 2) {
          const options: OverlayOptions = {
            draft: current.draft ? toDraftAnnotation(current.draft) : null,
            captions: true,
          };
          paintFrame(ctx, video, canvas.width, canvas.height, current.data, options);
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [videoRef]);

  const pickable = { ...data, players: data.players.filter((player) => !(player.id in following)) };

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const point = toPoint(event);
    if (tool === 'view') {
      const video = videoRef.current;
      if (!video) return;
      const target = targetAt(pickable, video.currentTime, point, aspectOf(video));
      if (!target) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { target, start: point };
      event.currentTarget.style.cursor = 'move';
      return;
    }
    if (tool === 'halo') {
      videoRef.current?.pause();
      onPlaceHalo(point);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ kind: tool, from: point, to: point });
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const point = toPoint(event);
    const drag = dragRef.current;
    if (drag) {
      if (drag.target.kind === 'player') {
        onUpdatePlayer(drag.target.player.id, {
          track: shiftTrack(drag.target.player.track, point.x - drag.start.x, point.y - drag.start.y),
        });
      } else {
        onUpdateAnnotation(drag.target.annotation.id, dragPatch(drag.target.annotation, drag.start, point));
      }
      return;
    }
    if (tool === 'view') {
      const video = videoRef.current;
      if (!video) return;
      const hover = targetAt(pickable, video.currentTime, point, aspectOf(video));
      event.currentTarget.style.cursor = hover ? 'move' : 'default';
      return;
    }
    if (!draft) return;
    setDraft({ ...draft, to: point });
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      dragRef.current = null;
      event.currentTarget.style.cursor = 'default';
      return;
    }
    if (!draft) return;
    const end = toPoint(event);
    const distance = Math.hypot(end.x - draft.from.x, end.y - draft.from.y);
    const isLabel = draft.kind === 'label';
    setDraft(null);
    if (isLabel || distance >= MIN_DRAW_DISTANCE) {
      onDraw(draft.kind, draft.from, isLabel ? draft.from : end);
    }
  }

  function handlePointerCancel() {
    dragRef.current = null;
    setDraft(null);
  }

  const cursor = tool === 'view' ? 'default' : 'crosshair';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/50 ring-1 ring-slate-800">
      <canvas
        ref={canvasRef}
        style={{ aspectRatio, cursor }}
        className="block h-auto w-full touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      <video
        ref={videoRef}
        src={src}
        preload="auto"
        playsInline
        onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime)}
        onSeeked={(event) => onTimeChange(event.currentTarget.currentTime)}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
    </div>
  );
}

function toDraftAnnotation(draft: Draft): Annotation {
  return {
    id: 'draft',
    kind: draft.kind,
    t: 0,
    duration: 0,
    color: DEFAULT_DRAWING_COLOR,
    from: draft.from,
    to: draft.to,
    text: '',
  };
}
