"use client";

import { scrollToTop } from "@/components/scroll-motion";

/**
 * An in-page anchor with the designed scroll. Without JavaScript it is a plain
 * link and the browser jumps. After the scroll, focus moves to `focusId` (an
 * element with tabIndex={-1}) and the URL hash is updated without a jump.
 */
export function ScrollLink({
  href,
  focusId,
  className,
  children,
}: {
  href: `#${string}`;
  focusId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={async (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        event.preventDefault();
        await scrollToTop(target);
        window.history.replaceState(null, "", href);
        const focusTarget = (focusId && document.getElementById(focusId)) || target;
        focusTarget.focus({ preventScroll: true });
      }}
    >
      {children}
    </a>
  );
}
