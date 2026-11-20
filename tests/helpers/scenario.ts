import type { Db } from "@/lib/db";
import { createGroup, joinGroup } from "@/lib/groups";
import { upsertUser, type User } from "@/lib/users";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const T0 = new Date("2030-01-01T00:00:00.000Z");
export const DEADLINE = new Date(T0.getTime() + 7 * DAY);
export const AFTER_DEADLINE = new Date(DEADLINE.getTime() + HOUR);

export async function makeUsers(db: Db, count: number): Promise<User[]> {
  const users: User[] = [];
  for (let i = 1; i <= count; i++) {
    users.push(await upsertUser(db, { workosUserId: `workos_${i}`, email: `user${i}@example.com` }));
  }
  return users;
}

export async function makeGroup(
  db: Db,
  memberCount: number,
): Promise<{ users: User[]; groupId: string; inviteCode: string }> {
  const users = await makeUsers(db, memberCount);
  const created = await createGroup(db, {
    userId: users[0].id,
    name: "Test Group",
    displayName: "Member 1",
    signupDeadline: DEADLINE,
    now: T0,
  });
  if (!created.ok) throw new Error(`createGroup failed: ${created.error}`);
  for (let i = 1; i < memberCount; i++) {
    const joined = await joinGroup(db, {
      userId: users[i].id,
      inviteCode: created.group.inviteCode,
      displayName: `Member ${i + 1}`,
      now: new Date(T0.getTime() + HOUR),
    });
    if (!joined.ok) throw new Error(`joinGroup failed: ${joined.error}`);
  }
  return { users, groupId: created.group.id, inviteCode: created.group.inviteCode };
}
