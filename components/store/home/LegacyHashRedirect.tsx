"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The old single-page store linked categories as "/#category-toys". A hash never reaches
 * the server, so the redirect to /c/toys happens here. Ids that are no longer a visible
 * category ("all", deleted, hidden) stay on the home page with the hash removed.
 */
export default function LegacyHashRedirect({ slugById }: { slugById: Record<string, string> }) {
  const router = useRouter();
  useEffect(() => {
    const match = /^#category-([a-z0-9-]+)$/i.exec(window.location.hash);
    if (!match) return;
    const slug = slugById[match[1]];
    if (slug) router.replace(`/c/${slug}`);
    else window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [router, slugById]);
  return null;
}
