import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { changeSignupDeadline, closeSignupsNow } from "@/lib/group-settings";
import { getGroupStatus } from "@/lib/group-status";
import { joinGroup } from "@/lib/groups";
import { runRaffle } from "@/lib/raffle-service";
import { upsertUser } from "@/lib/users";
import { DAY, DEADLINE, HOUR, T0, makeGroup, makeUsers } from "./helpers/scenario";
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

const deadlineOf = async (groupId: string) =>
  (await query<{ d: Date }>(t.db, "SELECT signup_deadline AS d FROM groups WHERE id = $1", [groupId]))[0].d;

const NOW = new Date(T0.getTime() + 2 * HOUR);

describe("closeSignupsNow", () => {
  it("closes an open group immediately so the raffle can run", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const result = await closeSignupsNow(t.db, { groupId, userId: users[0].id, now: NOW });
    expect(result).toEqual({ ok: true, signupDeadline: NOW });
    expect((await deadlineOf(groupId)).getTime()).toBe(NOW.getTime());
    expect(getGroupStatus({ signupDeadline: await deadlineOf(groupId), raffledAt: null }, NOW)).toBe("closed");
    expect(await runRaffle(t.db, { groupId, userId: users[0].id, now: NOW })).toEqual({ ok: true, assignmentCount: 3 });
  });

  it("stops new people from joining with the code", async () => {
    const { users, groupId, inviteCode } = await makeGroup(t.db, 3);
    await closeSignupsNow(t.db, { groupId, userId: users[0].id, now: NOW });
    const late = await upsertUser(t.db, { workosUserId: "late", email: "late@example.com" });
    const joined = await joinGroup(t.db, {
      userId: late.id,
      inviteCode,
      displayName: "Late",
      now: new Date(NOW.getTime() + 1000),
    });
    expect(joined).toEqual({ ok: false, error: "closed" });
  });

  it("keeps the earlier close time when the group is already closed", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const later = new Date(DEADLINE.getTime() + DAY);
    const result = await closeSignupsNow(t.db, { groupId, userId: users[0].id, now: later });
    expect(result).toEqual({ ok: true, signupDeadline: DEADLINE });
    expect((await deadlineOf(groupId)).getTime()).toBe(DEADLINE.getTime());
  });

  it("only the organizer can do it", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    expect(await closeSignupsNow(t.db, { groupId, userId: users[1].id, now: NOW })).toEqual({ ok: false, error: "not_admin" });
    expect((await deadlineOf(groupId)).getTime()).toBe(DEADLINE.getTime());
  });

  it("a non-member and a malformed id both get not_found", async () => {
    const { groupId } = await makeGroup(t.db, 3);
    const [outsider] = await makeUsers(t.db, 4).then((u) => u.slice(3));
    expect(await closeSignupsNow(t.db, { groupId, userId: outsider.id, now: NOW })).toEqual({ ok: false, error: "not_found" });
    expect(await closeSignupsNow(t.db, { groupId: "nope", userId: outsider.id, now: NOW })).toEqual({ ok: false, error: "not_found" });
  });

  it("refuses once the names are drawn and changes nothing", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const after = new Date(DEADLINE.getTime() + HOUR);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: after });
    expect(await closeSignupsNow(t.db, { groupId, userId: users[0].id, now: after })).toEqual({ ok: false, error: "already_raffled" });
    expect((await deadlineOf(groupId)).getTime()).toBe(DEADLINE.getTime());
  });
});

describe("changeSignupDeadline", () => {
  it("moves the date earlier or later while open", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const earlier = new Date(T0.getTime() + 3 * HOUR);
    expect(await changeSignupDeadline(t.db, { groupId, userId: users[0].id, signupDeadline: earlier, now: NOW })).toEqual({ ok: true, signupDeadline: earlier });
    const later = new Date(T0.getTime() + 30 * DAY);
    await changeSignupDeadline(t.db, { groupId, userId: users[0].id, signupDeadline: later, now: NOW });
    expect((await deadlineOf(groupId)).getTime()).toBe(later.getTime());
  });

  it("reopens a closed group that has not been raffled when the new date is in the future", async () => {
    const { users, groupId } = await makeGroup(t.db, 2);
    const afterClose = new Date(DEADLINE.getTime() + HOUR);
    const next = new Date(afterClose.getTime() + 2 * DAY);
    const result = await changeSignupDeadline(t.db, { groupId, userId: users[0].id, signupDeadline: next, now: afterClose });
    expect(result.ok).toBe(true);
    expect(getGroupStatus({ signupDeadline: await deadlineOf(groupId), raffledAt: null }, afterClose)).toBe("open");
  });

  it("rejects a date in the past, an invalid date, a non-organizer and a raffled group", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const args = { groupId, now: NOW };
    expect(await changeSignupDeadline(t.db, { ...args, userId: users[0].id, signupDeadline: new Date(NOW.getTime() - 1) })).toEqual({ ok: false, error: "deadline_in_past" });
    expect(await changeSignupDeadline(t.db, { ...args, userId: users[0].id, signupDeadline: new Date(NOW.getTime()) })).toEqual({ ok: false, error: "deadline_in_past" });
    expect(await changeSignupDeadline(t.db, { ...args, userId: users[0].id, signupDeadline: new Date("nope") })).toEqual({ ok: false, error: "invalid_deadline" });
    expect(await changeSignupDeadline(t.db, { ...args, userId: users[1].id, signupDeadline: new Date(NOW.getTime() + DAY) })).toEqual({ ok: false, error: "not_admin" });
    const after = new Date(DEADLINE.getTime() + HOUR);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: after });
    expect(await changeSignupDeadline(t.db, { groupId, userId: users[0].id, signupDeadline: new Date(after.getTime() + DAY), now: after })).toEqual({ ok: false, error: "already_raffled" });
    expect((await deadlineOf(groupId)).getTime()).toBe(DEADLINE.getTime());
  });
});
