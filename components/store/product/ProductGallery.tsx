"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui";
import ProductImage from "./ProductImage";

/**
 * design/Product: 72px thumbnails beside a square photo with a "1 / N" counter.
 * design/MProduct: full-bleed swipeable photos with dots and a floating back button.
 */
export default function ProductGallery({
  id,
  title,
  images,
  icon,
  label,
}: {
  id: string;
  title: string;
  images: string[];
  icon: string | null;
  /** Badge over the photo (discount, "Эрэлттэй"…). */
  label: ReactNode;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const list = images.length > 0 ? images : [""];
  const n = list.length;

  const goBack = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <>
      {/* ——— Phones ——— */}
      <div className="relative -mx-4 -mt-4 lg:hidden">
        <div ref={track} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
          {list.map((src, i) => (
            <ProductImage
              key={i}
              id={id}
              src={src}
              alt={i === 0 ? title : `${title} — зураг ${i + 1}`}
              icon={icon}
              eager={i === 0}
              iconClassName="size-24 text-[#8b8bff]"
              className="aspect-square w-full shrink-0 snap-center"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={goBack}
          aria-label="Буцах"
          className="absolute top-3 left-3 grid size-11 place-items-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <div className="absolute bottom-3 left-3">{label}</div>
        {n > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
            {list.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-[3px] bg-brand transition-all", i === index ? "w-[18px]" : "w-1.5 opacity-30")} />
            ))}
          </div>
        )}
      </div>

      {/* ——— Desktop ——— */}
      <div className="hidden min-w-0 gap-3.5 lg:flex lg:flex-[1_1_480px]">
        {n > 1 && (
          <div className="flex flex-col gap-2.5" role="tablist" aria-label="Зургууд">
            {list.slice(0, 6).map((src, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Зураг ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn("size-[72px] overflow-hidden rounded-[10px] border-2", i === index ? "border-brand" : "border-slate-200 hover:border-slate-300")}
              >
                <ProductImage id={id} src={src} alt="" icon={icon} iconClassName="size-6" className="h-full w-full" />
              </button>
            ))}
          </div>
        )}
        <div className="relative aspect-square flex-1 overflow-hidden rounded-[14px]">
          <ProductImage id={id} src={list[index]} alt={title} icon={icon} eager iconClassName="size-32 text-[#8b8bff]" className="h-full w-full" />
          <div className="absolute top-4 left-4">{label}</div>
          {n > 1 && (
            <span className="absolute right-4 bottom-4 rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 tabular-nums">
              {index + 1} / {n}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
