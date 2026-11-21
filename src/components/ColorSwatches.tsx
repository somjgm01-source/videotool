import { COLOR_OPTIONS } from '@/types';

type Props = {
  label: string;
  value: string;
  onChange: (color: string) => void;
};

export default function ColorSwatches({ label, value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {COLOR_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            style={{ backgroundColor: option.value }}
            className={`h-5 w-5 rounded-full transition hover:scale-110 ${
              active ? 'ring-2 ring-slate-100 ring-offset-2 ring-offset-slate-950' : ''
            }`}
          />
        );
      })}
    </div>
  );
}
