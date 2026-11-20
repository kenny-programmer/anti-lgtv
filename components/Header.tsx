import Link from "next/link";
import { signOut } from "@workos-inc/authkit-nextjs";
import { SITE_NAME } from "@/lib/site";

const navBase =
  "inline-flex min-h-11 items-center px-2 text-sm font-medium underline-offset-4 transition-quick hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const navLink = `${navBase} text-surface`;

export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="relative z-10 text-surface">
      <div aria-hidden="true" className="ribbon-edge" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 sm:px-6">
        <Link
          href={signedIn ? "/dashboard" : "/"}
          className="-ml-1 inline-flex min-h-11 items-center px-1 font-serif text-[1.65rem] leading-none tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {SITE_NAME}
        </Link>
        {signedIn ? (
          <nav aria-label="Main" className="-mx-2 flex flex-wrap items-center gap-x-1 sm:ml-0">
            <Link href="/groups/join" className={navLink}>
              Join a group
            </Link>
            <Link href="/groups/new" className={navLink}>
              New group
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button type="submit" className={`${navBase} cursor-pointer text-surface-muted`}>
                Sign out
              </button>
            </form>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
