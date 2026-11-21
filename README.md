# Videotool

Browser-based football video analysis: upload short match clips, follow players automatically, draw lines/arrows/circles/labels, add caption markers and export the annotated video.

Originally generated with Bolt.new.

## Stack

- React 18 + Vite + TypeScript + Tailwind
- Supabase for auth, database (`clips`, `projects`) and private clip storage — schema in `supabase/migrations/`
- MediaPipe Tasks Vision (EfficientDet Lite0) for in-browser person detection; model and wasm are served from `public/`

## Run locally

```bash
cp .env.example .env   # fill in your Supabase URL and anon key
npm install
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.
