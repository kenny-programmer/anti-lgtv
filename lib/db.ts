import { getDatabase } from "@netlify/database";

export type Db = ReturnType<typeof getDatabase>;
export type Row = Record<string, unknown>;
export type TxQuery = <R = Row>(text: string, params?: unknown[]) => Promise<R[]>;

const globalForDb = globalThis as unknown as { __giftRaffleDb?: Db };

export function getDb(): Db {
  return (globalForDb.__giftRaffleDb ??= getDatabase());
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function query<R = Row>(db: Db, text: string, params: unknown[] = []): Promise<R[]> {
  const result = await db.pool.query(text, params);
  return result.rows as R[];
}

export class Rollback<T> extends Error {
  constructor(readonly value: T) {
    super("rollback");
  }
}

export async function withTransaction<T>(db: Db, fn: (q: TxQuery) => Promise<T>): Promise<T> {
  const client = await db.pool.connect();
  // A client whose ROLLBACK failed may still be inside an aborted transaction, so it must be destroyed rather than returned to the pool.
  let destroyClient = false;
  try {
    await client.query("BEGIN");
    const result = await fn(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      destroyClient = true;
      // A Rollback sentinel promises a clean rollback, so a failed ROLLBACK must surface instead; any other original error stays the primary failure.
      throw error instanceof Rollback ? rollbackError : error;
    }
    if (error instanceof Rollback) return error.value as T;
    throw error;
  } finally {
    client.release(destroyClient);
  }
}
