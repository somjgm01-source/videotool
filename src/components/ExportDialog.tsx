import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, X } from 'lucide-react';
import type { ExportResult } from '@/lib/exportVideo';
import { errorMessage } from '@/lib/format';

type Props = {
  clipName: string;
  onClose: () => void;
  onExport: (captions: boolean, onProgress: (fraction: number) => void) => Promise<ExportResult>;
};

type Status = 'idle' | 'running' | 'done' | 'error';

export default function ExportDialog({ clipName, onClose, onExport }: Props) {
  const [captions, setCaptions] = useState(true);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<{ url: string; filename: string; isWebm: boolean } | null>(null);
  const downloadUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    };
  }, []);

  async function start() {
    setStatus('running');
    setProgress(0);
    setError(null);
    try {
      const result = await onExport(captions, setProgress);
      const url = URL.createObjectURL(result.blob);
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      downloadUrl.current = url;
      setDownload({ url, filename: `${clipName} - analysis.${result.extension}`, isWebm: result.extension === 'webm' });
      setStatus('done');
    } catch (err: unknown) {
      setError(errorMessage(err));
      setStatus('error');
    }
  }

  const running = status === 'running';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Export video">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Export video</h2>
            <p className="mt-1 text-sm text-slate-400">Creates a new video with your halos, drawings and markers.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {status !== 'done' && (
          <label className="mt-6 flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <span className="text-sm text-slate-200">Show marker notes as captions</span>
            <input
              type="checkbox"
              checked={captions}
              disabled={running}
              onChange={(event) => setCaptions(event.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
        )}

        {running && (
          <div className="mt-6">
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Rendering... {Math.round(progress * 100)}%. Keep this tab open until it finishes.
            </p>
          </div>
        )}

        {status === 'error' && error && (
          <p role="alert" className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        {status === 'done' && download && (
          <div className="mt-6 space-y-4">
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Your analysis is ready.
            </p>
            {download.isWebm && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
                This browser saves videos as WebM, so the file will be a WebM rather than an MP4. Chrome and Edge save MP4 directly.
              </p>
            )}
            <a
              href={download.url}
              download={download.filename}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download video
            </a>
          </div>
        )}

        {(status === 'idle' || status === 'error') && (
          <button
            type="button"
            onClick={() => void start()}
            className="mt-6 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            {status === 'error' ? 'Try again' : 'Start export'}
          </button>
        )}
      </div>
    </div>
  );
}
