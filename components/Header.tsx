import Link from "next/link";
import { signOut } from "@workos-inc/authkit-nextjs";
import { SITE_NAME } from "@/lib/site";

export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link
          href={signedIn ? "/dashboard" : "/"}
          className="text-lg font-bold tracking-tight text-primary"
        >
          {SITE_NAME}
        </Link>
        {signedIn ? (
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="-mr-3 rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Sign out
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
