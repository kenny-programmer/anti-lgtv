import { isUuid, query, withTransaction, type Db } from "@/lib/db";
import { getGroupStatus } from "@/lib/group-status";
import { generateInviteCode, normalizeInviteCode } from "@/lib/invite-code";

export const MAX_GROUP_NAME = 80;
export const MAX_DISPLAY_NAME = 40;

export function cleanName(value: string, max: number): string | null {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length >= 1 && cleaned.length <= max ? cleaned : null;
}

export type Group = {
  id: string;
  name: string;
  inviteCode: string;
  signupDeadline: Date;
  raffledAt: Date | null;
  createdBy: string;
};

export type CreateGroupResult =
  | { ok: true; group: Group }
  | { ok: false; error: "invalid_name" | "invalid_display_name" | "deadline_in_past" };

export async function createGroup(
  db: Db,
  input: { userId: string; name: string; displayName: string; signupDeadline: Date; now?: Date },
): Promise<CreateGroupResult> {
  const name = cleanName(input.name, MAX_GROUP_NAME);
  if (!name) return { ok: false, error: "invalid_name" };
  const displayName = cleanName(input.displayName, MAX_DISPLAY_NAME);
  if (!displayName) return { ok: false, error: "invalid_display_name" };
  const now = input.now ?? new Date();
  const deadlineMs = input.signupDeadline.getTime();
  if (Number.isNaN(deadlineMs) || deadlineMs <= now.getTime()) {
    return { ok: false, error: "deadline_in_past" };
  }

  const group = await withTransaction(db, async (q) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await q<Group>(
        `INSERT INTO groups (name, invite_code, signup_deadline, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (invite_code) DO NOTHING
         RETURNING id, name, invite_code AS "inviteCode", signup_deadline AS "signupDeadline",
                   raffled_at AS "raffledAt", created_by AS "createdBy"`,
        [name, generateInviteCode(), input.signupDeadline, input.userId],
      );
      if (rows[0]) {
        await q(
          "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3)",
          [rows[0].id, input.userId, displayName],
        );
        return rows[0];
      }
    }
    throw new Error("Could not allocate a unique invite code");
  });
  return { ok: true, group };
}

export type JoinGroupResult =
  | { ok: true; groupId: string }
  | { ok: false; error: "invalid_display_name" | "unknown_code" | "closed" | "name_taken" }
  | { ok: false; error: "already_member"; groupId: string };

export async function joinGroup(
  db: Db,
  input: { userId: string; inviteCode: string; displayName: string; now?: Date },
): Promise<JoinGroupResult> {
  const displayName = cleanName(input.displayName, MAX_DISPLAY_NAME);
  if (!displayName) return { ok: false, error: "invalid_display_name" };
  const code = normalizeInviteCode(input.inviteCode);
  if (!code) return { ok: false, error: "unknown_code" };
  const now = input.now ?? new Date();

  const inserted = await query<{ groupId: string }>(
    db,
    `INSERT INTO memberships (group_id, user_id, display_name)
     SELECT g.id, $2, $3
     FROM groups g
     WHERE g.invite_code = $1 AND g.raffled_at IS NULL AND g.signup_deadline > $4
     FOR SHARE OF g
     ON CONFLICT DO NOTHING
     RETURNING group_id AS "groupId"`,
    [code, input.userId, displayName, now],
  );
  if (inserted[0]) return { ok: true, groupId: inserted[0].groupId };

  const [group] = await query<{ id: string; signupDeadline: Date; raffledAt: Date | null }>(
    db,
    `SELECT id, signup_deadline AS "signupDeadline", raffled_at AS "raffledAt"
     FROM groups WHERE invite_code = $1`,
    [code],
  );
  if (!group) return { ok: false, error: "unknown_code" };

  const existing = await query(
    db,
    "SELECT 1 FROM memberships WHERE group_id = $1 AND user_id = $2",
    [group.id, input.userId],
  );
  if (existing.length > 0) return { ok: false, error: "already_member", groupId: group.id };
  if (getGroupStatus(group, now) !== "open") return { ok: false, error: "closed" };
  return { ok: false, error: "name_taken" };
}

export type GroupMember = { id: string; displayName: string; isOrganizer: boolean };

export type GroupView = {
  id: string;
  name: string;
  inviteCode: string;
  signupDeadline: Date;
  raffledAt: Date | null;
  isAdmin: boolean;
  me: { membershipId: string; displayName: string };
  members: GroupMember[];
  myMatch: { revealed: boolean; receiverName: string | null } | null;
};

export async function getGroupForMember(
  db: Db,
  input: { groupId: string; userId: string },
): Promise<GroupView | null> {
  if (!isUuid(input.groupId)) return null;

  const [row] = await query<{
    id: string;
    name: string;
    inviteCode: string;
    signupDeadline: Date;
    raffledAt: Date | null;
    createdBy: string;
    membershipId: string;
    displayName: string;
  }>(
    db,
    `SELECT g.id, g.name, g.invite_code AS "inviteCode", g.signup_deadline AS "signupDeadline",
            g.raffled_at AS "raffledAt", g.created_by AS "createdBy",
            m.id AS "membershipId", m.display_name AS "displayName"
     FROM groups g
     JOIN memberships m ON m.group_id = g.id AND m.user_id = $2
     WHERE g.id = $1`,
    [input.groupId, input.userId],
  );
  if (!row) return null;

  const members = await query<GroupMember>(
    db,
    `SELECT m.id, m.display_name AS "displayName", (m.user_id = g.created_by) AS "isOrganizer"
     FROM memberships m
     JOIN groups g ON g.id = m.group_id
     WHERE m.group_id = $1
     ORDER BY m.joined_at, m.id`,
    [input.groupId],
  );

  let myMatch: GroupView["myMatch"] = null;
  if (row.raffledAt) {
    const [assignment] = await query<{ revealedAt: Date | null; receiverName: string }>(
      db,
      `SELECT a.revealed_at AS "revealedAt", r.display_name AS "receiverName"
       FROM assignments a
       JOIN memberships r ON r.id = a.receiver_membership_id
       WHERE a.group_id = $1 AND a.giver_membership_id = $2`,
      [input.groupId, row.membershipId],
    );
    if (assignment) {
      const revealed = assignment.revealedAt !== null;
      myMatch = { revealed, receiverName: revealed ? assignment.receiverName : null };
    }
  }

  return {
    id: row.id,
    name: row.name,
    inviteCode: row.inviteCode,
    signupDeadline: row.signupDeadline,
    raffledAt: row.raffledAt,
    isAdmin: row.createdBy === input.userId,
    me: { membershipId: row.membershipId, displayName: row.displayName },
    members,
    myMatch,
  };
}

export type GroupSummary = {
  id: string;
  name: string;
  signupDeadline: Date;
  raffledAt: Date | null;
  memberCount: number;
  isAdmin: boolean;
};

export async function listGroupsForUser(db: Db, userId: string): Promise<GroupSummary[]> {
  return query<GroupSummary>(
    db,
    `SELECT g.id, g.name, g.signup_deadline AS "signupDeadline", g.raffled_at AS "raffledAt",
            (SELECT count(*)::int FROM memberships c WHERE c.group_id = g.id) AS "memberCount",
            (g.created_by = $1) AS "isAdmin"
     FROM groups g
     JOIN memberships m ON m.group_id = g.id AND m.user_id = $1
     ORDER BY g.created_at DESC, g.id`,
    [userId],
  );
}
