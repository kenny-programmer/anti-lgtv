import { withAuth } from "@workos-inc/authkit-nextjs";
import { getDb } from "@/lib/db";
import { upsertUser, type User } from "@/lib/users";

export async function requireUser(): Promise<User> {
  const { user } = await withAuth({ ensureSignedIn: true });
  return upsertUser(getDb(), { workosUserId: user.id, email: user.email });
}
