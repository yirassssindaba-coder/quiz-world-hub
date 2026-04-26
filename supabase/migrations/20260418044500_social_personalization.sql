CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_achievements' AND policyname = 'Anyone can view achievements'
  ) THEN
    CREATE POLICY "Anyone can view achievements" ON public.user_achievements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_achievements' AND policyname = 'Users can insert own achievements'
  ) THEN
    CREATE POLICY "Users can insert own achievements" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quiz_sessions' AND policyname = 'Anyone can view completed leaderboard sessions'
  ) THEN
    CREATE POLICY "Anyone can view completed leaderboard sessions" ON public.quiz_sessions FOR SELECT USING (status = 'completed');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_key ON public.user_achievements(achievement_key);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_leaderboard ON public.quiz_sessions(status, category_id, score DESC, completed_at DESC);

UPDATE public.profiles
SET theme_preference = 'system'
WHERE theme_preference IS NULL OR theme_preference NOT IN ('light', 'dark', 'system');
