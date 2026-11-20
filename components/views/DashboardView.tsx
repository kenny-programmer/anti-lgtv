import Link from "next/link";
import { GiftTag } from "@/components/GiftTag";
import { Header } from "@/components/Header";
import { LocalTime } from "@/components/LocalTime";
import { StatusBadge } from "@/components/StatusBadge";
import { HangingTag } from "@/components/HangingTag";
import { buttonPrimary, monoLabel, textLink } from "@/components/ui";
import { getGroupStatus } from "@/lib/group-status";
import type { GroupSummary } from "@/lib/groups";
import { PRODUCT_NAME } from "@/lib/site";

export function DashboardView({ groups, now }: { groups: GroupSummary[]; now: Date }) {
  return (
    <>
      <Header signedIn />
      <main className="page-enter pb-24">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-10 gap-y-6 px-4 pb-10 pt-10 sm:px-6 lg:pt-16">
          <div>
            <p className={`${monoLabel} text-muted`}>{PRODUCT_NAME}</p>
            <h1 className="mt-3 font-serif text-[clamp(2.75rem,6vw,4.5rem)] leading-none tracking-[-0.02em]">
              Your groups
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <Link href="/groups/join" className={textLink}>
              Join with a code
            </Link>
            <Link href="/groups/new" className={buttonPrimary}>
              New group
            </Link>
          </div>
        </div>

        {/* The ribbon the tag hangs from. */}
        <div aria-hidden="true" className="ribbon-edge z-10" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {groups.length === 0 ? (
            <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
              <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
                <HangingTag
                  stringLength={64}
                  tagDrop={110}
                  gain={0.4}
                  breeze={0.4}
                  className="w-[18rem] max-w-full"
                >
                  <GiftTag
                    stringLength={0}
                    footer={
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={monoLabel}>From:</span>
                        <span className="font-serif text-2xl italic">You</span>
                      </div>
                    }
                  >
                    <p className="font-serif text-[2.25rem] leading-[1.05]">Whoever you draw</p>
                  </GiftTag>
                </HangingTag>
              </div>
              <div className="lg:col-span-6 lg:row-start-1 lg:pt-32">
                <h2 className="font-serif text-[2rem] leading-tight tracking-[-0.01em]">
                  You are not in any groups yet
                </h2>
                <p className="mt-4 max-w-[46ch] text-lg text-muted">
                  Create a group and share its invite code, or join one with a code a friend sent
                  you.
                </p>
              </div>
            </div>
          ) : (
            <ul>
              {groups.map((group, index) => (
                <li
                  key={group.id}
                  className="stagger-in border-b border-rule"
                  style={{ "--i": Math.min(index, 7) } as React.CSSProperties}
                >
                  <Link
                    href={`/groups/${group.id}`}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-3 py-7 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:py-8"
                  >
                    <h2 className="font-serif text-[1.75rem] leading-tight tracking-[-0.01em] decoration-1 underline-offset-[6px] group-hover:underline sm:text-[2.25rem]">
                      {group.name}
                    </h2>
                    <span className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">
                      <StatusBadge status={getGroupStatus(group, now)} />
                    </span>
                    <span
                      aria-hidden="true"
                      className="col-start-2 row-start-1 font-serif text-3xl leading-none text-ribbon transition-quick group-hover:translate-x-1 sm:col-start-3"
                    >
                      &rarr;
                    </span>
                    <p className="col-span-full font-mono text-xs uppercase tracking-[0.06em] text-muted">
                      {group.memberCount} {group.memberCount === 1 ? "person" : "people"}
                      {group.isAdmin ? " / you organize this group" : ""}
                      {" / signups close "}
                      <LocalTime iso={group.signupDeadline.toISOString()} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
