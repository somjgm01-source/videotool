import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Clock, Film, Loader2, Trash2, Upload } from 'lucide-react';
import { deleteClip, listClips, uploadClip, type Clip } from '@/lib/clips';
import { errorMessage, formatBytes, formatClock } from '@/lib/format';
import { MAX_CLIP_SECONDS } from '@/types';

type Props = {
  userId: string;
  onOpen: (clip: Clip) => void;
};

export default function ClipLibrary({ userId, onOpen }: Props) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setClips(await listClips());
      setError(null);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const clip = await uploadClip(userId, file);
      setClips((previous) => [clip, ...previous]);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!uploading) void handleFile(event.dataTransfer.files[0]);
  }

  async function handleDelete(clip: Clip) {
    if (!window.confirm(`Delete "${clip.name}" and its analysis? This cannot be undone.`)) return;
    try {
      await deleteClip(clip);
      setClips((previous) => previous.filter((item) => item.id !== clip.id));
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Your clips</h1>
        <p className="mt-1 text-sm text-slate-400">Upload a match moment to analyse, track players, and export.</p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/50'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" aria-hidden="true" />
          ) : (
            <Upload className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          )}
        </div>
        <p className="mt-4 text-sm font-medium text-slate-200">
          {uploading ? 'Uploading your clip...' : 'Drag a video here, or choose a file'}
        </p>
        <p className="mt-1 text-xs text-slate-500">MP4, MOV or WebM, up to {MAX_CLIP_SECONDS} seconds</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Choose video
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your clips...
        </div>
      ) : clips.length === 0 ? (
        <p className="text-sm text-slate-500">No clips yet. Upload your first one above.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <li
              key={clip.id}
              className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-lg hover:shadow-black/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Film className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(clip)}
                  aria-label={`Delete ${clip.name}`}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <h2 className="mt-4 truncate text-base font-semibold text-slate-100" title={clip.name}>
                {clip.name}
              </h2>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatClock(clip.duration_seconds)} · {formatBytes(clip.file_size_bytes)} · {clip.width}x{clip.height}
              </p>
              <button
                type="button"
                onClick={() => onOpen(clip)}
                className="mt-5 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white"
              >
                Open analysis
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
