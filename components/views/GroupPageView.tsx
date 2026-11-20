import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Header } from "@/components/Header";
import { InviteShare } from "@/components/InviteShare";
import { LocalTime } from "@/components/LocalTime";
import { RaffleButton } from "@/components/RaffleButton";
import { RevealCard } from "@/components/RevealCard";
import { ScrollOnArrival } from "@/components/ScrollOnArrival";
import { SignupSettings } from "@/components/SignupSettings";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonSecondary, monoLabel } from "@/components/ui";
import { SiteFooter } from "@/components/SiteFooter";
import { MIN_MEMBERS, getGroupStatus } from "@/lib/group-status";
import type { GroupView } from "@/lib/groups";
import { formatInviteCode } from "@/lib/invite-code";

const panelTitle = "font-serif text-[2rem] leading-tight tracking-[-0.01em]";

export function GroupPageView({ group, now }: { group: GroupView; now: Date }) {
  const status = getGroupStatus(group, now);
  const deadlineIso = group.signupDeadline.toISOString();

  return (
    <>
      <Header signedIn />
      <main className="page-enter pb-24">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 lg:pb-12 lg:pt-16">
          <StatusBadge status={status} />
          <h1 className="mt-5 max-w-[20ch] font-serif text-[clamp(2.75rem,7vw,5.25rem)] leading-[1] tracking-[-0.02em] text-balance">
            {group.name}
          </h1>
          <section
            aria-labelledby="signups-title"
            className="mt-7 flex flex-wrap items-baseline gap-x-4 gap-y-1"
          >
            <h2 id="signups-title" className={`${monoLabel} text-muted`}>
              Signups
            </h2>
            <p className="text-lg">
              {status === "open" ? "Closes " : "Closed "}
              <strong className="font-semibold">
                <LocalTime iso={deadlineIso} />
              </strong>
              {status === "open" ? (
                <span className="text-muted">
                  {" ("}
                  <Countdown to={deadlineIso} />
                  {")"}
                </span>
              ) : null}
            </p>
          </section>
        </div>

        {/* The ribbon the tags hang from. */}
        <div aria-hidden="true" className="ribbon-edge z-10" />

        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-16 px-4 sm:px-6 lg:grid-cols-12">
          {/* The thing to do now: invite, draw or reveal. First in reading order. */}
          <div className="self-start lg:sticky lg:top-24 lg:col-span-5 lg:col-start-8 lg:row-start-1">
            {status === "open" ? (
              <section aria-labelledby="invite-title" className="flex flex-col items-start">
                <h2 id="invite-title" className={panelTitle}>
                  Hand out the code
                </h2>
                <p className="mt-3 max-w-[40ch] text-muted">
                  Share this with the people you want in the exchange. Only people with the code can
                  join.
                </p>
                <InviteShare code={formatInviteCode(group.inviteCode)} />
              </section>
            ) : null}

            {status === "closed" && group.members.length < MIN_MEMBERS ? (
              <section className="pt-12 lg:pt-16">
                <h2 className={panelTitle}>Not enough people joined</h2>
                <p className="mt-3 max-w-[44ch] text-muted">
                  Signups closed with fewer than {MIN_MEMBERS} people, so the raffle cannot run for
                  this group.{" "}
                  {group.isAdmin
                    ? "Set a later close date below to let people join again, or start a new group."
                    : "The organizer can start a new group with a later deadline."}
                </p>
                <Link href="/groups/new" className={`${buttonSecondary} mt-6`}>
                  Start a new group
                </Link>
              </section>
            ) : null}

            {status === "closed" && group.members.length >= MIN_MEMBERS ? (
              <section className="pt-12 lg:pt-16">
                <h2 className={panelTitle}>Signups are closed</h2>
                {group.isAdmin ? (
                  <>
                    <p className="mb-6 mt-3 max-w-[44ch] text-muted">
                      Everyone who signed up is listed here. When you are ready, draw the names.
                      This can only be done once.
                    </p>
                    <RaffleButton groupId={group.id} memberCount={group.members.length} />
                  </>
                ) : (
                  <p className="mt-3 max-w-[44ch] text-muted">
                    Waiting for the organizer to run the raffle.
                  </p>
                )}
              </section>
            ) : null}

            {group.isAdmin && status !== "raffled" ? (
              <SignupSettings
                groupId={group.id}
                open={status === "open"}
                memberCount={group.members.length}
              />
            ) : null}

            {status === "raffled" ? (
              group.myMatch ? (
                <ScrollOnArrival id={group.id}>
                  <RevealCard
                    groupId={group.id}
                    decoys={group.members
                      .filter((member) => member.id !== group.me.membershipId)
                      .map((member) => member.displayName)}
                    revealedName={group.myMatch.receiverName}
                  />
                </ScrollOnArrival>
              ) : (
                <section className="pt-12 lg:pt-16">
                  <h2 className={panelTitle}>The names have been drawn</h2>
                  <p className="mt-3 text-muted">You were not part of this draw.</p>
                </section>
              )
            ) : null}
          </div>

          <section
            aria-labelledby="members-title"
            className="lg:col-span-6 lg:row-start-1 lg:pt-16"
          >
            <h2
              id="members-title"
              className="flex items-baseline justify-between border-b border-ink pb-3"
            >
              <span className={monoLabel}>In the exchange</span>
              <span className="font-mono text-xs text-muted">({group.members.length})</span>
            </h2>
            <ol>
              {group.members.map((member, index) => (
                <li
                  key={member.id}
                  className="stagger-in grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-rule py-3.5"
                  style={{ "--i": Math.min(index, 7) } as React.CSSProperties}
                >
                  <span aria-hidden="true" className="font-mono text-xs text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="break-words font-serif text-2xl leading-snug">
                    {member.displayName}
                  </span>
                  <span className={`${monoLabel} text-muted`}>
                    {member.id === group.me.membershipId ? "you" : ""}
                    {member.id === group.me.membershipId && member.isOrganizer ? " / " : ""}
                    {member.isOrganizer ? "organizer" : ""}
                  </span>
                </li>
              ))}
            </ol>
            {status === "open" && group.members.length < MIN_MEMBERS ? (
              <p className="mt-4 text-sm text-muted">
                You need at least {MIN_MEMBERS} people before the raffle can run.
              </p>
            ) : null}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
