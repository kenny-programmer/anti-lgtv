import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Rollback, isUuid, query, withTransaction } from "@/lib/db";
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

const insertUser = (q: <R>(text: string, params?: unknown[]) => Promise<R[]>) =>
  q("INSERT INTO users (workos_user_id, email) VALUES ($1, $2)", ["w1", "a@example.com"]);
const countUsers = async () =>
  (await query<{ n: number }>(t.db, "SELECT count(*)::int AS n FROM users"))[0].n;

describe("withTransaction", () => {
  it("commits when the callback resolves and returns its value", async () => {
    const value = await withTransaction(t.db, async (q) => {
      await insertUser(q);
      return "done";
    });
    expect(value).toBe("done");
    expect(await countUsers()).toBe(1);
  });

  it("rolls back and rethrows when the callback throws", async () => {
    await expect(
      withTransaction(t.db, async (q) => {
        await insertUser(q);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await countUsers()).toBe(0);
  });

  it("rolls back and returns the value carried by Rollback", async () => {
    const value = await withTransaction<string>(t.db, async (q) => {
      await insertUser(q);
      throw new Rollback("aborted");
    });
    expect(value).toBe("aborted");
    expect(await countUsers()).toBe(0);
  });
});

describe("isUuid", () => {
  it("accepts uuids and rejects everything else", () => {
    expect(isUuid("d2f2cfc1-9075-409e-9e8c-8867509453ff")).toBe(true);
    expect(isUuid("D2F2CFC1-9075-409E-9E8C-8867509453FF")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("d2f2cfc1-9075-409e-9e8c-8867509453ff'; DROP TABLE users;--")).toBe(false);
  });
});
