import { isUuid, query, type Db } from "@/lib/db";
import { getGroupStatus } from "@/lib/group-status";

export type SetDeadlineResult =
  | { ok: true; signupDeadline: Date }
  | { ok: false; error: "not_found" | "not_admin" | "already_raffled" | "deadline_in_past" | "invalid_deadline" };

type Mode = { kind: "close_now" } | { kind: "set"; signupDeadline: Date };

async function setDeadline(
  db: Db,
  input: { groupId: string; userId: string; now?: Date },
  mode: Mode,
): Promise<SetDeadlineResult> {
  const now = input.now ?? new Date();
  if (!isUuid(input.groupId)) return { ok: false, error: "not_found" };

  let deadline: Date;
  if (mode.kind === "close_now") {
    deadline = now;
  } else {
    deadline = mode.signupDeadline;
    if (Number.isNaN(deadline.getTime())) return { ok: false, error: "invalid_deadline" };
    if (deadline.getTime() <= now.getTime()) return { ok: false, error: "deadline_in_past" };
  }

  const [group] = await query<{ createdBy: string; signupDeadline: Date; raffledAt: Date | null }>(
    db,
    `SELECT g.created_by AS "createdBy", g.signup_deadline AS "signupDeadline",
            g.raffled_at AS "raffledAt"
     FROM groups g
     JOIN memberships m ON m.group_id = g.id AND m.user_id = $2
     WHERE g.id = $1`,
    [input.groupId, input.userId],
  );
  if (!group) return { ok: false, error: "not_found" };
  if (group.createdBy !== input.userId) return { ok: false, error: "not_admin" };
  if (getGroupStatus(group, now) === "raffled") return { ok: false, error: "already_raffled" };
  // Closing a group that is already closed keeps its original (earlier) close time.
  if (mode.kind === "close_now" && group.signupDeadline.getTime() <= now.getTime()) {
    return { ok: true, signupDeadline: group.signupDeadline };
  }

  // The raffle claim and joinGroup lock this row too, so the three cannot interleave: once the
  // raffle has claimed the group (raffled_at set) this update matches nothing.
  const updated = await query<{ signupDeadline: Date }>(
    db,
    `UPDATE groups SET signup_deadline = $3
     WHERE id = $1 AND created_by = $2 AND raffled_at IS NULL
     RETURNING signup_deadline AS "signupDeadline"`,
    [input.groupId, input.userId, deadline],
  );
  if (!updated[0]) return { ok: false, error: "already_raffled" };
  return { ok: true, signupDeadline: updated[0].signupDeadline };
}

/** Organizer closes signups right now, because everyone who is coming has joined. */
export const closeSignupsNow = (db: Db, input: { groupId: string; userId: string; now?: Date }) =>
  setDeadline(db, input, { kind: "close_now" });

/** Organizer moves the close date (earlier or later, and a future date reopens a closed group). */
export const changeSignupDeadline = (
  db: Db,
  input: { groupId: string; userId: string; signupDeadline: Date; now?: Date },
) => setDeadline(db, input, { kind: "set", signupDeadline: input.signupDeadline });
