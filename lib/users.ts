import { query, type Db } from "@/lib/db";

export type User = { id: string; workosUserId: string; email: string };

export async function upsertUser(
  db: Db,
  input: { workosUserId: string; email: string },
): Promise<User> {
  const rows = await query<User>(
    db,
    `INSERT INTO users (workos_user_id, email) VALUES ($1, $2)
     ON CONFLICT (workos_user_id) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, workos_user_id AS "workosUserId", email`,
    [input.workosUserId, input.email],
  );
  return rows[0];
}
