

# Plan: News Overhaul + Media Embed Feature

## Problem
Current `news-search` edge function uses AI to **fabricate** news articles with fake URLs (404s, non-existent pages). The user wants real, validated news from RSS feeds/APIs, plus a new YouTube/Spotify media embed feature.

## Implementation

### 1. Rewrite `news-search` Edge Function — Real RSS Feeds

Replace AI-generated fake news with server-side RSS feed parsing from real sources:

**RSS Sources:**
- Kompas.com RSS (`https://rss.kompas.com/tekno`, `/edukasi`, `/nasional`)
- Detik.com RSS (`https://rss.detik.com/index.php/detikinet`, `/detiknews`)
- Antara News RSS
- BBC Indonesia RSS
- CNBC Indonesia RSS

**Edge function logic:**
1. Fetch multiple RSS feeds concurrently with 5s timeout per feed
2. Parse XML → extract title, link, description, pubDate, source
3. Auto-categorize articles using keyword matching (penipuan, cybercrime, teknologi, pendidikan, beasiswa, keamanan_digital, isu_global)
4. Validate: skip items missing title/link/date, deduplicate by URL
5. Sanitize HTML from descriptions, normalize dates to ISO
6. Sort by date descending, return top 24 articles
7. Cache results in-memory for 5 minutes to reduce RSS hammering
8. Filter by category/query if provided

**No URL validation (HEAD requests)** — RSS feeds from major outlets are inherently valid. This avoids slow/blocked HEAD requests.

### 2. Update `News.tsx` Frontend

- Keep existing UI structure (cards, categories, search, filters)
- Add internal article detail: when `source_url` click fails or is unavailable, show a dialog/modal with the full summary
- Add per-card ErrorBoundary wrapper
- Add "last updated" timestamp display
- Improve loading skeletons (pulse animation)
- Add cooldown on refresh button (prevent spam)

### 3. New Edge Function: `media-embed`

Server-side URL parser and validator for YouTube & Spotify:

**Accepts:** `{ url: string }`
**Returns:** `{ type, platform, embed_url, title?, thumbnail?, valid }`

**YouTube parsing:**
- Handles: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/playlist?list=`, `youtube.com/embed/`
- Extracts video/playlist ID
- Returns embed URL: `https://www.youtube.com/embed/{id}`
- Validates ID format (11 chars alphanumeric)

**Spotify parsing:**
- Handles: `open.spotify.com/track/`, `/album/`, `/playlist/`, `/artist/`, `/episode/`, `/show/`
- Extracts resource type and ID
- Returns embed URL: `https://open.spotify.com/embed/{type}/{id}`
- Validates ID format

**Validation:** regex-based URL parsing, no external API calls needed (embed URLs are standardized).

### 4. New Page: `/media` — Media Player

**UI Components:**
- URL input field with paste support
- "Add Media" button → calls `media-embed` edge function
- Detected platform badge (YouTube/Spotify)
- Responsive embed player using `<iframe>` with proper sandbox attributes
- Media library: localStorage list of added media
- Error states: invalid URL, unsupported platform, embed failed
- Fallback: show link with thumbnail if embed fails

**Embed specs:**
- YouTube: `<iframe>` with `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`
- Spotify: `<iframe>` with `allow="encrypted-media"`, height varies by type (track=152px, album/playlist=352px)

### 5. Route & Nav Updates

- Add `/media` route in `App.tsx` with ErrorBoundary
- Add "Media" nav item in `Navbar.tsx` with `Music` icon

## Files

| Action | File |
|--------|------|
| Rewrite | `supabase/functions/news-search/index.ts` |
| Create | `supabase/functions/media-embed/index.ts` |
| Update | `src/pages/News.tsx` |
| Create | `src/pages/Media.tsx` |
| Update | `src/App.tsx` |
| Update | `src/components/layout/Navbar.tsx` |

## Key Decisions
- **RSS over API**: No API keys needed, real content, always valid URLs
- **No HEAD request validation**: RSS from major outlets = trustworthy links; HEAD requests are slow and often blocked by CORS/WAF
- **Media embed via edge function**: URL parsing server-side prevents XSS; embed URLs are deterministic from IDs
- **localStorage for media library**: No DB table needed for personal media bookmarks

