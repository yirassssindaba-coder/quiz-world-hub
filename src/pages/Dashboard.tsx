import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Trophy, Target, Clock, TrendingUp, BookOpen, Sparkles, Loader2, Medal, Crown, Award, Flame, Star, ShieldCheck } from 'lucide-react';
import { evaluateAchievements, getPersistedAchievements, syncUnlockedAchievements, type AchievementProgress } from '@/lib/achievements';
import { useToast } from '@/hooks/use-toast';

function AIRecommendations({ userId }: { userId: string }) {
  const [recs, setRecs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const { data: sessions } = await supabase
          .from('quiz_sessions')
          .select('category_id, score, total_questions, difficulty_level, status')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(20);

        const res = await fetch('/api/quiz-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: sessions || [] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setRecs(data?.summary || data?.recommendation || 'Mulai mengerjakan quiz untuk mendapatkan rekomendasi.');
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchRecs();
  }, [userId]);

  if (loading) return (
    <Card className="depth-card border-border/50">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-yellow-500" />Rekomendasi AI</CardTitle></CardHeader>
      <CardContent><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Menganalisis riwayat belajar...</div></CardContent>
    </Card>
  );

  if (error) return (
    <Card className="depth-card border-border/50">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-yellow-500" />Rekomendasi AI</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">Tidak dapat memuat rekomendasi saat ini.</p></CardContent>
    </Card>
  );

  return (
    <Card className="depth-card border-border/50 bg-gradient-to-br from-background to-accent/20">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-yellow-500" />Rekomendasi AI</CardTitle></CardHeader>
      <CardContent><p className="text-sm whitespace-pre-line leading-relaxed">{recs}</p></CardContent>
    </Card>
  );
}

