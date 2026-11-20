import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Rollback, isUuid, query, withTransaction, type Db } from "@/lib/db";
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
    // The test database shares one session across connections, so an uncommitted transaction is still visible; roll back whatever is left open so the count only sees committed rows.
    await t.db.pool.query("ROLLBACK");
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

type FakeClient = {
  calls: string[];
  releases: unknown[];
  query: (text: string) => Promise<{ rows: unknown[] }>;
  release: (destroy?: unknown) => void;
};

// Rollback failures cannot be induced against the real test database, so these use a stub pool.
function stubDb(options: { failRollbackWith?: Error } = {}) {
  const client: FakeClient = {
    calls: [],
    releases: [],
    query: async (text) => {
      client.calls.push(text);
      if (text === "ROLLBACK" && options.failRollbackWith) throw options.failRollbackWith;
      return { rows: [] };
    },
    release: (destroy) => {
      client.releases.push(destroy);
    },
  };
  const db = { pool: { connect: async () => client } } as unknown as Db;
  return { db, client };
}

describe("withTransaction when ROLLBACK fails", () => {
  it("rethrows the original error and destroys the client", async () => {
    const { db, client } = stubDb({ failRollbackWith: new Error("rollback failed") });
    await expect(
      withTransaction(db, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(client.calls).toEqual(["BEGIN", "ROLLBACK"]);
    expect(client.releases).toEqual([true]);
  });

  it("throws the ROLLBACK error instead of returning when the callback threw Rollback", async () => {
    const { db, client } = stubDb({ failRollbackWith: new Error("rollback failed") });
    await expect(
      withTransaction(db, async () => {
        throw new Rollback("x");
      }),
    ).rejects.toThrow("rollback failed");
    expect(client.releases).toEqual([true]);
  });

  it("releases the client without destroying it on the success path", async () => {
    const { db, client } = stubDb();
    const value = await withTransaction(db, async () => "ok");
    expect(value).toBe("ok");
    expect(client.calls).toEqual(["BEGIN", "COMMIT"]);
    expect(client.releases).toHaveLength(1);
    expect(client.releases[0] ?? false).toBe(false);
  });
});
