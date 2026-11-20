/**
 * Baker's twine wrapped twice around a ribbon: the knot a gift tag hangs from.
 * Cream line with red dashes, drawn flat. Decorative only.
 */
export function Twine({ className = "" }: { className?: string }) {
  const strands = ["M3 3 L89 11", "M3 11 L89 3"];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 92 14"
      preserveAspectRatio="none"
      className={className}
      height="14"
    >
      {strands.map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke="var(--cream)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={d} fill="none" stroke="var(--ribbon)" strokeWidth="2.5" strokeDasharray="3 3" />
        </g>
      ))}
    </svg>
  );
}
