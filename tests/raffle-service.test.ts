import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { getGroupForMember, joinGroup } from "@/lib/groups";
import { revealAssignment, runRaffle } from "@/lib/raffle-service";
import { AFTER_DEADLINE, HOUR, T0, makeGroup, makeUsers } from "./helpers/scenario";
import { createTestDb, type TestDb } from "./helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

const assignmentRows = () =>
  query<{ giver: string; receiver: string }>(
    t.db,
    `SELECT gm.display_name AS giver, rm.display_name AS receiver
     FROM assignments a
     JOIN memberships gm ON gm.id = a.giver_membership_id
     JOIN memberships rm ON rm.id = a.receiver_membership_id
     ORDER BY gm.display_name`,
  );

const raffledAt = async (groupId: string) =>
  (await query<{ raffled_at: Date | null }>(t.db, "SELECT raffled_at FROM groups WHERE id = $1", [groupId]))[0].raffled_at;

describe("runRaffle", () => {
  it("assigns every member exactly one other member, and nobody is picked twice", async () => {
    const { users, groupId } = await makeGroup(t.db, 6);
    const result = await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(result).toEqual({ ok: true, assignmentCount: 6 });

    const rows = await assignmentRows();
    expect(rows).toHaveLength(6);
    const names = ["Member 1", "Member 2", "Member 3", "Member 4", "Member 5", "Member 6"];
    expect(rows.map((r) => r.giver).sort()).toEqual(names);
    expect(rows.map((r) => r.receiver).sort()).toEqual(names);
    expect(rows.every((r) => r.giver !== r.receiver)).toBe(true);
    expect(await raffledAt(groupId)).not.toBeNull();
  });

  it("works for the minimum group of three", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    expect(await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE })).toEqual({ ok: true, assignmentCount: 3 });
  });

  it("refuses before the deadline and writes nothing", async () => {
    const { users, groupId } = await makeGroup(t.db, 4);
    const result = await runRaffle(t.db, { groupId, userId: users[0].id, now: new Date(T0.getTime() + 2 * HOUR) });
    expect(result).toEqual({ ok: false, error: "too_early" });
    expect(await assignmentRows()).toHaveLength(0);
    expect(await raffledAt(groupId)).toBeNull();
  });

  it("refuses anyone who is not the organizer", async () => {
    const { users, groupId } = await makeGroup(t.db, 4);
    expect(await runRaffle(t.db, { groupId, userId: users[1].id, now: AFTER_DEADLINE })).toEqual({ ok: false, error: "not_admin" });
    expect(await assignmentRows()).toHaveLength(0);
  });

  it("treats outsiders and bad ids as not found", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const [, , , outsider] = await makeUsers(t.db, 4);
    expect(await runRaffle(t.db, { groupId, userId: outsider.id, now: AFTER_DEADLINE })).toEqual({ ok: false, error: "not_found" });
    expect(await runRaffle(t.db, { groupId: "nope", userId: users[0].id, now: AFTER_DEADLINE })).toEqual({ ok: false, error: "not_found" });
  });

  it("refuses fewer than three members and rolls the claim back", async () => {
    const { users, groupId } = await makeGroup(t.db, 2);
    const result = await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(result).toEqual({ ok: false, error: "not_enough_members" });
    expect(await assignmentRows()).toHaveLength(0);
    expect(await raffledAt(groupId)).toBeNull();
  });

  it("refuses a second raffle and leaves the first draw untouched", async () => {
    const { users, groupId } = await makeGroup(t.db, 5);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    const before = await assignmentRows();
    const again = await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(again).toEqual({ ok: false, error: "already_raffled" });
    expect(await assignmentRows()).toEqual(before);
  });

  it("blocks new members once the raffle has run", async () => {
    const { users, groupId, inviteCode } = await makeGroup(t.db, 3);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    const [, , , late] = await makeUsers(t.db, 4);
    const result = await joinGroup(t.db, { userId: late.id, inviteCode, displayName: "Late", now: new Date(T0.getTime() + 2 * HOUR) });
    expect(result).toEqual({ ok: false, error: "closed" });
  });
});

describe("revealAssignment", () => {
  it("gives each member their own match, and the matches form a bijection", async () => {
    const { users, groupId } = await makeGroup(t.db, 5);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });

    const revealed: string[] = [];
    for (const [i, user] of users.entries()) {
      const result = await revealAssignment(t.db, { groupId, userId: user.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.receiverName).not.toBe(`Member ${i + 1}`);
      revealed.push(result.receiverName);
    }
    expect([...revealed].sort()).toEqual(["Member 1", "Member 2", "Member 3", "Member 4", "Member 5"]);

    const rows = await assignmentRows();
    for (const [i] of users.entries()) {
      expect(rows.find((r) => r.giver === `Member ${i + 1}`)?.receiver).toBe(revealed[i]);
    }
  });

  it("is stable on repeat and keeps the first reveal time", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    const first = await revealAssignment(t.db, { groupId, userId: users[1].id, now: new Date("2031-01-01T00:00:00Z") });
    const second = await revealAssignment(t.db, { groupId, userId: users[1].id, now: new Date("2032-01-01T00:00:00Z") });
    expect(second).toEqual(first);
    const [row] = await query<{ revealed_at: Date }>(
      t.db,
      `SELECT a.revealed_at FROM assignments a JOIN memberships m ON m.id = a.giver_membership_id WHERE m.user_id = $1`,
      [users[1].id],
    );
    expect(row.revealed_at.toISOString()).toBe("2031-01-01T00:00:00.000Z");
  });

  it("has nothing to reveal before the raffle, for outsiders, or for bad ids", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const [, , , outsider] = await makeUsers(t.db, 4);
    expect(await revealAssignment(t.db, { groupId, userId: users[0].id })).toEqual({ ok: false, error: "no_assignment" });
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(await revealAssignment(t.db, { groupId, userId: outsider.id })).toEqual({ ok: false, error: "no_assignment" });
    expect(await revealAssignment(t.db, { groupId: "nope", userId: users[0].id })).toEqual({ ok: false, error: "no_assignment" });
  });

  it("keeps the match hidden from the group view until it is revealed", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });

    const before = await getGroupForMember(t.db, { groupId, userId: users[1].id });
    expect(before?.myMatch).toEqual({ revealed: false, receiverName: null });

    const result = await revealAssignment(t.db, { groupId, userId: users[1].id });
    if (!result.ok) throw new Error("reveal failed");
    const after = await getGroupForMember(t.db, { groupId, userId: users[1].id });
    expect(after?.myMatch).toEqual({ revealed: true, receiverName: result.receiverName });
  });
});
