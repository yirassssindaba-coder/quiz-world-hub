export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border/50 p-6 space-y-3 bg-card ${className}`}>
      <div className="h-4 w-20 rounded skeleton-shimmer" />
      <div className="h-5 w-full rounded skeleton-shimmer" />
      <div className="h-5 w-3/4 rounded skeleton-shimmer" />
      <div className="h-4 w-full rounded skeleton-shimmer" />
      <div className="h-4 w-2/3 rounded skeleton-shimmer" />
      <div className="flex justify-between pt-2">
        <div className="h-3 w-24 rounded skeleton-shimmer" />
        <div className="h-3 w-12 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl skeleton-shimmer ${className}`} />;
}