function Leaderboard({ categories }: { categories: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('*, categories(name, slug)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(500);

    const userIds = Array.from(new Set((sessions || []).map((s: any) => s.user_id).filter(Boolean)));
    const [profilesRes, achievementsRes] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds) : Promise.resolve({ data: [] } as any),
      userIds.length ? (supabase as any).from('user_achievements').select('user_id, achievement_key').in('user_id', userIds) : Promise.resolve({ data: [] } as any),
    ]);

    const profiles = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
    const badgeCount = new Map<string, number>();
    (achievementsRes.data || []).forEach((a: any) => badgeCount.set(a.user_id, (badgeCount.get(a.user_id) || 0) + 1));

    const aggregate = new Map<string, any>();
    (sessions || []).forEach((s: any) => {
      const catSlug = s.categories?.slug || s.category_id;
      if (category !== 'all' && catSlug !== category) return;
      const key = `${s.user_id}-${catSlug}`;
      const current = aggregate.get(key) || {
        user_id: s.user_id,
        category: s.categories?.name || 'Kategori',
        categorySlug: catSlug,
        totalScore: 0,
        totalQuizzes: 0,
        bestPercent: 0,
        lastPlayed: s.completed_at || s.started_at,
      };
      const percent = s.total_questions ? Math.round(((s.score || 0) / s.total_questions) * 100) : 0;
      current.totalScore += s.score || 0;
      current.totalQuizzes += 1;
      current.bestPercent = Math.max(current.bestPercent, percent);
      current.lastPlayed = s.completed_at || s.started_at || current.lastPlayed;
      aggregate.set(key, current);
    });

    const nextRows = Array.from(aggregate.values())
      .map((item: any) => {
        const profile = profiles.get(item.user_id) as any;
        const name = profile?.display_name || 'User Global';
        return {
          ...item,
          name,
          avatarUrl: profile?.avatar_url,
          initials: name.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
          badges: badgeCount.get(item.user_id) || 0,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore || b.bestPercent - a.bestPercent)
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    setRows(nextRows);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = window.setInterval(fetchLeaderboard, 60000);
    const channel = supabase
      .channel('global-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions' }, fetchLeaderboard)
      .subscribe();
    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [category]);

  return (
    <Card className="depth-card border-border/50 overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" />Global Leaderboard</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Top 10 user berdasarkan total skor per kategori. Data diperbarui otomatis.</p>
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-leaderboard-category" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            Belum ada skor publik untuk kategori ini.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map(row => (
              <div key={`${row.user_id}-${row.categorySlug}`} data-testid={`row-leaderboard-${row.rank}`} className="depth-card flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${row.rank === 1 ? 'bg-amber-500 text-white' : row.rank === 2 ? 'bg-slate-300 text-slate-900' : row.rank === 3 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {row.rank}
                </div>
                <div className="h-11 w-11 rounded-full bg-gradient-primary text-white flex items-center justify-center font-semibold overflow-hidden shrink-0">
                  {row.avatarUrl ? <img src={row.avatarUrl} alt={row.name} className="h-full w-full object-cover" /> : row.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate" data-testid={`text-leaderboard-name-${row.rank}`}>{row.name}</p>
                    <Badge variant="outline" className="text-[10px]">{row.category}</Badge>
                    {row.badges > 0 && <Badge className="text-[10px] bg-amber-500 text-white gap-1"><Award className="h-3 w-3" />{row.badges} badge</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{row.totalQuizzes} quiz • skor terbaik {row.bestPercent}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-[Space_Grotesk]" data-testid={`text-leaderboard-score-${row.rank}`}>{row.totalScore}</p>
                  <p className="text-xs text-muted-foreground">poin</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AchievementsPanel({ userId, sessions }: { userId: string; sessions: any[] }) {
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const persisted = await getPersistedAchievements(userId);
      const evaluated = evaluateAchievements(sessions, persisted);
      const newlyUnlocked = await syncUnlockedAchievements(userId, evaluated);
      if (newlyUnlocked.length > 0) {
        newlyUnlocked.slice(0, 2).forEach(a => toast({ title: `Achievement terbuka: ${a.title}`, description: a.description }));
      }
      const latest = await getPersistedAchievements(userId);
      setHistory(latest);
      setAchievements(evaluateAchievements(sessions, latest));
    };
    load();
  }, [userId, sessions.length, toast]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <Card className="depth-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2"><Medal className="h-5 w-5 text-primary" />Achievements & Badges</CardTitle>
          <Badge variant="outline" data-testid="status-achievement-count">{unlockedCount}/{achievements.length} terbuka</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {achievements.map(item => (
            <div key={item.id} data-testid={`card-achievement-${item.id}`} className={`depth-card rounded-2xl border p-4 transition-all ${item.unlocked ? 'border-primary/40 bg-primary/10 shadow-card' : 'border-border bg-card'}`}>
              <div className="flex items-start gap-3">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold ${item.unlocked ? 'bg-gradient-primary text-white' : 'bg-muted text-muted-foreground'}`}>{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{item.title}</p>
                    {item.unlocked && <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{item.description}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{item.progress}/{item.target}</span>
                </div>
                <Progress value={item.percent} className="h-2" />
              </div>
            </div>
          ))}
        </div>
        {history.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4" />Riwayat Badge</h3>
            <div className="flex gap-2 flex-wrap">
              {history.slice(0, 8).map(item => (
                <Badge key={item.id || item.achievement_key} variant="secondary" className="gap-1" data-testid={`badge-history-${item.achievement_key}`}>
                  {item.icon} {item.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    const fetchData = async () => {
      const [sessionsRes, categoriesRes] = await Promise.all([
        supabase.from('quiz_sessions').select('*, categories(name, slug)').eq('user_id', user.id).order('started_at', { ascending: false }),
        supabase.from('categories').select('*'),
      ]);
      setSessions(sessionsRes.data || []);
      setCategories(categoriesRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [user, authLoading, navigate]);

  const completedSessions = useMemo(() => sessions.filter(s => s.status === 'completed'), [sessions]);

  if (authLoading || loading) {
    return (
      <div className="container py-12">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const totalQuizzes = completedSessions.length;
  const avgScore = totalQuizzes > 0 ? Math.round(completedSessions.reduce((acc, s) => acc + (s.score / s.total_questions) * 100, 0) / totalQuizzes) : 0;
  const totalTime = completedSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const totalPoints = completedSessions.reduce((acc, s) => acc + (s.score || 0), 0);
  const filteredSessions = filterCategory === 'all' ? sessions : sessions.filter(s => s.categories?.slug === filterCategory);

  const last10 = completedSessions.slice(0, 10).reverse();
  const progressData = last10.map((s, i) => ({ name: `#${i + 1}`, skor: Math.round((s.score / s.total_questions) * 100) }));
  const categoryStats = categories.map(cat => {
    const catSessions = completedSessions.filter(s => s.category_id === cat.id);
    const avg = catSessions.length > 0 ? Math.round(catSessions.reduce((a, s) => a + (s.score / s.total_questions) * 100, 0) / catSessions.length) : 0;
    return { name: cat.name.substring(0, 8), avg, count: catSessions.length };
  }).filter(c => c.count > 0);

  const statCards = [
    { icon: BookOpen, label: 'Total Quiz', value: totalQuizzes.toString(), color: 'text-blue-600' },
    { icon: Target, label: 'Rata-rata Skor', value: `${avgScore}%`, color: 'text-green-600' },
    { icon: Star, label: 'Total Poin', value: totalPoints.toString(), color: 'text-amber-600' },
    { icon: Flame, label: 'Quiz Lulus', value: completedSessions.filter(s => (s.score / s.total_questions) >= 0.7).length.toString(), color: 'text-purple-600' },
  ];

  return (
    <div className="container py-12">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-[Space_Grotesk] mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Lihat statistik, leaderboard, achievement, dan riwayat quiz kamu.</p>
        </div>
        <Badge variant="outline" className="gap-1" data-testid="status-dashboard-refresh"><Clock className="h-3 w-3" />Near real-time</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <Card key={i} className="depth-card border-border/50">
            <CardContent className="p-4">
              <s.icon className={`h-8 w-8 mb-2 ${s.color}`} />
              <p className="text-2xl font-bold font-[Space_Grotesk]" data-testid={`text-stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
        <Leaderboard categories={categories} />
        {user && <AIRecommendations userId={user.id} />}
      </div>

      {user && <div className="mb-8"><AchievementsPanel userId={user.id} sessions={completedSessions} /></div>}

      {completedSessions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="depth-card border-border/50">
            <CardHeader><CardTitle className="text-base">Progres Skor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="skor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="depth-card border-border/50">
            <CardHeader><CardTitle className="text-base">Rata-rata per Kategori</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="depth-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Riwayat Pengerjaan</CardTitle>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger data-testid="select-history-category" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Belum ada riwayat quiz.</p>
              <Button data-testid="button-start-quiz-empty" className="mt-4 bg-gradient-primary text-white" onClick={() => navigate('/quiz')}>Mulai Quiz</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Skor</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map(s => (
                    <TableRow key={s.id} data-testid={`row-session-${s.id}`}>
                      <TableCell className="text-sm">
                        {new Date(s.started_at).toLocaleDateString('id-ID')}
                        <br />
                        <span className="text-xs text-muted-foreground">{new Date(s.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </TableCell>
                      <TableCell><Badge variant="outline">{s.categories?.name || '-'}</Badge></TableCell>
                      <TableCell className="font-medium">{s.score}/{s.total_questions} ({Math.round((s.score / s.total_questions) * 100)}%)</TableCell>
                      <TableCell className="text-sm">{s.duration_seconds ? `${Math.floor(s.duration_seconds / 60)}m ${s.duration_seconds % 60}s` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'completed' ? (s.score / s.total_questions >= 0.7 ? 'default' : 'destructive') : 'secondary'}>
                          {s.status === 'completed' ? (s.score / s.total_questions >= 0.7 ? 'Lulus' : 'Gagal') : s.status === 'in_progress' ? 'Berlangsung' : 'Ditinggalkan'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
