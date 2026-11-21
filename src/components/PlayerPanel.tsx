import { X } from 'lucide-react';
import ColorSwatches from '@/components/ColorSwatches';
import { formatClock } from '@/lib/format';
import { DURATION_OPTIONS, type Player } from '@/types';

type Props = {
  players: Player[];
  following: Record<string, number>;
  onSeek: (time: number) => void;
  onUpdate: (playerId: string, patch: Partial<Player>) => void;
  onRemove: (playerId: string) => void;
  relocatingId: string | null;
  onFindAgain: (playerId: string) => void;
  onCancelFollow: (playerId: string) => void;
};

export default function PlayerPanel({
  players,
  following,
  onSeek,
  onUpdate,
  onRemove,
  relocatingId,
  onFindAgain,
  onCancelFollow,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-semibold text-slate-100">Players</h2>
      <p className="mt-0.5 text-xs text-slate-500">Each halo follows the player it was placed on. Drag one to correct it.</p>

      {players.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          No players haloed yet. Choose Halo player above the video, then click a player.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {players.map((player) => (
            <li key={player.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
                  style={{ backgroundColor: player.color, color: player.color }}
                />
                <input
                  value={player.name}
                  maxLength={24}
                  onChange={(event) => onUpdate(player.id, { name: event.target.value })}
                  aria-label="Player name"
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
                <button
                  type="button"
                  onClick={() => onRemove(player.id)}
                  aria-label={`Remove ${player.name}`}
                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {player.id in following && (
                <div className="mt-3">
                  <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.round(following[player.id] * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                      Following player... {Math.round(following[player.id] * 100)}%
                    </p>
                    <button
                      type="button"
                      onClick={() => onCancelFollow(player.id)}
                      className="rounded-md px-2 py-0.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <ColorSwatches
                  label="Halo colour"
                  value={player.color}
                  onChange={(color) => onUpdate(player.id, { color })}
                />
                <select
                  value={player.duration}
                  onChange={(event) => onUpdate(player.id, { duration: Number(event.target.value) })}
                  aria-label="How long the halo stays on screen"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-emerald-400 focus:outline-none"
                >
                  {DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => onSeek(player.t)}
                className="mt-3 font-mono text-xs text-emerald-400 transition hover:text-emerald-300"
              >
                Shown from {formatClock(player.t)}
              </button>

              {player.lostAt !== undefined && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs text-amber-200">Lost at {formatClock(player.lostAt)}</p>
                  <button
                    type="button"
                    onClick={() => onFindAgain(player.id)}
                    disabled={relocatingId === player.id}
                    className="rounded-md bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-default disabled:opacity-70"
                  >
                    {relocatingId === player.id ? 'Click them on the video' : 'Find again'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
