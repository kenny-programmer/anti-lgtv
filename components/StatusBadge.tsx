import type { GroupStatus } from "@/lib/group-status";

const STYLES: Record<GroupStatus, { label: string; className: string }> = {
  open: { label: "Open for signups", className: "bg-primary/10 text-primary" },
  closed: { label: "Signups closed", className: "bg-accent-soft text-accent" },
  raffled: { label: "Names drawn", className: "bg-foreground/10 text-foreground" },
};

export function StatusBadge({ status }: { status: GroupStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
