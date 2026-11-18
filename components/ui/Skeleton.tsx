import { cn } from "./cn";

/**
 * Placeholder block with a 1.2s shimmer; static under prefers-reduced-motion.
 * Size it with className (h-*, w-*, rounded-*). Wrap a group of skeletons in an
 * element with aria-busy="true" so screen readers skip them.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block rounded-sm bg-slate-200 bg-[linear-gradient(90deg,transparent,var(--color-slate-100),transparent)] bg-[length:200%_100%] bg-no-repeat animate-shimmer motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Multi-line text placeholder; the last line is shorter, like real text. */
export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 && lines > 1 ? "w-1/2" : "w-4/5")} />
      ))}
    </span>
  );
}
