<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:020617,45:4f46e5,100:06b6d4&text=Global%20Quiz%20Time%20Hub&fontSize=42&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Quiz%20Platform%20%E2%80%A2%20PDF%20Importer%20%E2%80%A2%20World%20Learning%20Hub&descAlignY=58" />

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=18&duration=2600&pause=650&color=22C55E&center=true&vCenter=true&width=980&lines=Interactive+quiz+platform+for+Indonesian+students;PDF+Quiz+Importer+with+preview%2C+edit%2C+and+auto-mapping;World+clock%2C+news%2C+translator%2C+media%2C+and+achievement+hub" />

<br/>

<b>🌍 Global Quiz Time Hub</b><br/>
<i>Interactive learning platform with quiz engine, PDF-to-quiz importer, world clock, translator, news, media, achievements, and personalized study tools.</i>

<br/><br/>

<img src="https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-4f46e5?style=for-the-badge&logo=react&logoColor=white" />
<img src="https://img.shields.io/badge/Build-Vite%20%2B%20Tailwind-06b6d4?style=for-the-badge&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Backend-Express%20API-0f172a?style=for-the-badge&logo=express&logoColor=white" />
<img src="https://img.shields.io/badge/Database-Supabase-22c55e?style=for-the-badge&logo=supabase&logoColor=white" />

</div>

---

## Repository Description

🌍 Platform kuis global React TypeScript dengan PDF importer, world clock, berita, translator, media player dan achievement.

---

## Overview

Global Quiz Time Hub adalah aplikasi web pembelajaran interaktif berbasis React, TypeScript, Vite, Supabase, dan Express. Project ini dirancang untuk membantu pelajar Indonesia mengerjakan kuis, mengimpor soal dari PDF, membaca berita relevan, menerjemahkan teks, melihat waktu dunia, menyimpan media belajar, dan memantau pencapaian melalui dashboard personal.

---

## Highlights

- Quiz category browser dengan sesi pengerjaan interaktif.
- PDF Quiz Importer untuk mengubah bank soal atau materi PDF menjadi quiz.
- Preview dan edit soal sebelum import ke database.
- Deteksi pertanyaan, pilihan A-D, marker jawaban `[X]`, validitas, dan duplikasi.
- Dashboard user dengan statistik, leaderboard, achievement, dan rekomendasi AI.
- Translator AI, news hub, saved news, world clock, dan persistent media player.
- Admin panel untuk pengelolaan data dan model visual.
- Supabase auth, database, dan role-based access.

---

## Core Routes

```txt
/               -> Home with premium 3D hero and interactive globe
/auth           -> Login and register with Supabase auth
/quiz           -> Quiz category browser
/quiz/:slug     -> Quiz play session and achievement unlock
/dashboard      -> User stats, leaderboard, achievements, and recommendations
/profile        -> Profile and theme preference controls
/news           -> Indonesian news and job listing validation
/news/saved     -> Saved news and bookmarks
/translator     -> AI translator for multilingual study support
/media          -> YouTube and Spotify media library
/world-clock    -> World clock dashboard
/admin          -> Admin panel with protected role access
/quiz-importer  -> PDF Quiz Importer with extraction, preview, edit, and import
/documents      -> Document Vault for secure document storage
```

---

## Tech Stack

```txt
React 18
TypeScript
Vite
Tailwind CSS
shadcn/ui
Framer Motion
React Router v7
TanStack Query
Supabase
Express
pdfjs-dist
Tesseract.js
Recharts
Zod
Vitest
```

---

## Notable Systems

### PDF Quiz Importer
- Client-side PDF extraction powered by `pdfjs-dist`.
- Parser for bank soal and materi mode.
- Supports numbered questions, A/B/C/D choices, `[X]`, `*`, or check markers.
- Preview, inline edit, category auto-mapping, CSV export, and import workflow.

### Quiz and Achievement Engine
- Category-based quizzes.
- Session tracking and answer history.
- Achievement unlock notifications.
- Leaderboard-ready quiz session records.

### Learning Utility Hub
- World clock for global study planning.
- Translator for multilingual learning.
- News hub with relevance filtering.
- Persistent media player for YouTube and Spotify embeds.

### Backend API
- Express server for API routes.
- News search, job validation, media embed parsing, translation, and quiz recommendation.
- Supabase integration for auth and app data.

---

## Setup

```bash
npm install
npm run dev
```

The development command runs the Express API server and Vite client together.

---

## Environment Variables

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
```

---

## Why This Repo Matters

Global Quiz Time Hub kuat sebagai showcase platform belajar modern karena menggabungkan quiz engine, PDF-to-quiz workflow, AI support, media tools, world clock, news, achievements, dan Supabase-powered personalization dalam satu aplikasi.
