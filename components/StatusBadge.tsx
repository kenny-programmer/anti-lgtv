import type { GroupStatus } from "@/lib/group-status";

// A printed status mark: an 8px square plus a mono label. The label always
// carries the meaning; the colour of the square only repeats it.
const STYLES: Record<GroupStatus, { label: string; className: string }> = {
  open: { label: "Open for signups", className: "bg-leaf pulse-loop" },
  closed: { label: "Signups closed", className: "bg-ribbon" },
  raffled: { label: "Names drawn", className: "bg-ink" },
};

export function StatusBadge({ status }: { status: GroupStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-xs font-medium uppercase tracking-[0.08em] text-ink">
      <span aria-hidden="true" className={`size-2 shrink-0 ${className}`} />
      {label}
    </span>
  );
}
