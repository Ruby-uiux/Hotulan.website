import { Star } from "lucide-react";

interface RatingProps {
  value: number;
  count?: number;
  size?: "sm" | "md";
}

/** Fractional stars: a 4.6 rating fills the fifth star to 60% rather than rounding. */
export default function Rating({ value, count, size = "sm" }: RatingProps) {
  const starSize = size === "md" ? "h-4.5 w-4.5" : "h-3.5 w-3.5";
  const label = `5-аас ${value.toFixed(1)} од${count !== undefined ? `, ${count} үнэлгээ` : ""}`;

  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={label}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          const fill = Math.min(1, Math.max(0, value - i));
          return (
            <span key={i} className="relative inline-block shrink-0">
              <Star className={`${starSize} fill-slate-200 text-slate-200`} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${starSize} fill-amber-400 text-amber-400`} />
              </span>
            </span>
          );
        })}
      </div>
      <span aria-hidden="true" className={`font-semibold text-slate-800 ${size === "md" ? "text-sm" : "text-xs"}`}>
        {value.toFixed(1)}
      </span>
      {count !== undefined && (
        <span aria-hidden="true" className={`text-slate-500 ${size === "md" ? "text-sm" : "text-xs"}`}>
          ({count.toLocaleString("en-US")})
        </span>
      )}
    </div>
  );
}
