import Link from "next/link";
import { Header } from "@/components/Header";
import { LocalTime } from "@/components/LocalTime";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonPrimary, buttonSecondary, cardClass } from "@/components/ui";
import { getDb } from "@/lib/db";
import { getGroupStatus } from "@/lib/group-status";
import { listGroupsForUser } from "@/lib/groups";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Your groups" };

export default async function DashboardPage() {
  const user = await requireUser();
  const groups = await listGroupsForUser(getDb(), user.id);
  const now = new Date();

  return (
    <>
      <Header signedIn />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Your groups</h1>
          <div className="flex gap-2">
            <Link href="/groups/join" className={buttonSecondary}>
              Join with a code
            </Link>
            <Link href="/groups/new" className={buttonPrimary}>
              Create a group
            </Link>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className={`${cardClass} mt-8 text-center`}>
            <h2 className="text-lg font-bold">You are not in any groups yet</h2>
            <p className="mt-2 text-muted">
              Create a group and share its invite code, or join one with a code a friend sent you.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className={`${cardClass} block transition hover:border-primary`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">{group.name}</h2>
                    <StatusBadge status={getGroupStatus(group, now)} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {group.memberCount} {group.memberCount === 1 ? "person" : "people"}
                    {group.isAdmin ? " - you organize this group" : ""}
                    {" - signups close "}
                    <LocalTime iso={group.signupDeadline.toISOString()} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
