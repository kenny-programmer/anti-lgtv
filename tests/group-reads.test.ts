import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGroup, getGroupForMember, joinGroup, listGroupsForUser } from "@/lib/groups";
import { DEADLINE, T0, makeGroup, makeUsers } from "./helpers/scenario";
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

describe("getGroupForMember", () => {
  it("returns the full view for the organizer", async () => {
    const { users, groupId, inviteCode } = await makeGroup(t.db, 3);
    const view = await getGroupForMember(t.db, { groupId, userId: users[0].id });
    expect(view).not.toBeNull();
    expect(view).toMatchObject({
      id: groupId,
      name: "Test Group",
      inviteCode,
      isAdmin: true,
      raffledAt: null,
      myMatch: null,
      me: { displayName: "Member 1" },
    });
    expect(view!.signupDeadline.getTime()).toBe(DEADLINE.getTime());
    expect(view!.members.map((m) => m.displayName).sort()).toEqual(["Member 1", "Member 2", "Member 3"]);
    expect(view!.members.filter((m) => m.isOrganizer).map((m) => m.displayName)).toEqual(["Member 1"]);
    expect(view!.members.find((m) => m.id === view!.me.membershipId)?.displayName).toBe("Member 1");
  });

  it("marks other members as not admin and uses their own display name", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const view = await getGroupForMember(t.db, { groupId, userId: users[2].id });
    expect(view).toMatchObject({ isAdmin: false, me: { displayName: "Member 3" } });
  });

  it("returns null for a user who is not in the group", async () => {
    const { groupId } = await makeGroup(t.db, 3);
    const [, , , outsider] = await makeUsers(t.db, 4);
    expect(await getGroupForMember(t.db, { groupId, userId: outsider.id })).toBeNull();
  });

  it("returns null for unknown and malformed group ids", async () => {
    const { users } = await makeGroup(t.db, 3);
    expect(await getGroupForMember(t.db, { groupId: "00000000-0000-4000-8000-000000000000", userId: users[0].id })).toBeNull();
    expect(await getGroupForMember(t.db, { groupId: "not-a-uuid", userId: users[0].id })).toBeNull();
    expect(await getGroupForMember(t.db, { groupId: "1; DROP TABLE groups", userId: users[0].id })).toBeNull();
  });
});

describe("listGroupsForUser", () => {
  it("lists only the user's own groups with member counts and admin flags", async () => {
    const [ann, bob, cy] = await makeUsers(t.db, 3);
    const mine = await createGroup(t.db, { userId: ann.id, name: "Mine", displayName: "Ann", signupDeadline: DEADLINE, now: T0 });
    const theirs = await createGroup(t.db, { userId: bob.id, name: "Theirs", displayName: "Bob", signupDeadline: DEADLINE, now: T0 });
    const other = await createGroup(t.db, { userId: cy.id, name: "Unrelated", displayName: "Cy", signupDeadline: DEADLINE, now: T0 });
    if (!mine.ok || !theirs.ok || !other.ok) throw new Error("setup failed");
    await joinGroup(t.db, { userId: cy.id, inviteCode: mine.group.inviteCode, displayName: "Cyrus", now: T0 });
    await joinGroup(t.db, { userId: ann.id, inviteCode: theirs.group.inviteCode, displayName: "Annie", now: T0 });

    const groups = await listGroupsForUser(t.db, ann.id);
    const byName = Object.fromEntries(groups.map((g) => [g.name, g]));
    expect(Object.keys(byName).sort()).toEqual(["Mine", "Theirs"]);
    expect(byName.Mine).toMatchObject({ memberCount: 2, isAdmin: true, raffledAt: null });
    expect(byName.Theirs).toMatchObject({ memberCount: 2, isAdmin: false });
    expect(byName.Mine.signupDeadline.getTime()).toBe(DEADLINE.getTime());
  });

  it("returns an empty list for a user with no groups", async () => {
    const [ann] = await makeUsers(t.db, 1);
    expect(await listGroupsForUser(t.db, ann.id)).toEqual([]);
  });
});
