import type { GroupMember, GroupSummary, GroupView } from "@/lib/groups";

// Fixture data for the dev-only design preview. Invented first names, fake
// uuid-shaped ids, and deadlines relative to the render time passed in.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SCENES = [
  "dashboard-empty",
  "dashboard",
  "group-open-admin",
  "group-open-full",
  "group-closed-few",
  "group-closed-admin",
  "group-closed-member",
  "group-raffled-hidden",
  "group-raffled-revealed",
  "create",
  "join",
  "join-prefilled",
] as const;

export type Scene = (typeof SCENES)[number];

export function isScene(value: unknown): value is Scene {
  return typeof value === "string" && (SCENES as readonly string[]).includes(value);
}

const GROUP_ID = "0f6b2c1e-8a3d-4c7b-9e21-5d4a7f3b2c10";

const PEOPLE: GroupMember[] = [
  { id: "a1c4e8f2-1b3d-4e5f-8a9b-0c1d2e3f4a01", displayName: "Marisol", isOrganizer: true },
  { id: "a1c4e8f2-1b3d-4e5f-8a9b-0c1d2e3f4a02", displayName: "Tobias", isOrganizer: false },
  { id: "a1c4e8f2-1b3d-4e5f-8a9b-0c1d2e3f4a03", displayName: "Adaeze", isOrganizer: false },
  { id: "a1c4e8f2-1b3d-4e5f-8a9b-0c1d2e3f4a04", displayName: "Kenji", isOrganizer: false },
  { id: "a1c4e8f2-1b3d-4e5f-8a9b-0c1d2e3f4a05", displayName: "Signe", isOrganizer: false },
  { id: "a1c4e8f2-1b3d-4e5f-8a9b-0c1d2e3f4a06", displayName: "Rafael", isOrganizer: false },
];

function group(
  now: Date,
  options: {
    deadlineOffsetMs: number;
    memberCount: number;
    viewerIndex: number;
    raffled?: boolean;
    match?: GroupView["myMatch"];
  },
): GroupView {
  const members = PEOPLE.slice(0, options.memberCount);
  const viewer = members[options.viewerIndex];
  const deadline = new Date(now.getTime() + options.deadlineOffsetMs);
  return {
    id: GROUP_ID,
    name: "The Lindqvist family exchange",
    inviteCode: "QX7MP2KD",
    signupDeadline: deadline,
    raffledAt: options.raffled ? new Date(deadline.getTime() + HOUR) : null,
    isAdmin: viewer.isOrganizer,
    me: { membershipId: viewer.id, displayName: viewer.displayName },
    members,
    myMatch: options.match ?? null,
  };
}

export function groupFixture(scene: Scene, now: Date): GroupView | null {
  switch (scene) {
    case "group-open-admin":
      return group(now, { deadlineOffsetMs: 3 * DAY, memberCount: 2, viewerIndex: 0 });
    case "group-open-full":
      return group(now, { deadlineOffsetMs: 3 * DAY, memberCount: 6, viewerIndex: 3 });
    case "group-closed-few":
      return group(now, { deadlineOffsetMs: -2 * HOUR, memberCount: 2, viewerIndex: 1 });
    case "group-closed-admin":
      return group(now, { deadlineOffsetMs: -2 * HOUR, memberCount: 5, viewerIndex: 0 });
    case "group-closed-member":
      return group(now, { deadlineOffsetMs: -2 * HOUR, memberCount: 5, viewerIndex: 2 });
    case "group-raffled-hidden":
      return group(now, {
        deadlineOffsetMs: -2 * HOUR,
        memberCount: 5,
        viewerIndex: 2,
        raffled: true,
        match: { revealed: false, receiverName: null },
      });
    case "group-raffled-revealed":
      return group(now, {
        deadlineOffsetMs: -2 * HOUR,
        memberCount: 5,
        viewerIndex: 2,
        raffled: true,
        match: { revealed: true, receiverName: "Signe" },
      });
    default:
      return null;
  }
}

export function dashboardFixture(now: Date): GroupSummary[] {
  return [
    {
      id: "5e2a9d14-7c3b-4f60-b8a1-2d9e4c7f1a01",
      name: "The Lindqvist family exchange",
      signupDeadline: new Date(now.getTime() + 3 * DAY),
      raffledAt: null,
      memberCount: 6,
      isAdmin: true,
    },
    {
      id: "5e2a9d14-7c3b-4f60-b8a1-2d9e4c7f1a02",
      name: "Studio 4B Exchange Gift",
      signupDeadline: new Date(now.getTime() - 2 * HOUR),
      raffledAt: null,
      memberCount: 11,
      isAdmin: false,
    },
    {
      id: "5e2a9d14-7c3b-4f60-b8a1-2d9e4c7f1a03",
      name: "Climbing club",
      signupDeadline: new Date(now.getTime() - 4 * DAY),
      raffledAt: new Date(now.getTime() - 3 * DAY),
      memberCount: 4,
      isAdmin: false,
    },
  ];
}
