import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Download, Loader2 } from 'lucide-react';
import AnnotationPanel from '@/components/AnnotationPanel';
import ExportDialog from '@/components/ExportDialog';
import PlayerPanel from '@/components/PlayerPanel';
import Timeline from '@/components/Timeline';
import TransportBar from '@/components/TransportBar';
import VideoStage from '@/components/VideoStage';
import { getClipCopyUrl, type Clip } from '@/lib/clips';
import { exportAnnotatedVideo } from '@/lib/exportVideo';
import { errorMessage, formatClock } from '@/lib/format';
import { detectPersonAt, trackPerson, type PersonSample } from '@/lib/personTracking';
import { useProject, type SaveState } from '@/hooks/useProject';
import {
  COLOR_OPTIONS,
  DEFAULT_DRAWING_COLOR,
  REST_OF_CLIP_SECONDS,
  type Annotation,
  type Player,
  type Point,
  type ShapeKind,
  type Tool,
  type TrackPoint,
} from '@/types';

type Props = {
  clip: Clip;
  onBack: () => void;
};

const FRAME_SECONDS = 1 / 30;
const DRAWING_SECONDS = 4;

export default function StudioView({ clip, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { data, status, error: projectError, updateData, ready } = useProject(clip.id);

  const [src, setSrc] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tool, setTool] = useState<Tool>('view');
  const [notice, setNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [following, setFollowing] = useState<Record<string, number>>({});
  const [relocatingId, setRelocatingId] = useState<string | null>(null);
  const controllersRef = useRef(new Map<string, AbortController>());

  const duration = clip.duration_seconds;
  const aspectRatio = `${clip.width || 16} / ${clip.height || 9}`;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    getClipCopyUrl(clip.storage_path)
      .then((url) => {
        objectUrl = url;
        if (active) setSrc(url);
      })
      .catch((err: unknown) => {
        if (active) setLinkError(errorMessage(err));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clip.storage_path]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, button') || exportOpen) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((err: unknown) => setNotice(errorMessage(err)));
    } else {
      video.pause();
    }
  }

  function seek(target: number) {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.min(Math.max(target, 0), duration);
    video.currentTime = clamped;
    setTime(clamped);
  }

  function stepFrame(direction: 1 | -1) {
    videoRef.current?.pause();
    seek(time + direction * FRAME_SECONDS);
  }

  function handleToolChange(next: Tool) {
    setTool(next);
    setNotice(null);
    setRelocatingId(null);
  }

  async function locatePerson(point: Point): Promise<PersonSample | null> {
    const video = videoRef.current;
    if (!video) return null;
    const t = video.currentTime;
    setNotice('Finding the person under your click...');
    try {
      const box = await detectPersonAt(video, point);
      if (!box) {
        setNotice('Click directly on a person to follow them.');
        return null;
      }
      setNotice(null);
      return { t, ...box };
    } catch (err: unknown) {
      setNotice(errorMessage(err));
      return null;
    }
  }

  async function handlePlaceHalo(point: Point) {
    if (!src) return;
    if (relocatingId) {
      await resumePlayer(relocatingId, point);
      return;
    }
    const start = await locatePerson(point);
    if (!start) return;
    const usedColours = data.players.map((player) => player.color);
    const player: Player = {
      id: crypto.randomUUID(),
      name: `Player ${data.players.length + 1}`,
      color: (COLOR_OPTIONS.find((option) => !usedColours.includes(option.value)) ?? COLOR_OPTIONS[0]).value,
      t: start.t,
      duration: REST_OF_CLIP_SECONDS,
      track: [start],
    };
    updateData((previous) => ({ ...previous, players: [...previous.players, player] }));
    followPlayer(player.id, src, start, []);
  }

  async function resumePlayer(playerId: string, point: Point) {
    const player = data.players.find((item) => item.id === playerId);
    if (!src || !player) return;
    const start = await locatePerson(point);
    if (!start) return;
    const keep = player.track.filter((item) => item.t < start.t);
    setRelocatingId(null);
    updateData((previous) => ({
      ...previous,
      players: previous.players.map((item) =>
        item.id === playerId
          ? { ...item, track: [...keep, start], duration: REST_OF_CLIP_SECONDS, lostAt: undefined }
          : item,
      ),
    }));
    followPlayer(playerId, src, start, keep);
  }

  function findPlayerAgain(playerId: string) {
    setRelocatingId(playerId);
    setTool('halo');
    setNotice('Move to a moment where you can see them, then click them on the video.');
  }

  function followPlayer(id: string, clipSrc: string, start: PersonSample, keep: TrackPoint[]) {
    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    setFollowing((previous) => ({ ...previous, [id]: 0 }));
    trackPerson(
      clipSrc,
      start,
      (progress, track) => {
        setFollowing((previous) => ({ ...previous, [id]: progress }));
        updateData((previous) => ({
          ...previous,
          players: previous.players.map((item) => (item.id === id ? { ...item, track: [...keep, ...track] } : item)),
        }));
      },
      controller.signal,
    )
      .then(({ track, endedAt, stop }) => {
        updateData((previous) => ({
          ...previous,
          players: previous.players.map((item) => {
            if (item.id !== id) return item;
            const stopped = stop === 'finished' ? {} : { duration: Math.max(endedAt - item.t, 0) };
            const lost = stop === 'lost' || stop === 'crowded' ? { lostAt: endedAt } : {};
            return { ...item, track: [...keep, ...track], ...stopped, ...lost };
          }),
        }));
        if (stop === 'lost') {
          setNotice(`Lost the player at ${formatClock(endedAt)}. Place a new halo on them to keep following.`);
        }
        if (stop === 'crowded') {
          setNotice(`Two people were too close together at ${formatClock(endedAt)}, so tracking stopped. Find them again to continue.`);
        }
      })
      .catch((err: unknown) => setNotice(errorMessage(err)))
      .finally(() => {
        controllersRef.current.delete(id);
        setFollowing((previous) => {
          const next = { ...previous };
          delete next[id];
          return next;
        });
      });
  }

  function cancelFollowing(id: string) {
    controllersRef.current.get(id)?.abort();
  }

  function handleDraw(kind: ShapeKind, from: Point, to: Point) {
    const video = videoRef.current;
    if (!video) return;
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      kind,
      t: video.currentTime,
      duration: DRAWING_SECONDS,
      color: DEFAULT_DRAWING_COLOR,
      from,
      to,
      text: kind === 'label' ? 'Note' : '',
    };
    updateData((previous) => ({ ...previous, annotations: [...previous.annotations, annotation] }));
  }

  function updatePlayer(playerId: string, patch: Partial<Player>) {
    updateData((previous) => ({
      ...previous,
      players: previous.players.map((player) => (player.id === playerId ? { ...player, ...patch } : player)),
    }));
  }

  function removePlayer(playerId: string) {
    updateData((previous) => ({
      ...previous,
      players: previous.players.filter((player) => player.id !== playerId),
    }));
  }

  function updateAnnotation(annotationId: string, patch: Partial<Annotation>) {
    updateData((previous) => ({
      ...previous,
      annotations: previous.annotations.map((item) => (item.id === annotationId ? { ...item, ...patch } : item)),
    }));
  }

  function deleteAnnotation(annotationId: string) {
    updateData((previous) => ({
      ...previous,
      annotations: previous.annotations.filter((item) => item.id !== annotationId),
    }));
  }

  function addMarker(note: string) {
    const video = videoRef.current;
    if (!video) return;
    const marker = { id: crypto.randomUUID(), t: video.currentTime, note };
    updateData((previous) => ({ ...previous, markers: [...previous.markers, marker] }));
  }

  function updateMarker(markerId: string, note: string) {
    updateData((previous) => ({
      ...previous,
      markers: previous.markers.map((marker) => (marker.id === markerId ? { ...marker, note } : marker)),
    }));
  }

  function deleteMarker(markerId: string) {
    updateData((previous) => ({
      ...previous,
      markers: previous.markers.filter((marker) => marker.id !== markerId),
    }));
  }

  if (!ready) {
    return (
      <StudioMessage
        onBack={onBack}
        title={status === 'error' ? 'This analysis could not be opened' : 'Opening analysis'}
        error={projectError ?? linkError}
        loading={status === 'loading' && !linkError}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Library
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-50">{clip.name}</h1>
            <SaveStatus status={status} error={projectError} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={!src}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export video
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {src ? (
            <VideoStage
              videoRef={videoRef}
              src={src}
              aspectRatio={aspectRatio}
              tool={tool}
              data={data}
              following={following}
              onPlaceHalo={handlePlaceHalo}
              onDraw={handleDraw}
              onUpdatePlayer={updatePlayer}
              onUpdateAnnotation={updateAnnotation}
              onTimeChange={setTime}
              onPlayingChange={setPlaying}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl bg-slate-900 ring-1 ring-slate-800">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-hidden="true" />
            </div>
          )}

          {notice && (
            <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {notice}
            </p>
          )}

          <TransportBar
            playing={playing}
            time={time}
            duration={duration}
            tool={tool}
            onToolChange={handleToolChange}
            onTogglePlay={togglePlay}
            onStep={stepFrame}
          />

          <Timeline time={time} duration={duration} markers={data.markers} onSeek={seek} />
          <p className="font-mono text-xs text-slate-600">{formatClock(time)}</p>
        </div>

        <aside className="min-w-0 space-y-6">
          <PlayerPanel
            players={data.players}
            following={following}
            onSeek={seek}
            onUpdate={updatePlayer}
            onRemove={removePlayer}
            relocatingId={relocatingId}
            onFindAgain={findPlayerAgain}
            onCancelFollow={cancelFollowing}
          />
          <AnnotationPanel
            annotations={data.annotations}
            markers={data.markers}
            time={time}
            onSeek={seek}
            onUpdateAnnotation={updateAnnotation}
            onDeleteAnnotation={deleteAnnotation}
            onAddMarker={addMarker}
            onUpdateMarker={updateMarker}
            onDeleteMarker={deleteMarker}
          />
        </aside>
      </div>

      {exportOpen && videoRef.current && (
        <ExportDialog
          clipName={clip.name}
          onClose={() => setExportOpen(false)}
          onExport={(captions, onProgress) => exportAnnotatedVideo(videoRef.current!, data, captions, onProgress)}
        />
      )}
    </div>
  );
}

function SaveStatus({ status, error }: { status: SaveState; error: string | null }) {
  const labels: Record<SaveState, string> = {
    loading: 'Loading analysis...',
    saved: 'All changes saved',
    unsaved: 'Saving soon...',
    saving: 'Saving...',
    error: 'Could not save',
  };
  return (
    <p className={`mt-0.5 text-xs ${status === 'error' ? 'text-rose-300' : 'text-slate-500'}`} title={error ?? undefined}>
      {labels[status]}
    </p>
  );
}

function StudioMessage({
  title,
  error,
  loading,
  onBack,
}: {
  title: string;
  error: string | null;
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Library
      </button>
      <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-16 text-center">
        {loading && <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-hidden="true" />}
        <h1 className="mt-4 text-lg font-semibold text-slate-100">{title}</h1>
        {error && <p className="mt-2 max-w-md text-sm text-rose-300">{error}</p>}
      </div>
    </div>
  );
}
