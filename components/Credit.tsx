import { AUTHOR_NAME, AUTHOR_URL } from "@/lib/site";

/** The creator credit: "Created by" with the author's name linking to their site. */
export function Credit({ className = "" }: { className?: string }) {
  return (
    <p
      className={`font-mono text-xs font-medium uppercase tracking-[0.08em] text-surface-muted ${className}`}
    >
      Created by{" "}
      <a
        href={AUTHOR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-6 items-center text-surface underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {AUTHOR_NAME}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
