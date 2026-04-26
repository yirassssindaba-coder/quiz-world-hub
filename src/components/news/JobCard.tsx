import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, ExternalLink, ShieldCheck, ShieldAlert, ShieldX,
  ChevronDown, ChevronUp, Briefcase, Sparkles, Loader2,
} from 'lucide-react';
import { ArticleTags } from './TagFilter';
import BookmarkButton from './BookmarkButton';
import { cn } from '@/lib/utils';

export interface JobValidation {
  verdict: 'verified' | 'caution' | 'suspicious';
  score: number;
  reasons: string[];
  trust_signals: string[];
  red_flags: string[];
}

export interface AiAnalysis {
  verdict: 'safe' | 'suspicious';
  confidence: number;
  analysis: string;
  red_flags: string[];
  safe_signs: string[];
}

interface JobCardProps {
  title: string;
  summary: string;
  source: string;
  source_url: string;
  published_date: string;
  tags: string[];
  validation?: JobValidation;
  index: number;
}

const verdictConfig = {
  verified: {
    label: 'Terverifikasi',
    icon: ShieldCheck,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    border: 'border-emerald-300/40 dark:border-emerald-700/40',
  },
  caution: {
    label: 'Perlu Waspada',
    icon: ShieldAlert,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    border: 'border-amber-300/40 dark:border-amber-700/40',
  },
  suspicious: {
    label: 'Mencurigakan',
    icon: ShieldX,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    border: 'border-red-300/40 dark:border-red-700/40',
  },
};

const aiVerdictConfig = {
  safe: { label: 'AI: Aman', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300', icon: ShieldCheck },
  suspicious: { label: 'AI: Curiga', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', icon: ShieldX },
};

export default function JobCard({ title, summary, source, source_url, published_date, tags, validation, index }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const cfg = validation ? verdictConfig[validation.verdict] : null;
  const Icon = cfg?.icon ?? Briefcase;

  async function runAiAnalysis(e: React.MouseEvent) {
    e.stopPropagation();
    if (aiAnalysis || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/job-ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, source_url, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal analisis');
      setAiAnalysis(data);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Gagal menghubungi AI');
    } finally {
      setAiLoading(false);
    }
  }

  const bookmarkItem = {
    type: 'job' as const,
    title, summary, source, source_url, published_date,
    category: 'lowongan_kerja',
    tags, is_urgent: false, is_job: true,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        data-testid={`card-job-${index}`}
        className={cn('group card-hover depth-card h-full flex flex-col border-2', cfg?.border ?? 'border-border/50')}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-medium truncate">{source}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {cfg && (
                <Badge className={cn('text-[10px] gap-1 font-semibold', cfg.color)}>
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </Badge>
              )}
              {aiAnalysis && (() => {
                const ac = aiVerdictConfig[aiAnalysis.verdict];
                return (
                  <Badge className={cn('text-[10px] gap-1 font-semibold', ac.color)}>
                    <ac.icon className="h-3 w-3" />
                    {ac.label}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <h3
            data-testid={`text-job-title-${index}`}
            className="text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors"
          >
            {title}
          </h3>
          <ArticleTags tags={tags} />
        </CardHeader>

        <CardContent className="flex-1 flex flex-col pt-0">
          <p className="text-sm text-muted-foreground mb-3 line-clamp-3 flex-1 leading-relaxed">{summary}</p>

          {validation && validation.reasons.length > 0 && (
            <div className="mb-3">
              <button
                data-testid={`button-trust-score-${index}`}
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Skor keamanan: {validation.score}/100
              </button>
              {expanded && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-1 text-[11px] text-muted-foreground border-l-2 border-border pl-2"
                >
                  {validation.trust_signals.slice(0, 3).map((r, i) => (
                    <li key={`g-${i}`} className="flex gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                      <span>{r}</span>
                    </li>
                  ))}
                  {validation.red_flags.slice(0, 3).map((r, i) => (
                    <li key={`r-${i}`} className="flex gap-1.5">
                      <span className="text-red-600 dark:text-red-400">⚠</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </div>
          )}

          {aiAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'mb-3 rounded-lg p-2.5 text-[11px] leading-relaxed border',
                aiAnalysis.verdict === 'safe'
                  ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50/60 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/30 text-red-800 dark:text-red-300'
              )}
            >
              <p className="font-medium mb-1">Analisis AI (kepercayaan {aiAnalysis.confidence}%)</p>
              <p className="text-muted-foreground">{aiAnalysis.analysis}</p>
              {aiAnalysis.red_flags?.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {aiAnalysis.red_flags.slice(0, 2).map((f, i) => (
                    <li key={i} className="flex gap-1"><span className="text-red-500">⚠</span>{f}</li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {aiError && (
            <p className="text-[11px] text-destructive mb-2">{aiError}</p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t border-border/40">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(published_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
            <div className="flex items-center gap-1">
              {!aiAnalysis && (
                <Button
                  data-testid={`button-ai-analyze-${index}`}
                  size="sm"
                  variant="ghost"
                  onClick={runAiAnalysis}
                  disabled={aiLoading}
                  className="h-7 text-xs gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700"
                >
                  {aiLoading
                    ? <><Loader2 className="h-3 w-3 animate-spin" />Analisis...</>
                    : <><Sparkles className="h-3 w-3" />Analisis AI</>
                  }
                </Button>
              )}
              <BookmarkButton item={bookmarkItem} />
              <a
                data-testid={`link-apply-${index}`}
                href={source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
              >
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                  Lamar <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
