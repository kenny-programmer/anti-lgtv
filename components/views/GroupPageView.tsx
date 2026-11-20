import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Header } from "@/components/Header";
import { InviteShare } from "@/components/InviteShare";
import { LocalTime } from "@/components/LocalTime";
import { RaffleButton } from "@/components/RaffleButton";
import { RevealCard } from "@/components/RevealCard";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonSecondary, cardClass } from "@/components/ui";
import { MIN_MEMBERS, getGroupStatus } from "@/lib/group-status";
import type { GroupView } from "@/lib/groups";
import { formatInviteCode } from "@/lib/invite-code";

export function GroupPageView({ group, now }: { group: GroupView; now: Date }) {
  const status = getGroupStatus(group, now);
  const deadlineIso = group.signupDeadline.toISOString();

  return (
    <>
      <Header signedIn />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">{group.name}</h1>
          <StatusBadge status={status} />
        </div>

        <section className={cardClass}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Signups</h2>
          <p className="mt-2 text-lg">
            {status === "open" ? "Closes " : "Closed "}
            <strong>
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

        {status === "open" ? (
          <section className={cardClass}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Invite code
            </h2>
            <p className="mb-3 mt-1 text-sm text-muted">
              Share this with the people you want in the exchange. Only people with the code can join.
            </p>
            <InviteShare code={formatInviteCode(group.inviteCode)} />
          </section>
        ) : null}

        <section className={cardClass}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            In the exchange ({group.members.length})
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {group.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between py-2">
                <span className="font-medium">{member.displayName}</span>
                <span className="text-xs text-muted">
                  {member.id === group.me.membershipId ? "you" : ""}
                  {member.id === group.me.membershipId && member.isOrganizer ? " - " : ""}
                  {member.isOrganizer ? "organizer" : ""}
                </span>
              </li>
            ))}
          </ul>
          {status === "open" && group.members.length < MIN_MEMBERS ? (
            <p className="mt-3 text-sm text-muted">
              You need at least {MIN_MEMBERS} people before the raffle can run.
            </p>
          ) : null}
        </section>

        {status === "closed" && group.members.length < MIN_MEMBERS ? (
          <section className={cardClass}>
            <h2 className="text-lg font-bold">Not enough people joined</h2>
            <p className="mt-1 text-muted">
              Signups closed with fewer than {MIN_MEMBERS} people, so the raffle cannot run for
              this group.{" "}
              {group.isAdmin
                ? "You can start a new group with a later deadline and invite everyone again."
                : "The organizer can start a new group with a later deadline."}
            </p>
            <Link href="/groups/new" className={`${buttonSecondary} mt-4`}>
              Start a new group
            </Link>
          </section>
        ) : null}

        {status === "closed" && group.members.length >= MIN_MEMBERS ? (
          <section className={cardClass}>
            <h2 className="text-lg font-bold">Signups are closed</h2>
            {group.isAdmin ? (
              <>
                <p className="mb-4 mt-1 text-muted">
                  Everyone who signed up is listed above. When you are ready, draw the names. This
                  can only be done once.
                </p>
                <RaffleButton groupId={group.id} memberCount={group.members.length} />
              </>
            ) : (
              <p className="mt-1 text-muted">Waiting for the organizer to run the raffle.</p>
            )}
          </section>
        ) : null}

        {status === "raffled" ? (
          group.myMatch ? (
            <RevealCard
              groupId={group.id}
              decoys={group.members
                .filter((member) => member.id !== group.me.membershipId)
                .map((member) => member.displayName)}
              revealedName={group.myMatch.receiverName}
            />
          ) : (
            <section className={cardClass}>
              <h2 className="text-lg font-bold">The names have been drawn</h2>
              <p className="mt-1 text-muted">You were not part of this draw.</p>
            </section>
          )
        ) : null}
      </main>
    </>
  );
}
