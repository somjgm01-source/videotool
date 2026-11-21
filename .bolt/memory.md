# Project memory

## Product intent & audience

- Football/soccer video analysis tool for uploading match clips and annotating them.
- Core capabilities: player highlighting, freeze-frame markers, drawable lines, motion tracking, and export of annotated video.
- Audience: coaches, analysts, and players reviewing match footage.

## Brand personality & voice

- Professional, sports-performance oriented; clear and instructional.
- Help/support tone references official Bolt docs when explaining platform-level actions.

## Visual design & UX direction

- Vite + React with Tailwind CSS and Lucide React icons; `@/` path alias for imports.
- Aim for polished, production-grade UI — not generic/cookie-cutter.
- Anticipated UI surfaces: video player canvas, annotation toolbar (highlight, freeze-frame, lines, tracking), clip library, export flow.
- Heavy use of canvas/video overlays; interactions should feel responsive and precise for frame-by-frame analysis.

## Decisions, constraints & rationale

- Backend: Supabase for database and storage — footage in clip library and saved analyses persist there, not in the downloaded code bundle.
- Code export/download is handled via Bolt UI (top-left project title → Download); not an in-chat action.
- Local run requires Node.js: `npm install && npm run dev` after unzipping.
- Global design and import conventions live in `.bolt/prompt` and are authoritative — not restated here.

## Open questions & assumptions

- Assumed annotation features (lines, highlighting, tracking) are rendered on a canvas overlay above the video element — exact implementation not yet confirmed.
- Export format/codec and whether tracking is manual keyframe-based or automated is unspecified.
- Auth and multi-user support scope unknown.
- Whether analyses are shareable or per-user private is unconfirmed.