"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/countdown";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  if (now === null) return null;
  return <span>{formatCountdown(new Date(to).getTime() - now)}</span>;
}
