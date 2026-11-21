import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_PROJECT, loadProject, saveProject } from '@/lib/projects';
import { errorMessage } from '@/lib/format';
import type { ProjectData } from '@/types';

export type SaveState = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error';

const SAVE_DELAY_MS = 600;

export function useProject(clipId: string) {
  const [data, setData] = useState<ProjectData>(EMPTY_PROJECT);
  const [status, setStatus] = useState<SaveState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const snapshot = useRef({ clipId, data, status });
  useEffect(() => {
    snapshot.current = { clipId, data, status };
  });

  useEffect(() => {
    let active = true;
    loadProject(clipId)
      .then((loaded) => {
        if (!active) return;
        setData(loaded);
        setReady(true);
        setStatus('saved');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(errorMessage(err));
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [clipId]);

  useEffect(() => {
    if (status !== 'unsaved') return;
    const timer = window.setTimeout(() => {
      setStatus('saving');
      saveProject(clipId, data)
        .then(() => {
          setError(null);
          setStatus((current) => (current === 'saving' ? 'saved' : current));
        })
        .catch((err: unknown) => {
          setError(errorMessage(err));
          setStatus('error');
        });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status, data, clipId]);

  useEffect(() => {
    return () => {
      const latest = snapshot.current;
      if (latest.status === 'unsaved') {
        void saveProject(latest.clipId, latest.data);
      }
    };
  }, []);

  const updateData = useCallback((update: (previous: ProjectData) => ProjectData) => {
    setData((previous) => update(previous));
    setStatus('unsaved');
  }, []);

  return { data, status, error, updateData, ready };
}
