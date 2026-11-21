import type { Marker } from '@/types';

type Props = {
  time: number;
  duration: number;
  markers: Marker[];
  onSeek: (time: number) => void;
};

export default function Timeline({ time, duration, markers, onSeek }: Props) {
  const safeDuration = duration > 0 ? duration : 1;
  const percent = (value: number) => `${Math.min(Math.max((value / safeDuration) * 100, 0), 100)}%`;

  return (
    <div className="relative pt-5">
      <div className="relative h-2 rounded-full bg-slate-800">
        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: percent(time) }} />
        {markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            title={marker.note || 'Marker'}
            aria-label={`Marker at ${marker.t.toFixed(1)} seconds`}
            onClick={() => onSeek(marker.t)}
            style={{ left: percent(marker.t) }}
            className="absolute -top-1 z-10 h-4 w-1.5 -translate-x-1/2 rounded-full bg-amber-300 shadow shadow-black/50 transition hover:scale-125 hover:bg-amber-200"
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={safeDuration}
        step={0.01}
        value={Math.min(time, safeDuration)}
        onChange={(event) => onSeek(Number(event.target.value))}
        aria-label="Scrub through the clip"
        className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent accent-emerald-500 opacity-0"
      />
    </div>
  );
}
