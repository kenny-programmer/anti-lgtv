import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/return-to";
import { toGoogleSignInUrl } from "@/lib/sign-in-url";

export const GET = async (request: Request) => {
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  redirect(toGoogleSignInUrl(await getSignInUrl({ returnTo })));
};
