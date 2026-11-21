import { ArrowUpRight, Circle, Crosshair, Minus, MousePointer2, Pause, Play, SkipBack, SkipForward, Type, type LucideIcon } from 'lucide-react';
import { formatClock } from '@/lib/format';
import type { Tool } from '@/types';

type Props = {
  playing: boolean;
  time: number;
  duration: number;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onTogglePlay: () => void;
  onStep: (direction: 1 | -1) => void;
};

const TOOLS: { value: Tool; label: string; icon: LucideIcon }[] = [
  { value: 'view', label: 'Move', icon: MousePointer2 },
  { value: 'halo', label: 'Halo player', icon: Crosshair },
  { value: 'line', label: 'Line', icon: Minus },
  { value: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { value: 'circle', label: 'Circle', icon: Circle },
  { value: 'label', label: 'Label', icon: Type },
];

const HINTS: Record<Tool, string> = {
  view: 'Play, pause and scrub freely. Drag a halo or drawing to move it.',
  halo: 'Click a player to put a halo on them. Drag the halo to keep it on them.',
  line: 'Drag across the frame to draw a line.',
  arrow: 'Drag across the frame to draw an arrow.',
  circle: 'Drag from the centre outwards to draw a circle.',
  label: 'Click anywhere to place a label.',
};

export default function TransportBar({ playing, time, duration, tool, onToolChange, onTogglePlay, onStep }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="Back one frame"
            className="rounded-lg p-2.5 text-slate-300 transition hover:bg-slate-800 hover:text-slate-50"
          >
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? 'Freeze' : 'Play'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:scale-105 hover:bg-emerald-400 active:scale-95"
          >
            {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5 translate-x-px" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="Forward one frame"
            className="rounded-lg p-2.5 text-slate-300 transition hover:bg-slate-800 hover:text-slate-50"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="ml-2 font-mono text-sm tabular-nums text-slate-300">
            {formatClock(time)} <span className="text-slate-600">/ {formatClock(duration)}</span>
          </span>
        </div>

        <div role="radiogroup" aria-label="Tools" className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
          {TOOLS.map(({ value, label, icon: Icon }) => {
            const active = tool === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                title={label}
                onClick={() => onToolChange(value)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-slate-400">{HINTS[tool]}</p>
    </div>
  );
}
