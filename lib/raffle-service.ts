import { isUuid, query, Rollback, withTransaction, type Db } from "@/lib/db";
import { MIN_MEMBERS, getGroupStatus } from "@/lib/group-status";
import { drawAssignments } from "@/lib/raffle";

export type RunRaffleResult =
  | { ok: true; assignmentCount: number }
  | {
      ok: false;
      error: "not_found" | "not_admin" | "too_early" | "already_raffled" | "not_enough_members";
    };

export async function runRaffle(
  db: Db,
  input: { groupId: string; userId: string; now?: Date },
): Promise<RunRaffleResult> {
  const now = input.now ?? new Date();
  if (!isUuid(input.groupId)) return { ok: false, error: "not_found" };

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

  const status = getGroupStatus(group, now);
  if (status === "raffled") return { ok: false, error: "already_raffled" };
  if (status === "open") return { ok: false, error: "too_early" };

  return withTransaction<RunRaffleResult>(db, async (q) => {
    const claimed = await q(
      `UPDATE groups SET raffled_at = $2
       WHERE id = $1 AND raffled_at IS NULL AND signup_deadline <= $2
       RETURNING id`,
      [input.groupId, now],
    );
    if (claimed.length === 0) {
      throw new Rollback<RunRaffleResult>({ ok: false, error: "already_raffled" });
    }

    const members = await q<{ id: string }>(
      "SELECT id FROM memberships WHERE group_id = $1 ORDER BY id",
      [input.groupId],
    );
    if (members.length < MIN_MEMBERS) {
      throw new Rollback<RunRaffleResult>({ ok: false, error: "not_enough_members" });
    }

    const pairs = drawAssignments(members.map((member) => member.id));
    await q(
      `INSERT INTO assignments (group_id, giver_membership_id, receiver_membership_id)
       SELECT $1, t.giver, t.receiver
       FROM unnest($2::uuid[], $3::uuid[]) AS t(giver, receiver)`,
      [input.groupId, pairs.map((pair) => pair.giver), pairs.map((pair) => pair.receiver)],
    );
    return { ok: true, assignmentCount: pairs.length };
  });
}

export type RevealResult =
  | { ok: true; receiverName: string }
  | { ok: false; error: "no_assignment" };

export async function revealAssignment(
  db: Db,
  input: { groupId: string; userId: string; now?: Date },
): Promise<RevealResult> {
  if (!isUuid(input.groupId)) return { ok: false, error: "no_assignment" };

  const rows = await query<{ receiverName: string }>(
    db,
    `UPDATE assignments a SET revealed_at = COALESCE(a.revealed_at, $3)
     FROM memberships giver, memberships receiver
     WHERE a.group_id = $1
       AND giver.id = a.giver_membership_id AND giver.user_id = $2
       AND receiver.id = a.receiver_membership_id
     RETURNING receiver.display_name AS "receiverName"`,
    [input.groupId, input.userId, input.now ?? new Date()],
  );
  if (!rows[0]) return { ok: false, error: "no_assignment" };
  return { ok: true, receiverName: rows[0].receiverName };
}
