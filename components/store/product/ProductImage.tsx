import { cn } from "@/components/ui";
import SafeImage from "../SafeImage";
import CategoryIcon from "../shell/CategoryIcon";

/** Pastel tiles from the design, picked per product so a grid without photos still reads as distinct items. */
const TINTS = ["bg-brand-50", "bg-slate-100", "bg-[#fef3c7]", "bg-[#dcfce7]", "bg-[#fce7f3]"] as const;

export function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * Product photo on its tint. Without a photo (or if it fails to load) the tile shows the
 * category's line icon, like the design's placeholders.
 */
export default function ProductImage({
  id,
  src,
  alt,
  icon,
  className,
  iconClassName = "size-12",
  eager = false,
}: {
  id: string;
  src: string;
  alt: string;
  icon: string | null;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}) {
  return (
    <div className={cn("relative grid place-items-center overflow-hidden text-slate-400", tintFor(id), className)}>
      {src ? (
        <SafeImage src={src} alt={alt} eager={eager} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <CategoryIcon icon={icon} className={iconClassName} />
      )}
    </div>
  );
}
