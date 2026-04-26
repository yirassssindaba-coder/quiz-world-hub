import { supabase } from '@/integrations/supabase/client';

export type AchievementTone = 'gold' | 'violet' | 'emerald' | 'blue' | 'rose' | 'amber';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: AchievementTone;
  target: number;
  getProgress: (stats: AchievementStats) => number;
}

export interface AchievementStats {
  completedQuizzes: number;
  perfectScores: number;
  dailyStreak: number;
  completedCategoryCount: number;
  totalPoints: number;
}

export interface AchievementProgress extends AchievementDefinition {
  progress: number;
  percent: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'quiz_10',
    title: 'Quiz Explorer',
    description: 'Selesaikan 10 quiz untuk membuktikan konsistensi belajar.',
    icon: 'Q10',
    tone: 'blue',
    target: 10,
    getProgress: stats => stats.completedQuizzes,
  },
  {
    id: 'perfect_score',
    title: 'Perfect Score',
    description: 'Raih skor 100% dalam satu sesi quiz.',
    icon: '100',
    tone: 'gold',
    target: 1,
    getProgress: stats => stats.perfectScores,
  },
  {
    id: 'daily_streak_3',
    title: 'Streak Harian',
    description: 'Selesaikan quiz selama 3 hari berbeda secara beruntun.',
    icon: 'ST',
    tone: 'rose',
    target: 3,
    getProgress: stats => stats.dailyStreak,
  },
  {
    id: 'category_finisher_3',
    title: 'Category Finisher',
    description: 'Lulus quiz dari 3 kategori berbeda.',
    icon: 'CAT',
    tone: 'emerald',
    target: 3,
    getProgress: stats => stats.completedCategoryCount,
  },
  {
    id: 'points_500',
    title: '500 Point Club',
    description: 'Kumpulkan 500 poin benar dari seluruh quiz.',
    icon: '500',
    tone: 'violet',
    target: 500,
    getProgress: stats => stats.totalPoints,
  },
];

export function calculateDailyStreak(sessions: any[]) {
  const dates = Array.from(new Set(
    sessions
      .filter(s => s.status === 'completed' && (s.completed_at || s.started_at))
      .map(s => new Date(s.completed_at || s.started_at).toISOString().slice(0, 10))
  )).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) return 0;
  let streak = 1;
  let cursor = new Date(`${dates[0]}T00:00:00`);
  for (let i = 1; i < dates.length; i++) {
    const next = new Date(`${dates[i]}T00:00:00`);
    const diff = Math.round((cursor.getTime() - next.getTime()) / 86400000);
    if (diff === 1) {
      streak += 1;
      cursor = next;
    } else if (diff > 1) {
      break;
    }
  }
  return streak;
}

export function buildAchievementStats(sessions: any[]) {
  const completed = sessions.filter(s => s.status === 'completed');
  const passedCategories = new Set<string>();
  completed.forEach(s => {
    if (s.category_id && s.total_questions && (s.score || 0) / s.total_questions >= 0.7) {
      passedCategories.add(s.category_id);
    }
  });

  return {
    completedQuizzes: completed.length,
    perfectScores: completed.filter(s => s.total_questions > 0 && (s.score || 0) === s.total_questions).length,
    dailyStreak: calculateDailyStreak(completed),
    completedCategoryCount: passedCategories.size,
    totalPoints: completed.reduce((sum, s) => sum + (s.score || 0), 0),
  };
}

export function evaluateAchievements(sessions: any[], persisted: any[] = []) {
  const stats = buildAchievementStats(sessions);
  const persistedMap = new Map(persisted.map(a => [a.achievement_key, a.unlocked_at]));
  return ACHIEVEMENTS.map(def => {
    const progress = Math.min(def.getProgress(stats), def.target);
    const unlocked = progress >= def.target || persistedMap.has(def.id);
    return {
      ...def,
      progress,
      percent: Math.min(100, Math.round((progress / def.target) * 100)),
      unlocked,
      unlockedAt: persistedMap.get(def.id),
    };
  });
}

export async function getPersistedAchievements(userId: string) {
  const { data, error } = await (supabase as any)
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function syncUnlockedAchievements(userId: string, achievements: AchievementProgress[]) {
  const unlocked = achievements.filter(a => a.unlocked);
  if (unlocked.length === 0) return [];

  const persisted = await getPersistedAchievements(userId);
  const existing = new Set(persisted.map((a: any) => a.achievement_key));
  const missing = unlocked.filter(a => !existing.has(a.id));
  if (missing.length === 0) return [];

  const rows = missing.map(a => ({
    user_id: userId,
    achievement_key: a.id,
    title: a.title,
    description: a.description,
    icon: a.icon,
  }));

  const { error } = await (supabase as any).from('user_achievements').insert(rows);
  if (error) return [];
  return missing;
}
