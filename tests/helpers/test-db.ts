import path from "node:path";
import { getDatabase } from "@netlify/database";
import { NetlifyDB } from "@netlify/database-dev";
import type { Db } from "@/lib/db";

export type TestDb = {
  db: Db;
  reset: () => Promise<void>;
  stop: () => Promise<void>;
};

export async function createTestDb(): Promise<TestDb> {
  const dev = new NetlifyDB();
  const connectionString = await dev.start();
  await dev.applyMigrations(path.resolve("netlify/database/migrations"));
  const db = getDatabase({ connectionString });
  return {
    db,
    reset: async () => {
      await db.pool.query("TRUNCATE assignments, memberships, groups, users CASCADE");
    },
    stop: async () => {
      await db.pool.end();
      await dev.stop();
    },
  };
}
