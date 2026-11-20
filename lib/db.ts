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
  try {
    await client.query("BEGIN");
    const result = await fn(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Rollback) return error.value as T;
    throw error;
  } finally {
    client.release();
  }
}
