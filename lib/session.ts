import { withAuth } from "@workos-inc/authkit-nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { pathAndSearch, safeReturnTo, signInPath } from "@/lib/return-to";
import { upsertUser, type User } from "@/lib/users";

export async function requireUser(): Promise<User> {
  const { user } = await withAuth();
  if (!user) {
    // Signed-out visitors go through our own /sign-in (straight to Google, back to this very
    // page afterwards), not WorkOS's hosted sign-in page. This is what an invite link needs.
    const url = (await headers()).get("x-url");
    redirect(signInPath((url && safeReturnTo(pathAndSearch(url))) || "/dashboard"));
  }
  return upsertUser(getDb(), { workosUserId: user.id, email: user.email });
}
