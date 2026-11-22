import { Store } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui";

/**
 * "hotulan.mn" wordmark. The store name comes from settings; the part after the last dot
 * is tinted (design: brand blue on white, #8b8bff on the dark footer).
 */
export default function Logo({
  name,
  tone = "light",
  withMark = true,
  className,
}: {
  name: string;
  tone?: "light" | "dark";
  withMark?: boolean;
  className?: string;
}) {
  const dot = name.lastIndexOf(".");
  const [head, tail] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  return (
    <Link href="/" className={cn("inline-flex shrink-0 items-center gap-2.5", className)} aria-label={`${name} — нүүр хуудас`}>
      {withMark && (
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-[10px] bg-brand text-white">
          <Store className="size-5" strokeWidth={1.8} />
        </span>
      )}
      <span className={cn("text-[21px] font-extrabold tracking-[-0.02em]", tone === "dark" ? "text-white" : "text-slate-900")}>
        {head}
        {tail && <span className={tone === "dark" ? "text-[#8b8bff]" : "text-brand"}>{tail}</span>}
      </span>
    </Link>
  );
}
