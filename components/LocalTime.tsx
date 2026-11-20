"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function format(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(subscribe, () => format(iso), () => "");
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
