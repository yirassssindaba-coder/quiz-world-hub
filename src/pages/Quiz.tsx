import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/SkeletonCard';
import { BookOpen, Calculator, FileText, GraduationCap, Languages, Brain, ArrowRight } from 'lucide-react';

const categoryIcons: Record<string, any> = {
  matematika: Calculator,
  akuntansi: FileText,
  cpns: GraduationCap,
  pppk: Brain,
  ielts: Languages,
  jlpt: Languages,
};

const categoryColors: Record<string, string> = {
  matematika: 'from-blue-500 to-indigo-600',
  akuntansi: 'from-emerald-500 to-teal-600',
  cpns: 'from-amber-500 to-orange-600',
  pppk: 'from-rose-500 to-pink-600',
  ielts: 'from-violet-500 to-purple-600',
  jlpt: 'from-cyan-500 to-blue-600',
};

export default function Quiz() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      setCategories(cats || []);

      if (cats) {
        const counts: Record<string, number> = {};
        await Promise.all(cats.map(async (cat) => {
          const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('category_id', cat.id);
          counts[cat.id] = count || 0;
        }));
        setQuestionCounts(counts);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container py-8 sm:py-12">
        <div className="h-9 w-64 mb-3 rounded skeleton-shimmer" />
        <div className="h-4 w-80 max-w-full mb-8 rounded skeleton-shimmer" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-[Space_Grotesk] mb-2">Pilih Kategori Quiz</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Pilih kategori dan mulai latihan dari ribuan soal berkualitas.</p>
      </motion.div>

      {categories.length === 0 ? (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Belum ada kategori</h3>
            <p className="text-sm text-muted-foreground mb-4">Kategori dan soal akan segera tersedia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((cat, i) => {
            const Icon = categoryIcons[cat.slug] || BookOpen;
            const color = categoryColors[cat.slug] || 'from-gray-500 to-gray-600';
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link to={`/quiz/${cat.slug}`} className="block h-full">
                  <Card className="group card-hover depth-card border-border/50 h-full cursor-pointer overflow-hidden">
                    <CardHeader>
                      <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${color} mb-2 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-lg`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <CardTitle className="flex items-center justify-between text-lg sm:text-xl">
                        <span>{cat.name}</span>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{cat.description || 'Latihan soal untuk kategori ini.'}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{questionCounts[cat.id] || 0} soal</Badge>
                        <Badge variant="outline">3 level</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
