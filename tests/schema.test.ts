import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

async function seed() {
  const userIds: string[] = [];
  for (const n of [1, 2, 3, 4]) {
    const { rows } = await t.db.pool.query(
      "INSERT INTO users (workos_user_id, email) VALUES ($1, $2) RETURNING id",
      [`w${n}`, `u${n}@example.com`],
    );
    userIds.push(rows[0].id);
  }
  const { rows: groups } = await t.db.pool.query(
    "INSERT INTO groups (name, invite_code, signup_deadline, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
    ["Group", "ABCD1234", new Date("2030-01-01T00:00:00Z"), userIds[0]],
  );
  const groupId: string = groups[0].id;
  const memberIds: string[] = [];
  for (const [i, userId] of userIds.slice(0, 3).entries()) {
    const { rows } = await t.db.pool.query(
      "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3) RETURNING id",
      [groupId, userId, `Member ${i + 1}`],
    );
    memberIds.push(rows[0].id);
  }
  return { groupId, userIds, memberIds };
}

const assign = (groupId: string, giver: string, receiver: string) =>
  t.db.pool.query(
    "INSERT INTO assignments (group_id, giver_membership_id, receiver_membership_id) VALUES ($1, $2, $3)",
    [groupId, giver, receiver],
  );

describe("schema constraints", () => {
  it("rejects invite codes that are not 8 characters of A-Z0-9", async () => {
    const { userIds } = await seed();
    for (const bad of ["abcd1234", "ABCD123", "ABCD-1234", "ABCD12345"]) {
      await expect(
        t.db.pool.query(
          "INSERT INTO groups (name, invite_code, signup_deadline, created_by) VALUES ($1, $2, $3, $4)",
          ["G", bad, new Date("2030-01-01T00:00:00Z"), userIds[0]],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }
  });

  it("rejects a duplicate invite code", async () => {
    const { userIds } = await seed();
    await expect(
      t.db.pool.query(
        "INSERT INTO groups (name, invite_code, signup_deadline, created_by) VALUES ($1, $2, $3, $4)",
        ["G2", "ABCD1234", new Date("2030-01-01T00:00:00Z"), userIds[0]],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects the same display name in one group, ignoring case", async () => {
    const { groupId, userIds } = await seed();
    await expect(
      t.db.pool.query(
        "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3)",
        [groupId, userIds[3], "member 1"],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects a user joining the same group twice", async () => {
    const { groupId, userIds } = await seed();
    await expect(
      t.db.pool.query(
        "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3)",
        [groupId, userIds[0], "Someone Else"],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects assigning a member to themselves", async () => {
    const { groupId, memberIds } = await seed();
    await expect(assign(groupId, memberIds[0], memberIds[0])).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects two givers sharing the same receiver", async () => {
    const { groupId, memberIds } = await seed();
    await assign(groupId, memberIds[0], memberIds[1]);
    await expect(assign(groupId, memberIds[2], memberIds[1])).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects one giver having two receivers", async () => {
    const { groupId, memberIds } = await seed();
    await assign(groupId, memberIds[0], memberIds[1]);
    await expect(assign(groupId, memberIds[0], memberIds[2])).rejects.toMatchObject({ code: "23505" });
  });

  it("accepts a full cycle of assignments", async () => {
    const { groupId, memberIds } = await seed();
    await assign(groupId, memberIds[0], memberIds[1]);
    await assign(groupId, memberIds[1], memberIds[2]);
    await assign(groupId, memberIds[2], memberIds[0]);
    const { rows } = await t.db.pool.query("SELECT count(*)::int AS n FROM assignments");
    expect(rows[0].n).toBe(3);
  });
});
