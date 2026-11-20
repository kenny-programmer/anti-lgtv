"use client";

import { useEffect, useRef } from "react";
import { scrollToCenter } from "@/components/scroll-motion";

export const ARRIVAL_KEY = "gift-raffle:scroll-to";

/**
 * Glides its content into view once, when the previous action asked for it
 * (for example: the organizer just ran the raffle, so bring the new reveal
 * tag into view). The request is a one-shot sessionStorage flag.
 */
export function ScrollOnArrival({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let wanted = false;
    try {
      wanted = window.sessionStorage.getItem(ARRIVAL_KEY) === id;
      if (wanted) window.sessionStorage.removeItem(ARRIVAL_KEY);
    } catch {
      wanted = false;
    }
    if (wanted && ref.current) void scrollToCenter(ref.current);
  }, [id]);

  return <div ref={ref}>{children}</div>;
}
