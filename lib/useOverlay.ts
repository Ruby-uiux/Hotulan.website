"use client";

import { useEffect, useRef } from "react";

/**
 * Shared behaviour for drawers and modals: Escape closes, the page behind stops
 * scrolling, and the scrollbar gutter is preserved so the layout doesn't jump.
 */
export function useOverlay(open: boolean, onClose: () => void) {
  // Ref keeps the latest handler without re-binding listeners on every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);
}
