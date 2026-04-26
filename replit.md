# GlobalQuizTimeHub

A React + TypeScript web application for Indonesian students, featuring quizzes, news, translation, persistent media playback, world clock, social competition, achievements, and personalized theme preferences.

## Architecture

### Frontend (Vite + React, port 5000)
- React 18 with TypeScript
- Tailwind CSS + shadcn/ui components
- Framer Motion animations
- React Router v7 for routing
- TanStack Query for data fetching
- Supabase JS client for auth and direct database access
- Theme preference supports light, dark, and system modes with profile synchronization
- Persistent global media player keeps the active YouTube/Spotify embed mounted across navigation and persists active track, play/pause state, queue, position, volume, loop, and source in localStorage
- Premium lightweight 3D experience layer includes an animated hero, interactive globe section, ambient media-responsive effects, one-time intro overlay, depth-card hover treatment, and an accessibility/data-saver toggle
- Optional uploaded GLB/GLTF models are managed from the admin panel and stored locally in IndexedDB with metadata/version/placement/active state in localStorage; CSS/SVG fallbacks render when no model is active or motion/data-saving constraints are detected

### Backend API (Express, port 3000)
- `server/index.ts` — Express server with all API routes
- Proxied by Vite dev server at `/api/*`
- Replaces all Supabase Edge Functions

### API Routes
- `POST /api/news-search` — Fetches RSS feeds from Indonesian sources, applies strict relevance scoring/filtering (including education intent, keyword/tag/source weighting, negative-topic blocking, and related-results fallback), and when primary sources are insufficient it adds labeled social/alternative public-source results with platform, verification level, relevance reason, validation notes, disclaimer, anti-spam filtering, and basic scam-pattern screening
- `POST /api/job-validate` — Validates job listings for scam indicators
- `POST /api/media-embed` — Parses YouTube/Spotify URLs into embed URLs
- `POST /api/translate` — AI-powered translation using OpenAI GPT-4o-mini
- `POST /api/quiz-recommend` — AI-powered personalized quiz recommendations

### Database
- Supabase (PostgreSQL) for auth and all app data
- Tables: profiles, user_roles, categories, questions, quiz_sessions, quiz_answers, countries, news_articles, user_achievements
- Supabase client used directly from frontend for auth and CRUD
- `user_achievements` stores unlocked badges and supports public viewing for leaderboard badge counts
- Completed quiz sessions are publicly selectable for leaderboard aggregation via RLS policy

## Environment Variables / Secrets
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key
- `OPENAI_API_KEY` — OpenAI API key (for translate and quiz-recommend endpoints)

## Running the App

```bash
npm run dev
```

This runs both the Express API server (port 3000) and Vite dev server (port 5000) concurrently.

## Key Pages
- `/` — Home / Index with premium 3D hero and interactive globe
- `/auth` — Login / Register (Supabase auth)
- `/quiz` — Quiz category browser
- `/quiz/:slug` — Quiz play session with achievement unlock notifications
- `/dashboard` — User stats, global leaderboard, achievements, badge history, and AI recommendations
- `/profile` — User profile editor and synchronized theme preference controls
- `/news` — Indonesian news and job listings with related-results and social/alternative-source fallback
- `/news/saved` — Saved news/bookmarks
- `/translator` — AI translator (50+ languages)
- `/media` — YouTube/Spotify media library controlling the persistent global player
- `/world-clock` — World clock
- `/admin` — Admin panel (admin role required), including 3D model management
- `/quiz-importer` — PDF Quiz Importer: upload PDF bank soal atau materi, ekstrak otomatis soal, preview & edit, mapping kategori, import ke database
- `/documents` — Document Vault: penyimpanan dokumen aman, upload/download/preview/share/rename/delete/restore, folder, kategori, tag, audit log, signed URL, versioning

## PDF Quiz Importer Feature
- Powered by `pdfjs-dist` for client-side PDF text extraction
- Parser (`src/lib/pdfParser.ts`) detects bank soal vs materi mode
- Bank soal mode: parses numbered questions, A/B/C/D options, [X]/*/✓ answer markers
- Materi mode: AI-template quiz generation from document content (labeled "AI-generated")
- Features: drag-drop upload, extraction progress, question preview, inline edit, duplicate/validity detection, category auto-mapping, CSV export, import to `questions` table
- Auto-maps questions to categories: Jurnal, HPP, Rasio, Biaya, Capital Budgeting, Audit, etc.
