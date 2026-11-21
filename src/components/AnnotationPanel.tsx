import { useState, type FormEvent } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import ColorSwatches from '@/components/ColorSwatches';
import { formatClock } from '@/lib/format';
import { DURATION_OPTIONS, type Annotation, type Marker, type ShapeKind } from '@/types';

type Props = {
  annotations: Annotation[];
  markers: Marker[];
  time: number;
  onSeek: (time: number) => void;
  onUpdateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onAddMarker: (note: string) => void;
  onUpdateMarker: (id: string, note: string) => void;
  onDeleteMarker: (id: string) => void;
};

const KIND_LABELS: Record<ShapeKind, string> = {
  line: 'Line',
  arrow: 'Arrow',
  circle: 'Circle',
  label: 'Label',
};

export default function AnnotationPanel({
  annotations,
  markers,
  time,
  onSeek,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onAddMarker,
  onUpdateMarker,
  onDeleteMarker,
}: Props) {
  const [note, setNote] = useState('');
  const sortedAnnotations = [...annotations].sort((a, b) => a.t - b.t);
  const sortedMarkers = [...markers].sort((a, b) => a.t - b.t);

  function handleAddMarker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddMarker(note.trim());
    setNote('');
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-slate-100">Drawings</h2>
        <p className="mt-0.5 text-xs text-slate-500">Shown on screen from the moment they were drawn.</p>

        {sortedAnnotations.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">Nothing drawn yet. Choose a drawing tool above the video.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {sortedAnnotations.map((annotation) => (
              <li key={annotation.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSeek(annotation.t)}
                    className="font-mono text-xs text-emerald-400 transition hover:text-emerald-300"
                  >
                    {formatClock(annotation.t)} · {KIND_LABELS[annotation.kind]}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAnnotation(annotation.id)}
                    aria-label="Delete drawing"
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {annotation.kind === 'label' && (
                  <input
                    value={annotation.text}
                    maxLength={40}
                    onChange={(event) => onUpdateAnnotation(annotation.id, { text: event.target.value })}
                    aria-label="Label text"
                    placeholder="Label text"
                    className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <ColorSwatches
                    label="Colour"
                    value={annotation.color}
                    onChange={(color) => onUpdateAnnotation(annotation.id, { color })}
                  />
                  <select
                    value={annotation.duration}
                    onChange={(event) => onUpdateAnnotation(annotation.id, { duration: Number(event.target.value) })}
                    aria-label="How long it stays on screen"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-emerald-400 focus:outline-none"
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-slate-100">Markers</h2>
        <p className="mt-0.5 text-xs text-slate-500">Key moments with a note, shown as a caption in the export.</p>

        <form onSubmit={handleAddMarker} className="mt-4 flex gap-2">
          <input
            value={note}
            maxLength={80}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note for this moment"
            aria-label="Marker note"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            Add at {formatClock(time)}
          </button>
        </form>

        {sortedMarkers.length > 0 && (
          <ul className="mt-5 space-y-2">
            {sortedMarkers.map((marker) => (
              <li key={marker.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                <button
                  type="button"
                  onClick={() => onSeek(marker.t)}
                  className="shrink-0 rounded-md px-2 py-1 font-mono text-xs text-amber-300 transition hover:bg-amber-300/10"
                >
                  {formatClock(marker.t)}
                </button>
                <input
                  value={marker.note}
                  maxLength={80}
                  onChange={(event) => onUpdateMarker(marker.id, event.target.value)}
                  aria-label="Marker note"
                  className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => onDeleteMarker(marker.id)}
                  aria-label="Delete marker"
                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
