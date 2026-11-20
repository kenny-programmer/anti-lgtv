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
  const text = formatCountdown(new Date(to).getTime() - now);
  // Each character sits in its own window; when one changes it rolls in.
  // Screen readers get the plain text once (no live region, so no chatter).
  return (
    <span>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split("").map((char, index) => (
          <span key={index} className="roll-window">
            <span key={char}>{char === " " ? "\u00a0" : char}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
