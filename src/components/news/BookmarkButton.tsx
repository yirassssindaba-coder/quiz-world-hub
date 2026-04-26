import { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks';
import type { SavedItem } from '@/lib/bookmarks';
import { useToast } from '@/hooks/use-toast';

interface BookmarkButtonProps {
  item: Omit<SavedItem, 'id' | 'saved_at'>;
  className?: string;
  size?: 'sm' | 'icon';
  onToggle?: (saved: boolean) => void;
}

export default function BookmarkButton({ item, className, size = 'sm', onToggle }: BookmarkButtonProps) {
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSaved(isBookmarked(item.source_url));
  }, [item.source_url]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const nowSaved = toggleBookmark(item);
    setSaved(nowSaved);
    onToggle?.(nowSaved);
    toast({
      title: nowSaved ? 'Disimpan!' : 'Dihapus dari tersimpan',
      description: nowSaved
        ? 'Artikel/lowongan disimpan ke daftar Tersimpan kamu.'
        : 'Artikel dihapus dari daftar Tersimpan.',
      duration: 2500,
    });
  }

  if (size === 'icon') {
    return (
      <button
        data-testid={`bookmark-btn-${btoa(item.source_url).slice(0, 8)}`}
        onClick={handleToggle}
        title={saved ? 'Hapus dari tersimpan' : 'Simpan'}
        className={cn(
          'rounded-full p-1.5 transition-colors',
          saved
            ? 'text-primary bg-primary/10 hover:bg-primary/20'
            : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
          className
        )}
      >
        {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <Button
      data-testid={`bookmark-btn-${btoa(item.source_url).slice(0, 8)}`}
      size="sm"
      variant="ghost"
      onClick={handleToggle}
      className={cn(
        'h-7 text-xs gap-1',
        saved ? 'text-primary' : 'text-muted-foreground',
        className
      )}
    >
      {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
      {saved ? 'Tersimpan' : 'Simpan'}
    </Button>
  );
}
