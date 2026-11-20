import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { createGroup, joinGroup } from "@/lib/groups";
import { formatInviteCode } from "@/lib/invite-code";
import { upsertUser } from "@/lib/users";
import { DEADLINE, HOUR, T0, makeUsers } from "./helpers/scenario";
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

const count = async (table: "groups" | "memberships") =>
  (await query<{ n: number }>(t.db, `SELECT count(*)::int AS n FROM ${table}`))[0].n;

describe("upsertUser", () => {
  it("returns the same user for the same WorkOS id and refreshes the email", async () => {
    const a = await upsertUser(t.db, { workosUserId: "w1", email: "old@example.com" });
    const b = await upsertUser(t.db, { workosUserId: "w1", email: "new@example.com" });
    expect(b.id).toBe(a.id);
    expect(b.workosUserId).toBe("w1");
    expect(b.email).toBe("new@example.com");
    expect(await query(t.db, "SELECT 1 FROM users")).toHaveLength(1);
  });
});

type Overrides = { name?: string; displayName?: string; signupDeadline?: Date };

describe("createGroup", () => {
  it("creates a group with a cleaned name and an 8-character invite code", async () => {
    const [owner] = await makeUsers(t.db, 1);
    const result = await createGroup(t.db, {
      userId: owner.id,
      name: "  Office   Santa ",
      displayName: "Ann",
      signupDeadline: DEADLINE,
      now: T0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.name).toBe("Office Santa");
    expect(result.group.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(result.group.createdBy).toBe(owner.id);
    expect(result.group.raffledAt).toBeNull();
    expect(result.group.signupDeadline.getTime()).toBe(DEADLINE.getTime());
  });

  it("makes the creator a member under the chosen display name", async () => {
    const [owner] = await makeUsers(t.db, 1);
    await createGroup(t.db, { userId: owner.id, name: "G", displayName: " Ann  B ", signupDeadline: DEADLINE, now: T0 });
    const rows = await query<{ display_name: string; user_id: string }>(
      t.db,
      "SELECT display_name, user_id FROM memberships",
    );
    expect(rows).toEqual([{ display_name: "Ann B", user_id: owner.id }]);
  });

  const invalidCases: [string, Overrides, string][] = [
    ["a blank group name", { name: "   " }, "invalid_name"],
    ["a too-long group name", { name: "x".repeat(81) }, "invalid_name"],
    ["a blank display name", { displayName: " " }, "invalid_display_name"],
    ["a too-long display name", { displayName: "x".repeat(41) }, "invalid_display_name"],
    ["a deadline in the past", { signupDeadline: new Date(T0.getTime() - HOUR) }, "deadline_in_past"],
    ["a deadline exactly now", { signupDeadline: T0 }, "deadline_in_past"],
    ["an invalid deadline", { signupDeadline: new Date("nope") }, "deadline_in_past"],
  ];

  it.each(invalidCases)("rejects %s and writes nothing", async (_label, overrides, error) => {
    const [owner] = await makeUsers(t.db, 1);
    const result = await createGroup(t.db, {
      userId: owner.id,
      name: "Group",
      displayName: "Ann",
      signupDeadline: DEADLINE,
      now: T0,
      ...overrides,
    });
    expect(result).toEqual({ ok: false, error });
    expect(await count("groups")).toBe(0);
    expect(await count("memberships")).toBe(0);
  });

  it("gives every group its own invite code", async () => {
    const [owner] = await makeUsers(t.db, 1);
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await createGroup(t.db, {
        userId: owner.id,
        name: `Group ${i}`,
        displayName: `Ann ${i}`,
        signupDeadline: DEADLINE,
        now: T0,
      });
      if (result.ok) codes.add(result.group.inviteCode);
    }
    expect(codes.size).toBe(20);
  });
});

describe("joinGroup", () => {
  async function setup() {
    const [owner, guest] = await makeUsers(t.db, 2);
    const created = await createGroup(t.db, {
      userId: owner.id,
      name: "Family",
      displayName: "Ann",
      signupDeadline: DEADLINE,
      now: T0,
    });
    if (!created.ok) throw new Error("setup failed");
    return { owner, guest, group: created.group };
  }

  it("joins with a valid code regardless of case, dashes and spaces", async () => {
    const { guest, group } = await setup();
    const typed = ` ${formatInviteCode(group.inviteCode).toLowerCase()} `;
    const result = await joinGroup(t.db, { userId: guest.id, inviteCode: typed, displayName: " Bob ", now: T0 });
    expect(result).toEqual({ ok: true, groupId: group.id });
    const rows = await query<{ display_name: string }>(
      t.db,
      "SELECT display_name FROM memberships WHERE user_id = $1",
      [guest.id],
    );
    expect(rows).toEqual([{ display_name: "Bob" }]);
  });

  it("rejects an unknown code and a malformed code", async () => {
    const { guest } = await setup();
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: "ZZZZ-9999", displayName: "Bob", now: T0 })).toEqual({ ok: false, error: "unknown_code" });
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: "nope", displayName: "Bob", now: T0 })).toEqual({ ok: false, error: "unknown_code" });
    expect(await count("memberships")).toBe(1);
  });

  it("rejects a blank display name", async () => {
    const { guest, group } = await setup();
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "  ", now: T0 })).toEqual({ ok: false, error: "invalid_display_name" });
  });

  it("tells an existing member they are already in, with the group id", async () => {
    const { owner, group } = await setup();
    expect(await joinGroup(t.db, { userId: owner.id, inviteCode: group.inviteCode, displayName: "Another", now: T0 })).toEqual({ ok: false, error: "already_member", groupId: group.id });
  });

  it("rejects a display name already used in the group, ignoring case", async () => {
    const { guest, group } = await setup();
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "ANN", now: T0 })).toEqual({ ok: false, error: "name_taken" });
    expect(await count("memberships")).toBe(1);
  });

  it("closes signups at the deadline", async () => {
    const { guest, group } = await setup();
    const justBefore = new Date(DEADLINE.getTime() - 1000);
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "Bob", now: DEADLINE })).toEqual({ ok: false, error: "closed" });
    expect((await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "Bob", now: justBefore })).ok).toBe(true);
  });

  it("lets one person be in several groups under different names", async () => {
    const [owner1, owner2, guest] = await makeUsers(t.db, 3);
    const g1 = await createGroup(t.db, { userId: owner1.id, name: "Friends", displayName: "Ann", signupDeadline: DEADLINE, now: T0 });
    const g2 = await createGroup(t.db, { userId: owner2.id, name: "Work", displayName: "Cy", signupDeadline: DEADLINE, now: T0 });
    if (!g1.ok || !g2.ok) throw new Error("setup failed");
    expect((await joinGroup(t.db, { userId: guest.id, inviteCode: g1.group.inviteCode, displayName: "Bobby", now: T0 })).ok).toBe(true);
    expect((await joinGroup(t.db, { userId: guest.id, inviteCode: g2.group.inviteCode, displayName: "Robert", now: T0 })).ok).toBe(true);
    const rows = await query<{ display_name: string }>(
      t.db,
      "SELECT display_name FROM memberships WHERE user_id = $1 ORDER BY display_name",
      [guest.id],
    );
    expect(rows.map((r) => r.display_name)).toEqual(["Bobby", "Robert"]);
  });
});
