import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { evaluateAchievements, getPersistedAchievements, syncUnlockedAchievements } from '@/lib/achievements';
import { Timer, ChevronLeft, ChevronRight, Check, X, AlertCircle, Clock } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  correct_answer: string;
  explanation: string | null;
  difficulty_level: string;
}

export default function QuizPlay() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'setup' | 'playing' | 'result'>('setup');
  const [difficulty, setDifficulty] = useState('easy');
  const [numQuestions, setNumQuestions] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const startQuiz = async () => {
    if (!user) {
      toast({ title: 'Silakan login terlebih dahulu', variant: 'destructive' });
      navigate('/auth');
      return;
    }
    setLoading(true);
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', slug).single();
    if (!cat) {
      toast({ title: 'Kategori tidak ditemukan', variant: 'destructive' });
      navigate('/quiz');
      return;
    }
    setCategoryId(cat.id);

    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('category_id', cat.id)
      .eq('difficulty_level', difficulty)
      .limit(numQuestions);

    if (!qs || qs.length === 0) {
      toast({ title: 'Belum ada soal untuk level ini', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Shuffle
    const shuffled = qs.sort(() => Math.random() - 0.5).slice(0, numQuestions);
    setQuestions(shuffled);

    const { data: session } = await supabase.from('quiz_sessions').insert({
      user_id: user.id,
      category_id: cat.id,
      total_questions: shuffled.length,
      difficulty_level: difficulty,
      status: 'in_progress',
    }).select().single();
    
    setSessionId(session?.id || null);
    setTimeLeft(shuffled.length * 60); // 60s per question
    setTotalTime(shuffled.length * 60);
    setStep('playing');
    setLoading(false);
  };

  // Timer
  useEffect(() => {
    if (step !== 'playing' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          finishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const finishQuiz = useCallback(async () => {
    if (step === 'result') return;
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct_answer) score++;
    });

    if (sessionId) {
      const elapsed = totalTime - timeLeft;
      await supabase.from('quiz_sessions').update({
        score,
        completed_at: new Date().toISOString(),
        duration_seconds: elapsed,
        status: 'completed',
      }).eq('id', sessionId);

      // Save answers
      const answerRows = questions.map((q, i) => ({
        session_id: sessionId,
        question_id: q.id,
        user_answer: answers[i] || null,
        is_correct: answers[i] === q.correct_answer,
        time_spent_seconds: Math.floor(elapsed / questions.length),
      }));
      await supabase.from('quiz_answers').insert(answerRows);

      if (user) {
        const { data: latestSessions } = await supabase
          .from('quiz_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed');
        const persisted = await getPersistedAchievements(user.id);
        const evaluated = evaluateAchievements(latestSessions || [], persisted);
        const newlyUnlocked = await syncUnlockedAchievements(user.id, evaluated);
        newlyUnlocked.slice(0, 2).forEach(achievement => {
          toast({
            title: `Achievement terbuka: ${achievement.title}`,
            description: achievement.description,
          });
        });
      }
    }
    setStep('result');
  }, [answers, questions, sessionId, timeLeft, totalTime, step, user, toast]);

  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.correct_answer ? 1 : 0), 0);
  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (step === 'setup') {
    return (
      <div className="container py-12 max-w-lg">
        <Button variant="ghost" onClick={() => navigate('/quiz')} className="mb-4"><ChevronLeft className="mr-1 h-4 w-4" />Kembali</Button>
        <Card className="shadow-elevated border-border/50">
          <CardHeader>
            <CardTitle className="font-[Space_Grotesk]">Pengaturan Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Tingkat Kesulitan</label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <Button key={d} variant={difficulty === d ? 'default' : 'outline'} onClick={() => setDifficulty(d)} className={difficulty === d ? 'bg-gradient-primary text-white' : ''}>
                    {d === 'easy' ? 'Mudah' : d === 'medium' ? 'Sedang' : 'Sulit'}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Jumlah Soal</label>
              <div className="flex gap-2">
                {[10, 20, 30, 50].map(n => (
                  <Button key={n} variant={numQuestions === n ? 'default' : 'outline'} onClick={() => setNumQuestions(n)} className={numQuestions === n ? 'bg-gradient-primary text-white' : ''}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <Button className="w-full bg-gradient-primary hover:opacity-90 text-white" onClick={startQuiz} disabled={loading}>
              {loading ? 'Menyiapkan...' : 'Mulai Quiz'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="container py-12 max-w-2xl">
        <Card className="shadow-elevated border-border/50">
          <CardHeader className="text-center">
            <div className={`inline-flex h-20 w-20 mx-auto items-center justify-center rounded-full mb-4 ${percentage >= 70 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <span className="text-3xl font-bold font-[Space_Grotesk]">{percentage}%</span>
            </div>
            <CardTitle className="text-2xl font-[Space_Grotesk]">
              {percentage >= 70 ? '🎉 Lulus!' : '📚 Perlu Latihan Lagi'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <Check className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <p className="text-lg font-bold text-green-600">{score}</p>
                <p className="text-xs text-muted-foreground">Benar</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <X className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-600">{questions.length - score}</p>
                <p className="text-xs text-muted-foreground">Salah</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <Clock className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                <p className="text-lg font-bold text-blue-600">{formatTime(totalTime - timeLeft)}</p>
                <p className="text-xs text-muted-foreground">Waktu</p>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setShowExplanation(!showExplanation)}>
              {showExplanation ? 'Sembunyikan' : 'Lihat'} Pembahasan
            </Button>

            {showExplanation && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {questions.map((q, i) => {
                  const isCorrect = answers[i] === q.correct_answer;
                  return (
                    <div key={i} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <Badge variant={isCorrect ? 'default' : 'destructive'} className="shrink-0">{i + 1}</Badge>
                        <p className="text-sm font-medium break-words">{q.question_text}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Jawaban kamu: <span className="font-medium">{answers[i] || '(kosong)'}</span></p>
                      <p className="text-xs text-green-600">Jawaban benar: <span className="font-medium">{q.correct_answer}</span></p>
                      {q.explanation && <p className="text-xs text-muted-foreground mt-1 italic">{q.explanation}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setStep('setup'); setAnswers({}); setCurrentIdx(0); }}>
                Coba Lagi
              </Button>
              <Button className="flex-1 bg-gradient-primary text-white" onClick={() => navigate('/dashboard')}>
                Lihat Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentIdx];

  return (
    <div className="container py-8 max-w-2xl">
      {/* Timer & Progress */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="outline" className="gap-1">
          <Timer className="h-3 w-3" />
          {formatTime(timeLeft)}
        </Badge>
        <span className="text-sm text-muted-foreground">{currentIdx + 1} / {questions.length}</span>
      </div>
      <Progress value={((currentIdx + 1) / questions.length) * 100} className="mb-6 h-2" />

      <Card className="shadow-elevated border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge>{currentQ.difficulty_level === 'easy' ? 'Mudah' : currentQ.difficulty_level === 'medium' ? 'Sedang' : 'Sulit'}</Badge>
            <Badge variant="outline">{currentQ.question_type === 'multiple_choice' ? 'Pilihan Ganda' : currentQ.question_type === 'true_false' ? 'Benar/Salah' : 'Isian Singkat'}</Badge>
          </div>
          <CardTitle className="text-lg leading-relaxed break-words">{currentQ.question_text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentQ.question_type === 'multiple_choice' && currentQ.options?.map((opt: string, i: number) => {
            const letter = String.fromCharCode(65 + i);
            const selected = answers[currentIdx] === letter;
            return (
              <Button
                key={i}
                variant={selected ? 'default' : 'outline'}
                className={`w-full justify-start text-left h-auto py-3 px-4 whitespace-normal ${selected ? 'bg-gradient-primary text-white' : ''}`}
                onClick={() => setAnswers(prev => ({ ...prev, [currentIdx]: letter }))}
              >
                <span className="font-semibold mr-3 shrink-0">{letter}.</span>
                <span className="break-words">{opt}</span>
              </Button>
            );
          })}

          {currentQ.question_type === 'true_false' && (
            <div className="flex gap-3">
              {['Benar', 'Salah'].map(opt => (
                <Button
                  key={opt}
                  variant={answers[currentIdx] === opt ? 'default' : 'outline'}
                  className={`flex-1 ${answers[currentIdx] === opt ? 'bg-gradient-primary text-white' : ''}`}
                  onClick={() => setAnswers(prev => ({ ...prev, [currentIdx]: opt }))}
                >
                  {opt}
                </Button>
              ))}
            </div>
          )}

          {currentQ.question_type === 'short_answer' && (
            <Input
              placeholder="Ketik jawabanmu..."
              value={answers[currentIdx] || ''}
              onChange={e => setAnswers(prev => ({ ...prev, [currentIdx]: e.target.value }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} disabled={currentIdx === 0}>
          <ChevronLeft className="mr-1 h-4 w-4" />Sebelumnya
        </Button>
        {currentIdx < questions.length - 1 ? (
          <Button onClick={() => setCurrentIdx(prev => prev + 1)} className="bg-gradient-primary text-white">
            Selanjutnya<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finishQuiz} className="bg-gradient-primary text-white">
            <Check className="mr-1 h-4 w-4" />Selesai
          </Button>
        )}
      </div>

      {/* Question navigator */}
      <div className="mt-6 flex flex-wrap gap-2">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIdx(i)}
            className={`h-8 w-8 rounded-md text-xs font-medium transition-colors ${
              i === currentIdx ? 'bg-primary text-primary-foreground' :
              answers[i] ? 'bg-secondary text-secondary-foreground' :
              'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
