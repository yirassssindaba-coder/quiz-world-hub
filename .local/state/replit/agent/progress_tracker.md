[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Migrate Supabase Edge Functions to server routes
  [x] 1. Port Supabase Edge Functions into Express server routes (/api/news-search, /api/job-validate, /api/media-embed, /api/translate, /api/quiz-recommend)
  [x] 2. Updated all frontend pages to call /api/... instead of supabase.functions.invoke
  [x] 3. Secured API keys - OPENAI_API_KEY stored as a Replit secret
  [x] 4. Configured Vite proxy to forward /api requests to Express server on port 3000
  [x] 5. Kept Supabase client for auth and direct DB access (deeply integrated, works as-is)
[x] 4. Verify the project is working - both Express API (port 3000) and Vite (port 5000) running
[x] 5. Import completed
