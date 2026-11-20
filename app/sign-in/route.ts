import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { toGoogleSignInUrl } from "@/lib/sign-in-url";

export const GET = async () => {
  redirect(toGoogleSignInUrl(await getSignInUrl()));
};
