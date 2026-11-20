export const MIN_MEMBERS = 3;

export type GroupStatus = "open" | "closed" | "raffled";

export function getGroupStatus(
  group: { signupDeadline: Date; raffledAt: Date | null },
  now: Date,
): GroupStatus {
  if (group.raffledAt) return "raffled";
  return now.getTime() >= group.signupDeadline.getTime() ? "closed" : "open";
}
