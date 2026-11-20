const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const buttonPrimary = `inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-primary px-5 text-[15px] font-medium text-cream transition-quick hover:bg-primary-hover ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`;

export const buttonSecondary = `inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] border border-current bg-transparent px-5 text-[15px] font-medium text-surface transition-quick hover:bg-surface/10 ${focusRing} disabled:cursor-not-allowed disabled:opacity-60`;

export const inputClass = `block h-12 w-full rounded-[4px] border border-ink bg-cream px-3.5 text-base text-ink placeholder:text-muted ${focusRing}`;

/** Quiet text link: underlined, ink or cream depending on the surface. */
export const textLink = `inline-flex min-h-11 items-center gap-1.5 font-medium text-surface underline decoration-1 underline-offset-4 transition-quick hover:decoration-2 ${focusRing}`;

/** Mono caps label: 12px, tracked out. */
export const monoLabel = "font-mono text-xs font-medium uppercase tracking-[0.08em]";

/** A section opened by a hairline rule instead of a boxed card. */
export const cardClass = "border-t border-rule pt-5";
