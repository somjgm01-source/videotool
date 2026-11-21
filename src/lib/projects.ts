import { supabase } from '@/lib/supabase';
import { COLOR_OPTIONS, REST_OF_CLIP_SECONDS, type Player, type Point, type ProjectData, type TrackPoint } from '@/types';

export const EMPTY_PROJECT: ProjectData = { players: [], annotations: [], markers: [] };

type StoredPlayer = Partial<Omit<Player, 'track'>> & { track?: TrackPoint[]; position?: Point };

function toPlayer(value: unknown): Player | null {
  const raw = value as StoredPlayer | null;
  if (!raw || typeof raw.id !== 'string' || typeof raw.t !== 'number') return null;
  const track = Array.isArray(raw.track) ? raw.track : raw.position ? [{ t: raw.t, ...raw.position }] : [];
  if (track.length === 0) return null;
  return {
    id: raw.id,
    name: raw.name ?? 'Player',
    color: raw.color ?? COLOR_OPTIONS[0].value,
    t: raw.t,
    duration: raw.duration ?? REST_OF_CLIP_SECONDS,
    track,
  };
}

export function normalizeProjectData(raw: unknown): ProjectData {
  const data = (raw ?? {}) as Partial<ProjectData>;
  return {
    players: Array.isArray(data.players)
      ? data.players.map(toPlayer).filter((player): player is Player => player !== null)
      : [],
    annotations: Array.isArray(data.annotations) ? data.annotations : [],
    markers: Array.isArray(data.markers) ? data.markers : [],
  };
}

export async function loadProject(clipId: string): Promise<ProjectData> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('clip_id', clipId)
    .maybeSingle();
  if (error) throw error;
  return normalizeProjectData(data?.data);
}

export async function saveProject(clipId: string, project: ProjectData): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .upsert(
      { clip_id: clipId, data: project, updated_at: new Date().toISOString() },
      { onConflict: 'clip_id' },
    );
  if (error) throw error;
}
