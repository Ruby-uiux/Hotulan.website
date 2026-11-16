"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

/**
 * Remote catalog photos can 404 or be blocked by a corporate proxy. Instead of a
 * broken-image glyph inside an "official" store, we degrade to a neutral tile.
 */
export default function SafeImage({ src, alt, className = "", eager = false }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // An image that errored before hydration never fires React's onError — catch it here.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`}
      >
        <ImageOff className="h-10 w-10" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    // Plain <img>: catalog URLs are already CDN-sized, and this avoids remotePatterns config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
