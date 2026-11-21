export type Point = { x: number; y: number };

export type TrackPoint = Point & { t: number; w?: number; h?: number };

export type Player = {
  id: string;
  name: string;
  color: string;
  t: number;
  duration: number;
  track: TrackPoint[];
  lostAt?: number;
};

export type ShapeKind = 'line' | 'arrow' | 'circle' | 'label';

export type Annotation = {
  id: string;
  kind: ShapeKind;
  t: number;
  duration: number;
  color: string;
  from: Point;
  to: Point;
  text: string;
};

export type Marker = { id: string; t: number; note: string };

export type ProjectData = {
  players: Player[];
  annotations: Annotation[];
  markers: Marker[];
};

export type Tool = 'view' | 'halo' | ShapeKind;

export const COLOR_OPTIONS = [
  { label: 'Red', value: '#f43f5e' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#f8fafc' },
  { label: 'Green', value: '#34d399' },
  { label: 'Orange', value: '#fb923c' },
];
export const DEFAULT_DRAWING_COLOR = '#f8fafc';

export const REST_OF_CLIP_SECONDS = 600;
export const DURATION_OPTIONS = [
  { value: 2, label: '2 seconds' },
  { value: 4, label: '4 seconds' },
  { value: 8, label: '8 seconds' },
  { value: REST_OF_CLIP_SECONDS, label: 'Rest of clip' },
];

export const MAX_CLIP_SECONDS = 60;
export const MAX_CLIP_BYTES = 150 * 1024 * 1024;
