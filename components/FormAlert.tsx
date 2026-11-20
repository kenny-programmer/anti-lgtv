"use client";

import { useEffect, useRef } from "react";
import { scrollToCenter } from "@/components/scroll-motion";

/**
 * An error message (role="alert") that glides into the middle of the screen
 * and takes focus when it appears, so on a phone the person sees it.
 * `trigger` changes on every new result, so a repeated error moves again.
 */
export function FormAlert({
  className,
  trigger,
  children,
}: {
  className: string;
  trigger: unknown;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    void scrollToCenter(element).then(() => element.focus({ preventScroll: true }));
  }, [trigger]);

  return (
    <p ref={ref} role="alert" tabIndex={-1} className={`${className} focus:outline-none`}>
      {children}
    </p>
  );
}
