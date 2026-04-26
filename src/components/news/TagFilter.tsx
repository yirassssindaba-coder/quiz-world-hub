import { Badge } from '@/components/ui/badge';
import { ALL_TAGS, TAG_COLORS } from '@/lib/keywords';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  selected: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagFilter({ selected, onSelect }: TagFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-medium border transition-all',
          selected === null
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-border/60 text-muted-foreground hover:border-primary/40'
        )}
      >
        Semua Tag
      </button>
      {ALL_TAGS.map(tag => {
        const isActive = selected === tag;
        return (
          <button
            key={tag}
            onClick={() => onSelect(isActive ? null : tag)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-all',
              isActive
                ? 'bg-primary text-primary-foreground border-primary scale-105'
                : `${TAG_COLORS[tag] || 'bg-card text-muted-foreground'} border-transparent hover:scale-105`
            )}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

export function ArticleTags({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {tags.slice(0, 4).map(tag => (
        <Badge
          key={tag}
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 border-transparent font-medium', TAG_COLORS[tag] || 'bg-muted')}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
