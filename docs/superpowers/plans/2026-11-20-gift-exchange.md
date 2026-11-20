# Gift Exchange Raffle App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, multi-tenant Secret-Santa web app: Google sign-in via WorkOS, private invite-code groups, a signup deadline, an admin-run one-time raffle, and a per-member animated reveal of who they are gifting.

**Architecture:** Next.js 16 App Router app on Netlify. Business rules live in plain, DB-injected functions under `lib/` (tested against a real Postgres via `@netlify/database-dev`); thin server actions and pages call them. Netlify Database is accessed with `@netlify/database` and plain SQL; the schema is one SQL migration that Netlify applies on deploy. The two raffle guarantees (nobody gets themselves, nobody is picked twice) are enforced by database constraints as well as by the algorithm.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, `@netlify/database`, `@workos-inc/authkit-nextjs`, Vitest, `@netlify/database-dev`, `netlify-cli`.

**Spec:** `docs/superpowers/specs/2026-11-20-gift-exchange-design.md`

## Global Constraints

- Node >= 22.13.0 (the effective floor across `@workos-inc/authkit-nextjs` >=22.11, `@netlify/database` >=22.12 and `netlify-cli` >=22.13); set `engines` in `package.json` and `NODE_VERSION = "22"` in `netlify.toml`.
- Next.js 16 uses `proxy.ts` with `authkitProxy` (not `middleware.ts`).
- Database: `@netlify/database` with plain SQL only. No ORM, no Prisma, no Drizzle. Connection string is `NETLIFY_DB_URL`, injected by `netlify dev` / Netlify; never put it in a file.
- Migrations live only in `netlify/database/migrations/` as `<digits>_<slug>.sql`. Never edit a migration after it has been applied; add a new one.
- All SQL uses `$1, $2...` parameters through `db.pool.query` / `withTransaction`. Never build SQL by string concatenation with user input.
- Every timestamp column is `timestamptz`. Browsers render times in the viewer's local timezone (client components); the server never formats dates for display.
- Invite code: exactly 8 characters from `[A-Z0-9]`, shown as `XXXX-XXXX`, generated with `node:crypto` `randomInt`.
- Minimum group size for a raffle: 3 (`MIN_MEMBERS`).
- Group status is derived (`raffled` if `raffled_at` set; else `closed` if `now >= signup_deadline`; else `open`). It is never stored.
- Never display the user's Google name or email anywhere. Only per-group display names are shown.
- Every server action calls `requireUser()` itself and never trusts form fields for identity or permission.
- No emojis in code or UI copy. In JSX text avoid raw apostrophes (use `&apos;` or rephrase) so `react/no-unescaped-entities` passes.
- Site name constant: `SITE_NAME = "Gift Raffle"` in `lib/site.ts`.
- Path alias `@/*` maps to the project root.

## File Structure

```
package.json, tsconfig.json, next.config.ts, eslint config   (scaffold + edits)
vitest.config.ts
netlify.toml
.env.example
README.md
proxy.ts                                  AuthKit proxy (session refresh)
netlify/database/migrations/20261120000000_init.sql
lib/site.ts                               SITE_NAME
lib/db.ts                                 getDb, query, withTransaction, Rollback, isUuid, Db type
lib/session.ts                            requireUser()
lib/users.ts                              upsertUser
lib/invite-code.ts                        generate / format / normalize
lib/group-status.ts                       MIN_MEMBERS, getGroupStatus
lib/countdown.ts                          formatCountdown
lib/raffle.ts                             drawAssignments (pure)
lib/reveal-sequence.ts                    buildRevealSequence (pure, drives the animation)
lib/groups.ts                             createGroup, joinGroup, getGroupForMember, listGroupsForUser
lib/raffle-service.ts                     runRaffle, revealAssignment
lib/form-state.ts                         FormState type
app/layout.tsx, app/globals.css
app/page.tsx                              public landing page
app/sign-in/route.ts, app/callback/route.ts
app/dashboard/page.tsx
app/groups/new/{page.tsx,actions.ts}
app/groups/join/{page.tsx,actions.ts}
app/groups/[groupId]/{page.tsx,actions.ts}
components/ui.ts                          shared class strings
components/Header.tsx, StatusBadge.tsx, LocalTime.tsx, Countdown.tsx,
components/DeadlineInput.tsx, CreateGroupForm.tsx, JoinGroupForm.tsx,
components/InviteShare.tsx, RaffleButton.tsx, RevealCard.tsx
tests/helpers/{test-db.ts,scenario.ts}
tests/{db,schema,invite-code,group-status,countdown,raffle,reveal-sequence,groups,group-reads,raffle-service}.test.ts
```

---

### Task 1: Scaffold the project and tooling

**Files:**
- Create (via scaffold): `package.json`, `tsconfig.json`, `next.config.ts`, `app/*`, `public/*`, eslint config, `.gitignore`
- Create: `vitest.config.ts`, `netlify.toml`, `.env.example`, `lib/site.ts`
- Modify: `package.json` (scripts, engines), `.gitignore`

**Interfaces:**
- Produces: `npm test` (vitest), `npm run typecheck`, `npm run dev` (netlify dev), `SITE_NAME` from `@/lib/site`.

- [ ] **Step 1: Scaffold Next.js in the existing directory**

The directory already contains `.git` and `docs/`; neither conflicts with the template.

```bash
cd /Users/sky/Documents/anti-lgtv
npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --disable-git --yes
```

Expected: completes with "Success!". Then run `npx next --version` and confirm it prints `16.x`. If it prints a different major, stop and tell the user (this plan assumes `proxy.ts`).

- [ ] **Step 2: Install dependencies**

```bash
npm install @netlify/database @workos-inc/authkit-nextjs
npm install -D vitest @netlify/database-dev netlify-cli
```

Expected: no errors. `@workos-inc/node` is installed automatically as a peer dependency; confirm with `npm ls @workos-inc/node`. Also run `npx netlify --version` and confirm the CLI is 26.0.0 or newer (required for the `netlify database` commands).

- [ ] **Step 3: Edit `package.json` scripts and engines**

Set the `scripts` block to (keep any other scripts the scaffold added):

```json
"scripts": {
  "dev": "netlify dev",
  "dev:next": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
},
"engines": { "node": ">=22.13.0" }
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 5: Create `netlify.toml`**

```toml
[build.environment]
  NODE_VERSION = "22"
```

- [ ] **Step 6: Create `.env.example`**

```bash
# WorkOS: https://dashboard.workos.com (a Staging environment is fine for development)
WORKOS_CLIENT_ID=client_replace_me
WORKOS_API_KEY=sk_test_replace_me
# At least 32 characters. Generate with: openssl rand -base64 32
WORKOS_COOKIE_PASSWORD=replace_me_with_at_least_32_characters
# Must exactly match a Redirect URI configured in the WorkOS dashboard.
# Local development runs behind `netlify dev` on port 8888.
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:8888/callback
```

- [ ] **Step 7: Edit `.gitignore`**

The scaffold ignores `.env*`. Append these lines so the example file is tracked and the Netlify folder is ignored:

```
!.env.example
.netlify
```

- [ ] **Step 8: Create `lib/site.ts`**

```ts
export const SITE_NAME = "Gift Raffle";
```

- [ ] **Step 9: Verify the toolchain**

Run:
```bash
npm run typecheck && npm run lint && npx vitest run --passWithNoTests
```
Expected: typecheck and lint pass; vitest reports "No test files found" and exits 0 because of `--passWithNoTests`.

- [ ] **Step 10: Commit**

```bash
git add -A
git status --short
```
Confirm no `.env.local` or `node_modules` appears in the list, then:
```bash
git commit -m "chore: scaffold Next.js 16 app with Vitest and Netlify tooling"
```

---

### Task 2: Database layer and schema migration

**Files:**
- Create: `lib/db.ts`
- Create: `netlify/database/migrations/20261120000000_init.sql`
- Create: `tests/helpers/test-db.ts`
- Test: `tests/db.test.ts`, `tests/schema.test.ts`

**Interfaces:**
- Produces (`lib/db.ts`):
  - `type Db = ReturnType<typeof getDatabase>`
  - `type Row = Record<string, unknown>`
  - `type TxQuery = <R = Row>(text: string, params?: unknown[]) => Promise<R[]>`
  - `getDb(): Db` (cached on `globalThis`)
  - `isUuid(value: string): boolean`
  - `query<R = Row>(db: Db, text: string, params?: unknown[]): Promise<R[]>`
  - `class Rollback<T> extends Error { constructor(readonly value: T) }`
  - `withTransaction<T>(db: Db, fn: (q: TxQuery) => Promise<T>): Promise<T>` - commits on success, rolls back and rethrows on error, and if `fn` throws `Rollback`, rolls back and returns `error.value`.
- Produces (`tests/helpers/test-db.ts`): `createTestDb(): Promise<TestDb>` where `TestDb = { db: Db; reset(): Promise<void>; stop(): Promise<void> }`.

- [ ] **Step 1: Write `tests/helpers/test-db.ts`**

```ts
import path from "node:path";
import { getDatabase } from "@netlify/database";
import { NetlifyDB } from "@netlify/database-dev";
import type { Db } from "@/lib/db";

export type TestDb = {
  db: Db;
  reset: () => Promise<void>;
  stop: () => Promise<void>;
};

export async function createTestDb(): Promise<TestDb> {
  const dev = new NetlifyDB();
  const connectionString = await dev.start();
  await dev.applyMigrations(path.resolve("netlify/database/migrations"));
  const db = getDatabase({ connectionString });
  return {
    db,
    reset: async () => {
      await db.pool.query("TRUNCATE assignments, memberships, groups, users CASCADE");
    },
    stop: async () => {
      await db.pool.end();
      await dev.stop();
    },
  };
}
```

- [ ] **Step 2: Write the failing tests `tests/db.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Rollback, isUuid, query, withTransaction } from "@/lib/db";
import { createTestDb, type TestDb } from "./helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

const insertUser = (q: <R>(text: string, params?: unknown[]) => Promise<R[]>) =>
  q("INSERT INTO users (workos_user_id, email) VALUES ($1, $2)", ["w1", "a@example.com"]);
const countUsers = async () =>
  (await query<{ n: number }>(t.db, "SELECT count(*)::int AS n FROM users"))[0].n;

describe("withTransaction", () => {
  it("commits when the callback resolves and returns its value", async () => {
    const value = await withTransaction(t.db, async (q) => {
      await insertUser(q);
      return "done";
    });
    expect(value).toBe("done");
    expect(await countUsers()).toBe(1);
  });

  it("rolls back and rethrows when the callback throws", async () => {
    await expect(
      withTransaction(t.db, async (q) => {
        await insertUser(q);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await countUsers()).toBe(0);
  });

  it("rolls back and returns the value carried by Rollback", async () => {
    const value = await withTransaction<string>(t.db, async (q) => {
      await insertUser(q);
      throw new Rollback("aborted");
    });
    expect(value).toBe("aborted");
    expect(await countUsers()).toBe(0);
  });
});

describe("isUuid", () => {
  it("accepts uuids and rejects everything else", () => {
    expect(isUuid("d2f2cfc1-9075-409e-9e8c-8867509453ff")).toBe(true);
    expect(isUuid("D2F2CFC1-9075-409E-9E8C-8867509453FF")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("d2f2cfc1-9075-409e-9e8c-8867509453ff'; DROP TABLE users;--")).toBe(false);
  });
});
```

- [ ] **Step 3: Write the failing tests `tests/schema.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

async function seed() {
  const userIds: string[] = [];
  for (const n of [1, 2, 3, 4]) {
    const { rows } = await t.db.pool.query(
      "INSERT INTO users (workos_user_id, email) VALUES ($1, $2) RETURNING id",
      [`w${n}`, `u${n}@example.com`],
    );
    userIds.push(rows[0].id);
  }
  const { rows: groups } = await t.db.pool.query(
    "INSERT INTO groups (name, invite_code, signup_deadline, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
    ["Group", "ABCD1234", new Date("2030-01-01T00:00:00Z"), userIds[0]],
  );
  const groupId: string = groups[0].id;
  const memberIds: string[] = [];
  for (const [i, userId] of userIds.slice(0, 3).entries()) {
    const { rows } = await t.db.pool.query(
      "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3) RETURNING id",
      [groupId, userId, `Member ${i + 1}`],
    );
    memberIds.push(rows[0].id);
  }
  return { groupId, userIds, memberIds };
}

const assign = (groupId: string, giver: string, receiver: string) =>
  t.db.pool.query(
    "INSERT INTO assignments (group_id, giver_membership_id, receiver_membership_id) VALUES ($1, $2, $3)",
    [groupId, giver, receiver],
  );

describe("schema constraints", () => {
  it("rejects invite codes that are not 8 characters of A-Z0-9", async () => {
    const { userIds } = await seed();
    for (const bad of ["abcd1234", "ABCD123", "ABCD-1234", "ABCD12345"]) {
      await expect(
        t.db.pool.query(
          "INSERT INTO groups (name, invite_code, signup_deadline, created_by) VALUES ($1, $2, $3, $4)",
          ["G", bad, new Date("2030-01-01T00:00:00Z"), userIds[0]],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }
  });

  it("rejects a duplicate invite code", async () => {
    const { userIds } = await seed();
    await expect(
      t.db.pool.query(
        "INSERT INTO groups (name, invite_code, signup_deadline, created_by) VALUES ($1, $2, $3, $4)",
        ["G2", "ABCD1234", new Date("2030-01-01T00:00:00Z"), userIds[0]],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects the same display name in one group, ignoring case", async () => {
    const { groupId, userIds } = await seed();
    await expect(
      t.db.pool.query(
        "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3)",
        [groupId, userIds[3], "member 1"],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects a user joining the same group twice", async () => {
    const { groupId, userIds } = await seed();
    await expect(
      t.db.pool.query(
        "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3)",
        [groupId, userIds[0], "Someone Else"],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects assigning a member to themselves", async () => {
    const { groupId, memberIds } = await seed();
    await expect(assign(groupId, memberIds[0], memberIds[0])).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects two givers sharing the same receiver", async () => {
    const { groupId, memberIds } = await seed();
    await assign(groupId, memberIds[0], memberIds[1]);
    await expect(assign(groupId, memberIds[2], memberIds[1])).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects one giver having two receivers", async () => {
    const { groupId, memberIds } = await seed();
    await assign(groupId, memberIds[0], memberIds[1]);
    await expect(assign(groupId, memberIds[0], memberIds[2])).rejects.toMatchObject({ code: "23505" });
  });

  it("accepts a full cycle of assignments", async () => {
    const { groupId, memberIds } = await seed();
    await assign(groupId, memberIds[0], memberIds[1]);
    await assign(groupId, memberIds[1], memberIds[2]);
    await assign(groupId, memberIds[2], memberIds[0]);
    const { rows } = await t.db.pool.query("SELECT count(*)::int AS n FROM assignments");
    expect(rows[0].n).toBe(3);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/db.test.ts tests/schema.test.ts`
Expected: FAIL - `tests/db.test.ts` cannot resolve `@/lib/db`; `tests/schema.test.ts` fails with `relation "users" does not exist` (or the helper cannot find the migrations directory).

- [ ] **Step 5: Create `lib/db.ts`**

```ts
import { getDatabase } from "@netlify/database";

export type Db = ReturnType<typeof getDatabase>;
export type Row = Record<string, unknown>;
export type TxQuery = <R = Row>(text: string, params?: unknown[]) => Promise<R[]>;

const globalForDb = globalThis as unknown as { __giftRaffleDb?: Db };

export function getDb(): Db {
  return (globalForDb.__giftRaffleDb ??= getDatabase());
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function query<R = Row>(db: Db, text: string, params: unknown[] = []): Promise<R[]> {
  const result = await db.pool.query(text, params);
  return result.rows as R[];
}

export class Rollback<T> extends Error {
  constructor(readonly value: T) {
    super("rollback");
  }
}

export async function withTransaction<T>(db: Db, fn: (q: TxQuery) => Promise<T>): Promise<T> {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Rollback) return error.value as T;
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 6: Create the migration `netlify/database/migrations/20261120000000_init.sql`**

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workos_user_id text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-Z0-9]{8}$'),
  signup_deadline timestamptz NOT NULL,
  raffled_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE UNIQUE INDEX memberships_group_display_name_key
  ON memberships (group_id, lower(display_name));

CREATE INDEX memberships_user_id_idx ON memberships (user_id);

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  giver_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  receiver_membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  revealed_at timestamptz,
  UNIQUE (group_id, giver_membership_id),
  UNIQUE (group_id, receiver_membership_id),
  CHECK (giver_membership_id <> receiver_membership_id)
);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/db.test.ts tests/schema.test.ts`
Expected: PASS (3 + 1 tests in `db.test.ts`; 8 in `schema.test.ts`).

- [ ] **Step 8: Typecheck and commit**

```bash
npm run typecheck
git add lib/db.ts netlify/database/migrations tests/helpers/test-db.ts tests/db.test.ts tests/schema.test.ts
git commit -m "feat: add database layer and initial schema with raffle constraints"
```

---

### Task 3: Small pure helpers (invite code, group status, countdown)

**Files:**
- Create: `lib/invite-code.ts`, `lib/group-status.ts`, `lib/countdown.ts`
- Test: `tests/invite-code.test.ts`, `tests/group-status.test.ts`, `tests/countdown.test.ts`

**Interfaces:**
- Produces:
  - `generateInviteCode(): string` (8 chars `[A-Z0-9]`)
  - `formatInviteCode(code: string): string` (`"ABCD1234"` -> `"ABCD-1234"`)
  - `normalizeInviteCode(input: string): string | null` (uppercases, strips spaces and dashes, returns `null` unless exactly 8 `[A-Z0-9]`)
  - `MIN_MEMBERS = 3`, `type GroupStatus = "open" | "closed" | "raffled"`
  - `getGroupStatus(group: { signupDeadline: Date; raffledAt: Date | null }, now: Date): GroupStatus`
  - `formatCountdown(ms: number): string`

- [ ] **Step 1: Write the failing tests**

`tests/invite-code.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatInviteCode, generateInviteCode, normalizeInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("always returns 8 characters from A-Z and 0-9", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateInviteCode()).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it("does not repeat across many calls", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));
    expect(codes.size).toBe(1000);
  });
});

describe("formatInviteCode", () => {
  it("splits the code into two groups of four", () => {
    expect(formatInviteCode("ABCD1234")).toBe("ABCD-1234");
    expect(formatInviteCode("1A2B3C4D")).toBe("1A2B-3C4D");
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["ABCD1234", "ABCD1234"],
    ["ABCD-1234", "ABCD1234"],
    ["abcd-1234", "ABCD1234"],
    ["  ab cd-12 34  ", "ABCD1234"],
    ["1a2b-3c4d", "1A2B3C4D"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });

  it.each(["", "ABCD-123", "ABCD-12345", "ABC!-1234", "ABCD_1234", "nope"])(
    "rejects %j",
    (input) => {
      expect(normalizeInviteCode(input)).toBeNull();
    },
  );
});
```

`tests/group-status.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MIN_MEMBERS, getGroupStatus } from "@/lib/group-status";

const deadline = new Date("2030-01-10T12:00:00Z");

describe("getGroupStatus", () => {
  it("is open before the deadline", () => {
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt: null }, new Date("2030-01-10T11:59:59Z"))).toBe("open");
  });

  it("is closed at exactly the deadline and after it", () => {
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt: null }, deadline)).toBe("closed");
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt: null }, new Date("2030-02-01T00:00:00Z"))).toBe("closed");
  });

  it("is raffled once raffledAt is set, regardless of the clock", () => {
    const raffledAt = new Date("2030-01-11T00:00:00Z");
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt }, new Date("2030-01-01T00:00:00Z"))).toBe("raffled");
    expect(getGroupStatus({ signupDeadline: deadline, raffledAt }, new Date("2031-01-01T00:00:00Z"))).toBe("raffled");
  });

  it("requires at least 3 members for a raffle", () => {
    expect(MIN_MEMBERS).toBe(3);
  });
});
```

`tests/countdown.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatCountdown } from "@/lib/countdown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatCountdown", () => {
  it("says closed at or below zero", () => {
    expect(formatCountdown(0)).toBe("closed");
    expect(formatCountdown(-5_000)).toBe("closed");
  });

  it("handles under a minute", () => {
    expect(formatCountdown(30_000)).toBe("less than a minute left");
  });

  it("shows minutes, hours and days", () => {
    expect(formatCountdown(5 * MIN)).toBe("5m left");
    expect(formatCountdown(HOUR)).toBe("1h 0m left");
    expect(formatCountdown(HOUR + 5 * MIN)).toBe("1h 5m left");
    expect(formatCountdown(2 * DAY + 3 * HOUR + 59 * MIN)).toBe("2d 3h left");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/invite-code.test.ts tests/group-status.test.ts tests/countdown.test.ts`
Expected: FAIL - cannot resolve `@/lib/invite-code`, `@/lib/group-status`, `@/lib/countdown`.

- [ ] **Step 3: Implement `lib/invite-code.ts`**

```ts
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 8;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}
```

- [ ] **Step 4: Implement `lib/group-status.ts`**

```ts
export const MIN_MEMBERS = 3;

export type GroupStatus = "open" | "closed" | "raffled";

export function getGroupStatus(
  group: { signupDeadline: Date; raffledAt: Date | null },
  now: Date,
): GroupStatus {
  if (group.raffledAt) return "raffled";
  return now.getTime() >= group.signupDeadline.getTime() ? "closed" : "open";
}
```

- [ ] **Step 5: Implement `lib/countdown.ts`**

```ts
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "closed";
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "less than a minute left";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/invite-code.test.ts tests/group-status.test.ts tests/countdown.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/invite-code.ts lib/group-status.ts lib/countdown.ts tests/invite-code.test.ts tests/group-status.test.ts tests/countdown.test.ts
git commit -m "feat: add invite code, group status and countdown helpers"
```

---

### Task 4: Raffle algorithm and reveal animation sequence

**Files:**
- Create: `lib/raffle.ts`, `lib/reveal-sequence.ts`
- Test: `tests/raffle.test.ts`, `tests/reveal-sequence.test.ts`

**Interfaces:**
- Produces:
  - `type Pairing = { giver: string; receiver: string }`
  - `drawAssignments(ids: string[], random?: (maxExclusive: number) => number): Pairing[]` - requires >= 2 unique ids; returns one pairing per id; every id appears exactly once as giver and once as receiver; nobody is paired with themselves.
  - `type RevealFrame = { name: string; delayMs: number }`
  - `buildRevealSequence(decoys: string[], finalName: string, options?: { frames?: number; random?: () => number }): RevealFrame[]` - default 26 frames; each frame is shown, then waits `delayMs`; delays never decrease; the last frame is `finalName`; decoy frames never equal `finalName`.

- [ ] **Step 1: Write the failing tests**

`tests/raffle.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { drawAssignments } from "@/lib/raffle";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

describe("drawAssignments", () => {
  it.each([2, 3, 4, 5, 8, 12])(
    "gives everyone exactly one match and nobody themselves (n=%i)",
    (n) => {
      for (let run = 0; run < 300; run++) {
        const members = ids(n);
        const pairs = drawAssignments(members);
        expect(pairs).toHaveLength(n);
        expect(new Set(pairs.map((p) => p.giver))).toEqual(new Set(members));
        expect(new Set(pairs.map((p) => p.receiver))).toEqual(new Set(members));
        expect(pairs.every((p) => p.giver !== p.receiver)).toBe(true);
      }
    },
  );

  it("does not mutate its input", () => {
    const members = ids(5);
    const copy = [...members];
    drawAssignments(members);
    expect(members).toEqual(copy);
  });

  it("throws with fewer than two participants", () => {
    expect(() => drawAssignments([])).toThrow();
    expect(() => drawAssignments(["only"])).toThrow();
  });

  it("throws on duplicate ids", () => {
    expect(() => drawAssignments(["a", "b", "a"])).toThrow();
  });

  it("produces many different matchings across runs", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(JSON.stringify(drawAssignments(ids(6))));
    expect(seen.size).toBeGreaterThan(10);
  });

  it("uses the injected random source", () => {
    expect(drawAssignments(ids(4), () => 0)).toEqual([
      { giver: "id-1", receiver: "id-2" },
      { giver: "id-2", receiver: "id-3" },
      { giver: "id-3", receiver: "id-0" },
      { giver: "id-0", receiver: "id-1" },
    ]);
  });
});
```

`tests/reveal-sequence.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildRevealSequence } from "@/lib/reveal-sequence";

const decoys = ["Ann", "Bob", "Cy", "Dee"];

describe("buildRevealSequence", () => {
  it("ends on the final name and never shows it earlier", () => {
    const sequence = buildRevealSequence(decoys, "Eve");
    expect(sequence).toHaveLength(26);
    expect(sequence.at(-1)?.name).toBe("Eve");
    expect(sequence.slice(0, -1).every((frame) => frame.name !== "Eve")).toBe(true);
  });

  it("removes the final name from the decoys", () => {
    const sequence = buildRevealSequence(["Eve", "Ann", "Bob"], "Eve");
    expect(sequence.slice(0, -1).some((frame) => frame.name === "Eve")).toBe(false);
  });

  it("slows down as it goes", () => {
    const delays = buildRevealSequence(decoys, "Eve").slice(0, -1).map((frame) => frame.delayMs);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
    expect(delays.at(-1)).toBeGreaterThan(delays[0]);
  });

  it("never repeats the same name back to back when there are two or more decoys", () => {
    for (let run = 0; run < 100; run++) {
      const names = buildRevealSequence(decoys, "Eve").map((frame) => frame.name);
      for (let i = 1; i < names.length; i++) expect(names[i]).not.toBe(names[i - 1]);
    }
  });

  it("copes with no decoys", () => {
    const sequence = buildRevealSequence([], "Eve", { frames: 5 });
    expect(sequence.map((frame) => frame.name)).toEqual(Array(5).fill("Eve"));
  });

  it("is deterministic for an injected random source", () => {
    const a = buildRevealSequence(decoys, "Eve", { random: () => 0 });
    const b = buildRevealSequence(decoys, "Eve", { random: () => 0 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/raffle.test.ts tests/reveal-sequence.test.ts`
Expected: FAIL - cannot resolve `@/lib/raffle` and `@/lib/reveal-sequence`.

- [ ] **Step 3: Implement `lib/raffle.ts`**

```ts
import { randomInt } from "node:crypto";

export type Pairing = { giver: string; receiver: string };

export function drawAssignments(
  ids: string[],
  random: (maxExclusive: number) => number = (max) => randomInt(max),
): Pairing[] {
  if (ids.length < 2) throw new Error("A raffle needs at least 2 participants");
  if (new Set(ids).size !== ids.length) throw new Error("Participant ids must be unique");

  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((giver, i) => ({ giver, receiver: order[(i + 1) % order.length] }));
}
```

- [ ] **Step 4: Implement `lib/reveal-sequence.ts`**

```ts
export type RevealFrame = { name: string; delayMs: number };

export function buildRevealSequence(
  decoys: string[],
  finalName: string,
  options: { frames?: number; random?: () => number } = {},
): RevealFrame[] {
  const frames = options.frames ?? 26;
  const random = options.random ?? Math.random;
  const pool = [...new Set(decoys)].filter((name) => name !== finalName);

  const sequence: RevealFrame[] = [];
  let previous: string | null = null;
  for (let i = 0; i < frames - 1; i++) {
    const progress = i / (frames - 1);
    const delayMs = Math.round(45 + progress * progress * 330);
    const candidates = pool.length > 1 ? pool.filter((name) => name !== previous) : pool;
    const name =
      candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)] : finalName;
    sequence.push({ name, delayMs });
    previous = name;
  }
  sequence.push({ name: finalName, delayMs: 0 });
  return sequence;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/raffle.test.ts tests/reveal-sequence.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/raffle.ts lib/reveal-sequence.ts tests/raffle.test.ts tests/reveal-sequence.test.ts
git commit -m "feat: add raffle derangement and reveal animation sequence"
```

---

### Task 5: Users, create group, join group

**Files:**
- Create: `lib/users.ts`, `lib/groups.ts`
- Create: `tests/helpers/scenario.ts`
- Test: `tests/groups.test.ts`

**Interfaces:**
- Consumes: `query`, `withTransaction`, `type Db` from `@/lib/db`; `generateInviteCode`, `normalizeInviteCode` from `@/lib/invite-code`; `getGroupStatus` from `@/lib/group-status`.
- Produces (`lib/users.ts`):
  - `type User = { id: string; workosUserId: string; email: string }`
  - `upsertUser(db: Db, input: { workosUserId: string; email: string }): Promise<User>`
- Produces (`lib/groups.ts`):
  - `MAX_GROUP_NAME = 80`, `MAX_DISPLAY_NAME = 40`
  - `cleanName(value: string, max: number): string | null` (collapses whitespace, trims, requires 1..max chars)
  - `type Group = { id: string; name: string; inviteCode: string; signupDeadline: Date; raffledAt: Date | null; createdBy: string }`
  - `createGroup(db, input: { userId: string; name: string; displayName: string; signupDeadline: Date; now?: Date }): Promise<{ ok: true; group: Group } | { ok: false; error: "invalid_name" | "invalid_display_name" | "deadline_in_past" }>` - creator also becomes a member.
  - `joinGroup(db, input: { userId: string; inviteCode: string; displayName: string; now?: Date }): Promise<{ ok: true; groupId: string } | { ok: false; error: "invalid_display_name" | "unknown_code" | "closed" | "name_taken" } | { ok: false; error: "already_member"; groupId: string }>`
- Produces (`tests/helpers/scenario.ts`): `HOUR`, `DAY`, `T0` (2030-01-01T00:00:00Z), `DEADLINE` (T0 + 7 days), `AFTER_DEADLINE` (DEADLINE + 1 hour), `makeUsers(db, count): Promise<User[]>`, `makeGroup(db, memberCount): Promise<{ users: User[]; groupId: string; inviteCode: string }>` - user 0 creates "Test Group" as "Member 1" at `T0` with deadline `DEADLINE`; users 1.. join at `T0 + 1h` as "Member 2", "Member 3", ...

- [ ] **Step 1: Write `tests/helpers/scenario.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing tests `tests/groups.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { createGroup, joinGroup } from "@/lib/groups";
import { formatInviteCode } from "@/lib/invite-code";
import { upsertUser } from "@/lib/users";
import { DEADLINE, HOUR, T0, makeUsers } from "./helpers/scenario";
import { createTestDb, type TestDb } from "./helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

const count = async (table: "groups" | "memberships") =>
  (await query<{ n: number }>(t.db, `SELECT count(*)::int AS n FROM ${table}`))[0].n;

describe("upsertUser", () => {
  it("returns the same user for the same WorkOS id and refreshes the email", async () => {
    const a = await upsertUser(t.db, { workosUserId: "w1", email: "old@example.com" });
    const b = await upsertUser(t.db, { workosUserId: "w1", email: "new@example.com" });
    expect(b.id).toBe(a.id);
    expect(b.workosUserId).toBe("w1");
    expect(b.email).toBe("new@example.com");
    expect(await query(t.db, "SELECT 1 FROM users")).toHaveLength(1);
  });
});

type Overrides = { name?: string; displayName?: string; signupDeadline?: Date };

describe("createGroup", () => {
  it("creates a group with a cleaned name and an 8-character invite code", async () => {
    const [owner] = await makeUsers(t.db, 1);
    const result = await createGroup(t.db, {
      userId: owner.id,
      name: "  Office   Santa ",
      displayName: "Ann",
      signupDeadline: DEADLINE,
      now: T0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.name).toBe("Office Santa");
    expect(result.group.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(result.group.createdBy).toBe(owner.id);
    expect(result.group.raffledAt).toBeNull();
    expect(result.group.signupDeadline.getTime()).toBe(DEADLINE.getTime());
  });

  it("makes the creator a member under the chosen display name", async () => {
    const [owner] = await makeUsers(t.db, 1);
    await createGroup(t.db, { userId: owner.id, name: "G", displayName: " Ann  B ", signupDeadline: DEADLINE, now: T0 });
    const rows = await query<{ display_name: string; user_id: string }>(
      t.db,
      "SELECT display_name, user_id FROM memberships",
    );
    expect(rows).toEqual([{ display_name: "Ann B", user_id: owner.id }]);
  });

  const invalidCases: [string, Overrides, string][] = [
    ["a blank group name", { name: "   " }, "invalid_name"],
    ["a too-long group name", { name: "x".repeat(81) }, "invalid_name"],
    ["a blank display name", { displayName: " " }, "invalid_display_name"],
    ["a too-long display name", { displayName: "x".repeat(41) }, "invalid_display_name"],
    ["a deadline in the past", { signupDeadline: new Date(T0.getTime() - HOUR) }, "deadline_in_past"],
    ["a deadline exactly now", { signupDeadline: T0 }, "deadline_in_past"],
    ["an invalid deadline", { signupDeadline: new Date("nope") }, "deadline_in_past"],
  ];

  it.each(invalidCases)("rejects %s and writes nothing", async (_label, overrides, error) => {
    const [owner] = await makeUsers(t.db, 1);
    const result = await createGroup(t.db, {
      userId: owner.id,
      name: "Group",
      displayName: "Ann",
      signupDeadline: DEADLINE,
      now: T0,
      ...overrides,
    });
    expect(result).toEqual({ ok: false, error });
    expect(await count("groups")).toBe(0);
    expect(await count("memberships")).toBe(0);
  });

  it("gives every group its own invite code", async () => {
    const [owner] = await makeUsers(t.db, 1);
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await createGroup(t.db, {
        userId: owner.id,
        name: `Group ${i}`,
        displayName: `Ann ${i}`,
        signupDeadline: DEADLINE,
        now: T0,
      });
      if (result.ok) codes.add(result.group.inviteCode);
    }
    expect(codes.size).toBe(20);
  });
});

describe("joinGroup", () => {
  async function setup() {
    const [owner, guest] = await makeUsers(t.db, 2);
    const created = await createGroup(t.db, {
      userId: owner.id,
      name: "Family",
      displayName: "Ann",
      signupDeadline: DEADLINE,
      now: T0,
    });
    if (!created.ok) throw new Error("setup failed");
    return { owner, guest, group: created.group };
  }

  it("joins with a valid code regardless of case, dashes and spaces", async () => {
    const { guest, group } = await setup();
    const typed = ` ${formatInviteCode(group.inviteCode).toLowerCase()} `;
    const result = await joinGroup(t.db, { userId: guest.id, inviteCode: typed, displayName: " Bob ", now: T0 });
    expect(result).toEqual({ ok: true, groupId: group.id });
    const rows = await query<{ display_name: string }>(
      t.db,
      "SELECT display_name FROM memberships WHERE user_id = $1",
      [guest.id],
    );
    expect(rows).toEqual([{ display_name: "Bob" }]);
  });

  it("rejects an unknown code and a malformed code", async () => {
    const { guest } = await setup();
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: "ZZZZ-9999", displayName: "Bob", now: T0 })).toEqual({ ok: false, error: "unknown_code" });
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: "nope", displayName: "Bob", now: T0 })).toEqual({ ok: false, error: "unknown_code" });
    expect(await count("memberships")).toBe(1);
  });

  it("rejects a blank display name", async () => {
    const { guest, group } = await setup();
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "  ", now: T0 })).toEqual({ ok: false, error: "invalid_display_name" });
  });

  it("tells an existing member they are already in, with the group id", async () => {
    const { owner, group } = await setup();
    expect(await joinGroup(t.db, { userId: owner.id, inviteCode: group.inviteCode, displayName: "Another", now: T0 })).toEqual({ ok: false, error: "already_member", groupId: group.id });
  });

  it("rejects a display name already used in the group, ignoring case", async () => {
    const { guest, group } = await setup();
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "ANN", now: T0 })).toEqual({ ok: false, error: "name_taken" });
    expect(await count("memberships")).toBe(1);
  });

  it("closes signups at the deadline", async () => {
    const { guest, group } = await setup();
    const justBefore = new Date(DEADLINE.getTime() - 1000);
    expect(await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "Bob", now: DEADLINE })).toEqual({ ok: false, error: "closed" });
    expect((await joinGroup(t.db, { userId: guest.id, inviteCode: group.inviteCode, displayName: "Bob", now: justBefore })).ok).toBe(true);
  });

  it("lets one person be in several groups under different names", async () => {
    const [owner1, owner2, guest] = await makeUsers(t.db, 3);
    const g1 = await createGroup(t.db, { userId: owner1.id, name: "Friends", displayName: "Ann", signupDeadline: DEADLINE, now: T0 });
    const g2 = await createGroup(t.db, { userId: owner2.id, name: "Work", displayName: "Cy", signupDeadline: DEADLINE, now: T0 });
    if (!g1.ok || !g2.ok) throw new Error("setup failed");
    expect((await joinGroup(t.db, { userId: guest.id, inviteCode: g1.group.inviteCode, displayName: "Bobby", now: T0 })).ok).toBe(true);
    expect((await joinGroup(t.db, { userId: guest.id, inviteCode: g2.group.inviteCode, displayName: "Robert", now: T0 })).ok).toBe(true);
    const rows = await query<{ display_name: string }>(
      t.db,
      "SELECT display_name FROM memberships WHERE user_id = $1 ORDER BY display_name",
      [guest.id],
    );
    expect(rows.map((r) => r.display_name)).toEqual(["Bobby", "Robert"]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/groups.test.ts`
Expected: FAIL - cannot resolve `@/lib/groups` / `@/lib/users`.

- [ ] **Step 4: Implement `lib/users.ts`**

```ts
import { query, type Db } from "@/lib/db";

export type User = { id: string; workosUserId: string; email: string };

export async function upsertUser(
  db: Db,
  input: { workosUserId: string; email: string },
): Promise<User> {
  const rows = await query<User>(
    db,
    `INSERT INTO users (workos_user_id, email) VALUES ($1, $2)
     ON CONFLICT (workos_user_id) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, workos_user_id AS "workosUserId", email`,
    [input.workosUserId, input.email],
  );
  return rows[0];
}
```

- [ ] **Step 5: Implement `lib/groups.ts` (create and join)**

```ts
import { query, withTransaction, type Db } from "@/lib/db";
import { getGroupStatus } from "@/lib/group-status";
import { generateInviteCode, normalizeInviteCode } from "@/lib/invite-code";

export const MAX_GROUP_NAME = 80;
export const MAX_DISPLAY_NAME = 40;

export function cleanName(value: string, max: number): string | null {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length >= 1 && cleaned.length <= max ? cleaned : null;
}

export type Group = {
  id: string;
  name: string;
  inviteCode: string;
  signupDeadline: Date;
  raffledAt: Date | null;
  createdBy: string;
};

export type CreateGroupResult =
  | { ok: true; group: Group }
  | { ok: false; error: "invalid_name" | "invalid_display_name" | "deadline_in_past" };

export async function createGroup(
  db: Db,
  input: { userId: string; name: string; displayName: string; signupDeadline: Date; now?: Date },
): Promise<CreateGroupResult> {
  const name = cleanName(input.name, MAX_GROUP_NAME);
  if (!name) return { ok: false, error: "invalid_name" };
  const displayName = cleanName(input.displayName, MAX_DISPLAY_NAME);
  if (!displayName) return { ok: false, error: "invalid_display_name" };
  const now = input.now ?? new Date();
  const deadlineMs = input.signupDeadline.getTime();
  if (Number.isNaN(deadlineMs) || deadlineMs <= now.getTime()) {
    return { ok: false, error: "deadline_in_past" };
  }

  const group = await withTransaction(db, async (q) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await q<Group>(
        `INSERT INTO groups (name, invite_code, signup_deadline, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (invite_code) DO NOTHING
         RETURNING id, name, invite_code AS "inviteCode", signup_deadline AS "signupDeadline",
                   raffled_at AS "raffledAt", created_by AS "createdBy"`,
        [name, generateInviteCode(), input.signupDeadline, input.userId],
      );
      if (rows[0]) {
        await q(
          "INSERT INTO memberships (group_id, user_id, display_name) VALUES ($1, $2, $3)",
          [rows[0].id, input.userId, displayName],
        );
        return rows[0];
      }
    }
    throw new Error("Could not allocate a unique invite code");
  });
  return { ok: true, group };
}

export type JoinGroupResult =
  | { ok: true; groupId: string }
  | { ok: false; error: "invalid_display_name" | "unknown_code" | "closed" | "name_taken" }
  | { ok: false; error: "already_member"; groupId: string };

export async function joinGroup(
  db: Db,
  input: { userId: string; inviteCode: string; displayName: string; now?: Date },
): Promise<JoinGroupResult> {
  const displayName = cleanName(input.displayName, MAX_DISPLAY_NAME);
  if (!displayName) return { ok: false, error: "invalid_display_name" };
  const code = normalizeInviteCode(input.inviteCode);
  if (!code) return { ok: false, error: "unknown_code" };
  const now = input.now ?? new Date();

  const inserted = await query<{ groupId: string }>(
    db,
    `INSERT INTO memberships (group_id, user_id, display_name)
     SELECT g.id, $2, $3
     FROM groups g
     WHERE g.invite_code = $1 AND g.raffled_at IS NULL AND g.signup_deadline > $4
     FOR SHARE OF g
     ON CONFLICT DO NOTHING
     RETURNING group_id AS "groupId"`,
    [code, input.userId, displayName, now],
  );
  if (inserted[0]) return { ok: true, groupId: inserted[0].groupId };

  const [group] = await query<{ id: string; signupDeadline: Date; raffledAt: Date | null }>(
    db,
    `SELECT id, signup_deadline AS "signupDeadline", raffled_at AS "raffledAt"
     FROM groups WHERE invite_code = $1`,
    [code],
  );
  if (!group) return { ok: false, error: "unknown_code" };

  const existing = await query(
    db,
    "SELECT 1 FROM memberships WHERE group_id = $1 AND user_id = $2",
    [group.id, input.userId],
  );
  if (existing.length > 0) return { ok: false, error: "already_member", groupId: group.id };
  if (getGroupStatus(group, now) !== "open") return { ok: false, error: "closed" };
  return { ok: false, error: "name_taken" };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/groups.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add lib/users.ts lib/groups.ts tests/helpers/scenario.ts tests/groups.test.ts
git commit -m "feat: add user upsert, group creation and joining by invite code"
```

---

### Task 6: Group read queries

**Files:**
- Modify: `lib/groups.ts` (append)
- Test: `tests/group-reads.test.ts`

**Interfaces:**
- Consumes: `isUuid`, `query` from `@/lib/db`; `makeGroup`, `makeUsers` etc. from `tests/helpers/scenario.ts`.
- Produces (appended to `lib/groups.ts`):
  - `type GroupMember = { id: string; displayName: string; isOrganizer: boolean }`
  - `type GroupView = { id: string; name: string; inviteCode: string; signupDeadline: Date; raffledAt: Date | null; isAdmin: boolean; me: { membershipId: string; displayName: string }; members: GroupMember[]; myMatch: { revealed: boolean; receiverName: string | null } | null }` - `receiverName` is `null` until the member has revealed; `myMatch` is `null` before the raffle.
  - `getGroupForMember(db: Db, input: { groupId: string; userId: string }): Promise<GroupView | null>` - `null` for non-members, unknown ids and malformed ids.
  - `type GroupSummary = { id: string; name: string; signupDeadline: Date; raffledAt: Date | null; memberCount: number; isAdmin: boolean }`
  - `listGroupsForUser(db: Db, userId: string): Promise<GroupSummary[]>`

- [ ] **Step 1: Write the failing tests `tests/group-reads.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGroup, getGroupForMember, joinGroup, listGroupsForUser } from "@/lib/groups";
import { DEADLINE, T0, makeGroup, makeUsers } from "./helpers/scenario";
import { createTestDb, type TestDb } from "./helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

describe("getGroupForMember", () => {
  it("returns the full view for the organizer", async () => {
    const { users, groupId, inviteCode } = await makeGroup(t.db, 3);
    const view = await getGroupForMember(t.db, { groupId, userId: users[0].id });
    expect(view).not.toBeNull();
    expect(view).toMatchObject({
      id: groupId,
      name: "Test Group",
      inviteCode,
      isAdmin: true,
      raffledAt: null,
      myMatch: null,
      me: { displayName: "Member 1" },
    });
    expect(view!.signupDeadline.getTime()).toBe(DEADLINE.getTime());
    expect(view!.members.map((m) => m.displayName).sort()).toEqual(["Member 1", "Member 2", "Member 3"]);
    expect(view!.members.filter((m) => m.isOrganizer).map((m) => m.displayName)).toEqual(["Member 1"]);
    expect(view!.members.find((m) => m.id === view!.me.membershipId)?.displayName).toBe("Member 1");
  });

  it("marks other members as not admin and uses their own display name", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const view = await getGroupForMember(t.db, { groupId, userId: users[2].id });
    expect(view).toMatchObject({ isAdmin: false, me: { displayName: "Member 3" } });
  });

  it("returns null for a user who is not in the group", async () => {
    const { groupId } = await makeGroup(t.db, 3);
    const [, , , outsider] = await makeUsers(t.db, 4);
    expect(await getGroupForMember(t.db, { groupId, userId: outsider.id })).toBeNull();
  });

  it("returns null for unknown and malformed group ids", async () => {
    const { users } = await makeGroup(t.db, 3);
    expect(await getGroupForMember(t.db, { groupId: "00000000-0000-4000-8000-000000000000", userId: users[0].id })).toBeNull();
    expect(await getGroupForMember(t.db, { groupId: "not-a-uuid", userId: users[0].id })).toBeNull();
    expect(await getGroupForMember(t.db, { groupId: "1; DROP TABLE groups", userId: users[0].id })).toBeNull();
  });
});

describe("listGroupsForUser", () => {
  it("lists only the user's own groups with member counts and admin flags", async () => {
    const [ann, bob, cy] = await makeUsers(t.db, 3);
    const mine = await createGroup(t.db, { userId: ann.id, name: "Mine", displayName: "Ann", signupDeadline: DEADLINE, now: T0 });
    const theirs = await createGroup(t.db, { userId: bob.id, name: "Theirs", displayName: "Bob", signupDeadline: DEADLINE, now: T0 });
    const other = await createGroup(t.db, { userId: cy.id, name: "Unrelated", displayName: "Cy", signupDeadline: DEADLINE, now: T0 });
    if (!mine.ok || !theirs.ok || !other.ok) throw new Error("setup failed");
    await joinGroup(t.db, { userId: cy.id, inviteCode: mine.group.inviteCode, displayName: "Cyrus", now: T0 });
    await joinGroup(t.db, { userId: ann.id, inviteCode: theirs.group.inviteCode, displayName: "Annie", now: T0 });

    const groups = await listGroupsForUser(t.db, ann.id);
    const byName = Object.fromEntries(groups.map((g) => [g.name, g]));
    expect(Object.keys(byName).sort()).toEqual(["Mine", "Theirs"]);
    expect(byName.Mine).toMatchObject({ memberCount: 2, isAdmin: true, raffledAt: null });
    expect(byName.Theirs).toMatchObject({ memberCount: 2, isAdmin: false });
    expect(byName.Mine.signupDeadline.getTime()).toBe(DEADLINE.getTime());
  });

  it("returns an empty list for a user with no groups", async () => {
    const [ann] = await makeUsers(t.db, 1);
    expect(await listGroupsForUser(t.db, ann.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/group-reads.test.ts`
Expected: FAIL - `getGroupForMember is not a function` / not exported.

- [ ] **Step 3: Update the import line at the top of `lib/groups.ts`**

Replace
```ts
import { query, withTransaction, type Db } from "@/lib/db";
```
with
```ts
import { isUuid, query, withTransaction, type Db } from "@/lib/db";
```

- [ ] **Step 4: Append to `lib/groups.ts`**

```ts
export type GroupMember = { id: string; displayName: string; isOrganizer: boolean };

export type GroupView = {
  id: string;
  name: string;
  inviteCode: string;
  signupDeadline: Date;
  raffledAt: Date | null;
  isAdmin: boolean;
  me: { membershipId: string; displayName: string };
  members: GroupMember[];
  myMatch: { revealed: boolean; receiverName: string | null } | null;
};

export async function getGroupForMember(
  db: Db,
  input: { groupId: string; userId: string },
): Promise<GroupView | null> {
  if (!isUuid(input.groupId)) return null;

  const [row] = await query<{
    id: string;
    name: string;
    inviteCode: string;
    signupDeadline: Date;
    raffledAt: Date | null;
    createdBy: string;
    membershipId: string;
    displayName: string;
  }>(
    db,
    `SELECT g.id, g.name, g.invite_code AS "inviteCode", g.signup_deadline AS "signupDeadline",
            g.raffled_at AS "raffledAt", g.created_by AS "createdBy",
            m.id AS "membershipId", m.display_name AS "displayName"
     FROM groups g
     JOIN memberships m ON m.group_id = g.id AND m.user_id = $2
     WHERE g.id = $1`,
    [input.groupId, input.userId],
  );
  if (!row) return null;

  const members = await query<GroupMember>(
    db,
    `SELECT m.id, m.display_name AS "displayName", (m.user_id = g.created_by) AS "isOrganizer"
     FROM memberships m
     JOIN groups g ON g.id = m.group_id
     WHERE m.group_id = $1
     ORDER BY m.joined_at, m.id`,
    [input.groupId],
  );

  let myMatch: GroupView["myMatch"] = null;
  if (row.raffledAt) {
    const [assignment] = await query<{ revealedAt: Date | null; receiverName: string }>(
      db,
      `SELECT a.revealed_at AS "revealedAt", r.display_name AS "receiverName"
       FROM assignments a
       JOIN memberships r ON r.id = a.receiver_membership_id
       WHERE a.group_id = $1 AND a.giver_membership_id = $2`,
      [input.groupId, row.membershipId],
    );
    if (assignment) {
      const revealed = assignment.revealedAt !== null;
      myMatch = { revealed, receiverName: revealed ? assignment.receiverName : null };
    }
  }

  return {
    id: row.id,
    name: row.name,
    inviteCode: row.inviteCode,
    signupDeadline: row.signupDeadline,
    raffledAt: row.raffledAt,
    isAdmin: row.createdBy === input.userId,
    me: { membershipId: row.membershipId, displayName: row.displayName },
    members,
    myMatch,
  };
}

export type GroupSummary = {
  id: string;
  name: string;
  signupDeadline: Date;
  raffledAt: Date | null;
  memberCount: number;
  isAdmin: boolean;
};

export async function listGroupsForUser(db: Db, userId: string): Promise<GroupSummary[]> {
  return query<GroupSummary>(
    db,
    `SELECT g.id, g.name, g.signup_deadline AS "signupDeadline", g.raffled_at AS "raffledAt",
            (SELECT count(*)::int FROM memberships c WHERE c.group_id = g.id) AS "memberCount",
            (g.created_by = $1) AS "isAdmin"
     FROM groups g
     JOIN memberships m ON m.group_id = g.id AND m.user_id = $1
     ORDER BY g.created_at DESC, g.id`,
    [userId],
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/group-reads.test.ts tests/groups.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run typecheck
git add lib/groups.ts tests/group-reads.test.ts
git commit -m "feat: add member-scoped group and group-list queries"
```

---

### Task 7: Raffle service (run the raffle, reveal a match)

**Files:**
- Create: `lib/raffle-service.ts`
- Test: `tests/raffle-service.test.ts`

**Interfaces:**
- Consumes: `isUuid`, `query`, `Rollback`, `withTransaction`, `type Db` from `@/lib/db`; `MIN_MEMBERS`, `getGroupStatus` from `@/lib/group-status`; `drawAssignments` from `@/lib/raffle`; `getGroupForMember`, `joinGroup` from `@/lib/groups`.
- Produces:
  - `runRaffle(db: Db, input: { groupId: string; userId: string; now?: Date }): Promise<{ ok: true; assignmentCount: number } | { ok: false; error: "not_found" | "not_admin" | "too_early" | "already_raffled" | "not_enough_members" }>`
  - `revealAssignment(db: Db, input: { groupId: string; userId: string; now?: Date }): Promise<{ ok: true; receiverName: string } | { ok: false; error: "no_assignment" }>` - returns only the caller's own receiver; sets `revealed_at` the first time and leaves it unchanged afterwards.

- [ ] **Step 1: Write the failing tests `tests/raffle-service.test.ts`**

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { getGroupForMember, joinGroup } from "@/lib/groups";
import { revealAssignment, runRaffle } from "@/lib/raffle-service";
import { AFTER_DEADLINE, HOUR, T0, makeGroup, makeUsers } from "./helpers/scenario";
import { createTestDb, type TestDb } from "./helpers/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.stop();
});
beforeEach(async () => {
  await t.reset();
});

const assignmentRows = () =>
  query<{ giver: string; receiver: string }>(
    t.db,
    `SELECT gm.display_name AS giver, rm.display_name AS receiver
     FROM assignments a
     JOIN memberships gm ON gm.id = a.giver_membership_id
     JOIN memberships rm ON rm.id = a.receiver_membership_id
     ORDER BY gm.display_name`,
  );

const raffledAt = async (groupId: string) =>
  (await query<{ raffled_at: Date | null }>(t.db, "SELECT raffled_at FROM groups WHERE id = $1", [groupId]))[0].raffled_at;

describe("runRaffle", () => {
  it("assigns every member exactly one other member, and nobody is picked twice", async () => {
    const { users, groupId } = await makeGroup(t.db, 6);
    const result = await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(result).toEqual({ ok: true, assignmentCount: 6 });

    const rows = await assignmentRows();
    expect(rows).toHaveLength(6);
    const names = ["Member 1", "Member 2", "Member 3", "Member 4", "Member 5", "Member 6"];
    expect(rows.map((r) => r.giver).sort()).toEqual(names);
    expect(rows.map((r) => r.receiver).sort()).toEqual(names);
    expect(rows.every((r) => r.giver !== r.receiver)).toBe(true);
    expect(await raffledAt(groupId)).not.toBeNull();
  });

  it("works for the minimum group of three", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    expect(await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE })).toEqual({ ok: true, assignmentCount: 3 });
  });

  it("refuses before the deadline and writes nothing", async () => {
    const { users, groupId } = await makeGroup(t.db, 4);
    const result = await runRaffle(t.db, { groupId, userId: users[0].id, now: new Date(T0.getTime() + 2 * HOUR) });
    expect(result).toEqual({ ok: false, error: "too_early" });
    expect(await assignmentRows()).toHaveLength(0);
    expect(await raffledAt(groupId)).toBeNull();
  });

  it("refuses anyone who is not the organizer", async () => {
    const { users, groupId } = await makeGroup(t.db, 4);
    expect(await runRaffle(t.db, { groupId, userId: users[1].id, now: AFTER_DEADLINE })).toEqual({ ok: false, error: "not_admin" });
    expect(await assignmentRows()).toHaveLength(0);
  });

  it("treats outsiders and bad ids as not found", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const [, , , outsider] = await makeUsers(t.db, 4);
    expect(await runRaffle(t.db, { groupId, userId: outsider.id, now: AFTER_DEADLINE })).toEqual({ ok: false, error: "not_found" });
    expect(await runRaffle(t.db, { groupId: "nope", userId: users[0].id, now: AFTER_DEADLINE })).toEqual({ ok: false, error: "not_found" });
  });

  it("refuses fewer than three members and rolls the claim back", async () => {
    const { users, groupId } = await makeGroup(t.db, 2);
    const result = await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(result).toEqual({ ok: false, error: "not_enough_members" });
    expect(await assignmentRows()).toHaveLength(0);
    expect(await raffledAt(groupId)).toBeNull();
  });

  it("refuses a second raffle and leaves the first draw untouched", async () => {
    const { users, groupId } = await makeGroup(t.db, 5);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    const before = await assignmentRows();
    const again = await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(again).toEqual({ ok: false, error: "already_raffled" });
    expect(await assignmentRows()).toEqual(before);
  });

  it("blocks new members once the raffle has run", async () => {
    const { users, groupId, inviteCode } = await makeGroup(t.db, 3);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    const [, , , late] = await makeUsers(t.db, 4);
    const result = await joinGroup(t.db, { userId: late.id, inviteCode, displayName: "Late", now: new Date(T0.getTime() + 2 * HOUR) });
    expect(result).toEqual({ ok: false, error: "closed" });
  });
});

describe("revealAssignment", () => {
  it("gives each member their own match, and the matches form a bijection", async () => {
    const { users, groupId } = await makeGroup(t.db, 5);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });

    const revealed: string[] = [];
    for (const [i, user] of users.entries()) {
      const result = await revealAssignment(t.db, { groupId, userId: user.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.receiverName).not.toBe(`Member ${i + 1}`);
      revealed.push(result.receiverName);
    }
    expect([...revealed].sort()).toEqual(["Member 1", "Member 2", "Member 3", "Member 4", "Member 5"]);

    const rows = await assignmentRows();
    for (const [i] of users.entries()) {
      expect(rows.find((r) => r.giver === `Member ${i + 1}`)?.receiver).toBe(revealed[i]);
    }
  });

  it("is stable on repeat and keeps the first reveal time", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    const first = await revealAssignment(t.db, { groupId, userId: users[1].id, now: new Date("2031-01-01T00:00:00Z") });
    const second = await revealAssignment(t.db, { groupId, userId: users[1].id, now: new Date("2032-01-01T00:00:00Z") });
    expect(second).toEqual(first);
    const [row] = await query<{ revealed_at: Date }>(
      t.db,
      `SELECT a.revealed_at FROM assignments a JOIN memberships m ON m.id = a.giver_membership_id WHERE m.user_id = $1`,
      [users[1].id],
    );
    expect(row.revealed_at.toISOString()).toBe("2031-01-01T00:00:00.000Z");
  });

  it("has nothing to reveal before the raffle, for outsiders, or for bad ids", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    const [, , , outsider] = await makeUsers(t.db, 4);
    expect(await revealAssignment(t.db, { groupId, userId: users[0].id })).toEqual({ ok: false, error: "no_assignment" });
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });
    expect(await revealAssignment(t.db, { groupId, userId: outsider.id })).toEqual({ ok: false, error: "no_assignment" });
    expect(await revealAssignment(t.db, { groupId: "nope", userId: users[0].id })).toEqual({ ok: false, error: "no_assignment" });
  });

  it("keeps the match hidden from the group view until it is revealed", async () => {
    const { users, groupId } = await makeGroup(t.db, 3);
    await runRaffle(t.db, { groupId, userId: users[0].id, now: AFTER_DEADLINE });

    const before = await getGroupForMember(t.db, { groupId, userId: users[1].id });
    expect(before?.myMatch).toEqual({ revealed: false, receiverName: null });

    const result = await revealAssignment(t.db, { groupId, userId: users[1].id });
    if (!result.ok) throw new Error("reveal failed");
    const after = await getGroupForMember(t.db, { groupId, userId: users[1].id });
    expect(after?.myMatch).toEqual({ revealed: true, receiverName: result.receiverName });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/raffle-service.test.ts`
Expected: FAIL - cannot resolve `@/lib/raffle-service`.

- [ ] **Step 3: Implement `lib/raffle-service.ts`**

```ts
import { isUuid, query, Rollback, withTransaction, type Db } from "@/lib/db";
import { MIN_MEMBERS, getGroupStatus } from "@/lib/group-status";
import { drawAssignments } from "@/lib/raffle";

export type RunRaffleResult =
  | { ok: true; assignmentCount: number }
  | {
      ok: false;
      error: "not_found" | "not_admin" | "too_early" | "already_raffled" | "not_enough_members";
    };

export async function runRaffle(
  db: Db,
  input: { groupId: string; userId: string; now?: Date },
): Promise<RunRaffleResult> {
  const now = input.now ?? new Date();
  if (!isUuid(input.groupId)) return { ok: false, error: "not_found" };

  const [group] = await query<{ createdBy: string; signupDeadline: Date; raffledAt: Date | null }>(
    db,
    `SELECT g.created_by AS "createdBy", g.signup_deadline AS "signupDeadline",
            g.raffled_at AS "raffledAt"
     FROM groups g
     JOIN memberships m ON m.group_id = g.id AND m.user_id = $2
     WHERE g.id = $1`,
    [input.groupId, input.userId],
  );
  if (!group) return { ok: false, error: "not_found" };
  if (group.createdBy !== input.userId) return { ok: false, error: "not_admin" };

  const status = getGroupStatus(group, now);
  if (status === "raffled") return { ok: false, error: "already_raffled" };
  if (status === "open") return { ok: false, error: "too_early" };

  return withTransaction<RunRaffleResult>(db, async (q) => {
    const claimed = await q(
      `UPDATE groups SET raffled_at = $2
       WHERE id = $1 AND raffled_at IS NULL AND signup_deadline <= $2
       RETURNING id`,
      [input.groupId, now],
    );
    if (claimed.length === 0) {
      throw new Rollback<RunRaffleResult>({ ok: false, error: "already_raffled" });
    }

    const members = await q<{ id: string }>(
      "SELECT id FROM memberships WHERE group_id = $1 ORDER BY id",
      [input.groupId],
    );
    if (members.length < MIN_MEMBERS) {
      throw new Rollback<RunRaffleResult>({ ok: false, error: "not_enough_members" });
    }

    const pairs = drawAssignments(members.map((member) => member.id));
    await q(
      `INSERT INTO assignments (group_id, giver_membership_id, receiver_membership_id)
       SELECT $1, t.giver, t.receiver
       FROM unnest($2::uuid[], $3::uuid[]) AS t(giver, receiver)`,
      [input.groupId, pairs.map((pair) => pair.giver), pairs.map((pair) => pair.receiver)],
    );
    return { ok: true, assignmentCount: pairs.length };
  });
}

export type RevealResult =
  | { ok: true; receiverName: string }
  | { ok: false; error: "no_assignment" };

export async function revealAssignment(
  db: Db,
  input: { groupId: string; userId: string; now?: Date },
): Promise<RevealResult> {
  if (!isUuid(input.groupId)) return { ok: false, error: "no_assignment" };

  const rows = await query<{ receiverName: string }>(
    db,
    `UPDATE assignments a SET revealed_at = COALESCE(a.revealed_at, $3)
     FROM memberships giver, memberships receiver
     WHERE a.group_id = $1
       AND giver.id = a.giver_membership_id AND giver.user_id = $2
       AND receiver.id = a.receiver_membership_id
     RETURNING receiver.display_name AS "receiverName"`,
    [input.groupId, input.userId, input.now ?? new Date()],
  );
  if (!rows[0]) return { ok: false, error: "no_assignment" };
  return { ok: true, receiverName: rows[0].receiverName };
}
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS for every test file (db, schema, invite-code, group-status, countdown, raffle, reveal-sequence, groups, group-reads, raffle-service).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/raffle-service.ts tests/raffle-service.test.ts
git commit -m "feat: add raffle service with atomic claim and per-member reveal"
```

---

### Task 8: WorkOS authentication wiring

**Files:**
- Create: `proxy.ts`, `app/sign-in/route.ts`, `app/callback/route.ts`, `lib/session.ts`, `lib/form-state.ts`
- Modify: `.gitignore` check only (already ignores `.env.local`)

**Interfaces:**
- Consumes: `upsertUser`, `type User` from `@/lib/users`; `getDb` from `@/lib/db`.
- Produces:
  - `requireUser(): Promise<User>` (`@/lib/session`) - redirects to sign-in if signed out; otherwise returns the app `User` row (created/updated from the WorkOS identity).
  - `type FormState = { error: string | null }` (`@/lib/form-state`)
  - Routes: `GET /sign-in` (redirects to WorkOS), `GET /callback` (completes login, returns to the original page or `/dashboard`).

**USER ACTION REQUIRED (credentials; the agent cannot do these).** Ask the user to do the following and paste back nothing secret into chat; they put values into `.env.local` themselves. Everything else in this task and Tasks 9-13 can be built and verified without it; only live sign-in testing needs it.

1. Create a WorkOS account at https://dashboard.workos.com and use the **Staging** environment.
2. Authentication settings: enable **Google OAuth** (Staging uses WorkOS demo credentials); disable the other sign-in methods (Email + Password, Magic Auth, etc.) so Google is the only option.
3. Applications -> your app -> Redirects: add Redirect URI `http://localhost:8888/callback`, set Initiate login URI `http://localhost:8888/sign-in`, set default Sign-out redirect `http://localhost:8888/`.
4. Copy the Client ID and API key into `.env.local` (copy `.env.example` to `.env.local` first) and generate the cookie password with `openssl rand -base64 32`.

- [ ] **Step 1: Create `proxy.ts`**

```ts
import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Create `app/sign-in/route.ts`**

```ts
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export const GET = async () => {
  redirect(await getSignInUrl());
};
```

- [ ] **Step 3: Create `app/callback/route.ts`**

```ts
import { handleAuth } from "@workos-inc/authkit-nextjs";

export const GET = handleAuth({ returnPathname: "/dashboard" });
```

- [ ] **Step 4: Create `lib/session.ts`**

```ts
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getDb } from "@/lib/db";
import { upsertUser, type User } from "@/lib/users";

export async function requireUser(): Promise<User> {
  const { user } = await withAuth({ ensureSignedIn: true });
  return upsertUser(getDb(), { workosUserId: user.id, email: user.email });
}
```

- [ ] **Step 5: Create `lib/form-state.ts`**

```ts
export type FormState = { error: string | null };
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If `withAuth`'s return type makes `user` possibly null, the `ensureSignedIn: true` overload is not being picked up; confirm the installed `@workos-inc/authkit-nextjs` is 4.x and fix the call to match its type definitions in `node_modules/@workos-inc/authkit-nextjs/dist/esm/types/`.

- [ ] **Step 7: Commit**

```bash
git add proxy.ts app/sign-in app/callback lib/session.ts lib/form-state.ts
git commit -m "feat: wire WorkOS AuthKit sign-in, callback, proxy and requireUser"
```

---

### Task 9: Theme, layout, shared UI pieces and landing page

**Files:**
- Modify: `app/globals.css` (replace), `app/layout.tsx` (replace), `app/page.tsx` (replace)
- Create: `components/ui.ts`, `components/Header.tsx`, `components/StatusBadge.tsx`, `components/LocalTime.tsx`, `components/Countdown.tsx`

**Interfaces:**
- Consumes: `SITE_NAME` from `@/lib/site`; `GroupStatus` from `@/lib/group-status`; `formatCountdown` from `@/lib/countdown`.
- Produces:
  - `buttonPrimary`, `buttonSecondary`, `inputClass`, `cardClass` (string constants, `@/components/ui`)
  - `<Header signedIn: boolean />` (server component; sign-out form when signed in)
  - `<StatusBadge status: GroupStatus />`
  - `<LocalTime iso: string />` (client; renders the viewer's local date/time after hydration)
  - `<Countdown to: string />` (client; `to` is an ISO string; re-renders every 30 seconds)

- [ ] **Step 1: Replace `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: #fbf7f0;
  --foreground: #1d2b25;
  --muted: #5d6b64;
  --card: #ffffff;
  --border: #e7dfd0;
  --primary: #1f5c45;
  --primary-hover: #17493a;
  --accent: #b83a2a;
  --accent-soft: #fbe9e4;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}

@keyframes pop {
  0% {
    transform: scale(0.85);
    opacity: 0;
  }
  60% {
    transform: scale(1.06);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}

.animate-pop {
  animation: pop 450ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}

@media (prefers-reduced-motion: reduce) {
  .animate-pop {
    animation: none;
  }
}
```

- [ ] **Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description:
    "Run a private, fair, secret gift exchange with friends or family. Invite-only groups, a one-click raffle, and nobody ever gets themselves.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Create `components/ui.ts`**

```ts
export const buttonPrimary =
  "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base text-foreground placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

export const cardClass = "rounded-2xl border border-border bg-card p-6 shadow-sm";
```

- [ ] **Step 4: Create `components/Header.tsx`**

```tsx
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
            <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create `components/StatusBadge.tsx`**

```tsx
import type { GroupStatus } from "@/lib/group-status";

const STYLES: Record<GroupStatus, { label: string; className: string }> = {
  open: { label: "Open for signups", className: "bg-primary/10 text-primary" },
  closed: { label: "Signups closed", className: "bg-accent-soft text-accent" },
  raffled: { label: "Names drawn", className: "bg-foreground/10 text-foreground" },
};

export function StatusBadge({ status }: { status: GroupStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 6: Create `components/LocalTime.tsx`**

```tsx
"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function format(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(subscribe, () => format(iso), () => "");
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
```

- [ ] **Step 7: Create `components/Countdown.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/countdown";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  if (now === null) return null;
  return <span>{formatCountdown(new Date(to).getTime() - now)}</span>;
}
```

- [ ] **Step 8: Replace `app/page.tsx` (public landing page)**

```tsx
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { Header } from "@/components/Header";
import { buttonPrimary, cardClass } from "@/components/ui";
import { SITE_NAME } from "@/lib/site";

const STEPS = [
  {
    title: "Create a group",
    body: "Sign in with Google, name your group and set the last day people can sign up.",
  },
  {
    title: "Share the invite code",
    body: "Friends join with a short 8-character code and choose the name the group will see. Google names are never shown.",
  },
  {
    title: "Raffle and reveal",
    body: "After the deadline the organizer runs the raffle. Everyone taps a button to find out who they are gifting.",
  },
];

export default async function LandingPage() {
  const { user } = await withAuth();
  if (user) redirect("/dashboard");

  return (
    <>
      <Header signedIn={false} />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Draw names. Keep the secret. Make gifting fun.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            {SITE_NAME} runs a private gift exchange for your friends or family. One click decides
            who gives to whom. Nobody gets themselves, and nobody is picked twice.
          </p>
          <div className="mt-8">
            <a href="/sign-in" className={`${buttonPrimary} px-6 py-3 text-base`}>
              Sign in with Google
            </a>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className={cardClass}>
              <p className="text-sm font-semibold text-accent">Step {index + 1}</p>
              <h2 className="mt-1 text-lg font-bold">{step.title}</h2>
              <p className="mt-2 text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </section>

        <p className="mt-12 text-center text-sm text-muted">
          Groups are private. Only people with your invite code can see or join them.
        </p>
      </main>
    </>
  );
}
```

- [ ] **Step 9: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

Smoke-check the public page with throwaway env values (no real WorkOS account needed for a signed-out page):
```bash
WORKOS_CLIENT_ID=client_dummy WORKOS_COOKIE_PASSWORD=dummy_cookie_password_of_32_chars_min NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback npx next dev -p 3000
```
In another terminal: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/` -> expect `200`, and `curl -s http://localhost:3000/ | grep -c "Sign in with Google"` -> expect `1`. Stop the dev server afterwards.

- [ ] **Step 10: Commit**

```bash
git add app/globals.css app/layout.tsx app/page.tsx components/ui.ts components/Header.tsx components/StatusBadge.tsx components/LocalTime.tsx components/Countdown.tsx
git commit -m "feat: add theme, shared components and public landing page"
```

---

### Task 10: Dashboard and create-group flow

**Files:**
- Create: `app/dashboard/page.tsx`, `app/groups/new/page.tsx`, `app/groups/new/actions.ts`
- Create: `components/DeadlineInput.tsx`, `components/CreateGroupForm.tsx`

**Interfaces:**
- Consumes: `requireUser` (`@/lib/session`), `getDb`, `listGroupsForUser`, `createGroup`, `getGroupStatus`, `FormState`, `Header`, `StatusBadge`, `LocalTime`, UI class constants.
- Produces:
  - `createGroupAction(prev: FormState, formData: FormData): Promise<FormState>` (`app/groups/new/actions.ts`) - reads `name`, `displayName`, `signupDeadline` (ISO string); on success redirects to `/groups/<id>`.
  - `<DeadlineInput id: string name: string />` renders a `datetime-local` input (with the given `id`, for its label) and a hidden input with the given `name` holding the ISO (UTC) string.
  - `<CreateGroupForm />`

- [ ] **Step 1: Create `app/groups/new/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { createGroup } from "@/lib/groups";
import { requireUser } from "@/lib/session";

const MESSAGES = {
  invalid_name: "Give your group a name (up to 80 characters).",
  invalid_display_name: "Enter the name your group will see (up to 40 characters).",
  deadline_in_past: "Pick a signup deadline in the future.",
} as const;

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await createGroup(getDb(), {
    userId: user.id,
    name: String(formData.get("name") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    signupDeadline: new Date(String(formData.get("signupDeadline") ?? "")),
  });
  if (!result.ok) return { error: MESSAGES[result.error] };
  redirect(`/groups/${result.group.id}`);
}
```

- [ ] **Step 2: Create `components/DeadlineInput.tsx`**

```tsx
"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export function DeadlineInput({ id, name }: { id: string; name: string }) {
  const [local, setLocal] = useState("");
  const parsed = local ? new Date(local) : null;
  const iso = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "";

  return (
    <>
      <input
        id={id}
        type="datetime-local"
        required
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        className={inputClass}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
```

- [ ] **Step 3: Create `components/CreateGroupForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { createGroupAction } from "@/app/groups/new/actions";
import { DeadlineInput } from "@/components/DeadlineInput";
import { buttonPrimary, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold">
          Group name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="Office gift exchange"
          className={`${inputClass} mt-1`}
        />
      </div>
      <div>
        <label htmlFor="displayName" className="block text-sm font-semibold">
          Your name in this group
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={40}
          placeholder="What should everyone call you?"
          className={`${inputClass} mt-1`}
        />
        <p className="mt-1 text-sm text-muted">
          This is what the group sees. We never show your Google name.
        </p>
      </div>
      <div>
        <label htmlFor="signupDeadline" className="block text-sm font-semibold">
          Last day to sign up
        </label>
        <div className="mt-1">
          <DeadlineInput id="signupDeadline" name="signupDeadline" />
        </div>
        <p className="mt-1 text-sm text-muted">
          Signups close at this time, and you can run the raffle once it has passed.
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-accent">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Creating..." : "Create group"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create `app/groups/new/page.tsx`**

```tsx
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { Header } from "@/components/Header";
import { cardClass } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Create a group" };

export default async function NewGroupPage() {
  await requireUser();
  return (
    <>
      <Header signedIn />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Create a group</h1>
        <p className="mt-2 text-muted">
          You will get an invite code to share with the people you want in the exchange.
        </p>
        <div className={`${cardClass} mt-6`}>
          <CreateGroupForm />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Create `app/dashboard/page.tsx`**

```tsx
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
```

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add app/dashboard app/groups/new components/DeadlineInput.tsx components/CreateGroupForm.tsx
git commit -m "feat: add dashboard and create-group flow"
```

---

### Task 11: Join-group flow (invite code and invite link)

**Files:**
- Create: `app/groups/join/page.tsx`, `app/groups/join/actions.ts`, `components/JoinGroupForm.tsx`

**Interfaces:**
- Consumes: `requireUser`, `getDb`, `joinGroup`, `FormState`, `Header`, UI constants.
- Produces:
  - `joinGroupAction(prev: FormState, formData: FormData): Promise<FormState>` - reads `inviteCode`, `displayName`; success and `already_member` both redirect to `/groups/<id>`.
  - `/groups/join?code=ABCD-1234` pre-fills the code (this is the shareable invite link).

- [ ] **Step 1: Create `app/groups/join/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { joinGroup } from "@/lib/groups";
import { requireUser } from "@/lib/session";

const MESSAGES = {
  invalid_display_name: "Enter the name your group will see (up to 40 characters).",
  unknown_code: "We could not find a group with that code. Double-check it with whoever invited you.",
  closed: "Signups for this group have closed.",
  name_taken: "Someone in this group already uses that name. Pick a different one.",
} as const;

export async function joinGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await joinGroup(getDb(), {
    userId: user.id,
    inviteCode: String(formData.get("inviteCode") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  });
  if (result.ok) redirect(`/groups/${result.groupId}`);
  if (result.error === "already_member") redirect(`/groups/${result.groupId}`);
  return { error: MESSAGES[result.error] };
}
```

- [ ] **Step 2: Create `components/JoinGroupForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { joinGroupAction } from "@/app/groups/join/actions";
import { buttonPrimary, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

export function JoinGroupForm({ initialCode }: { initialCode: string }) {
  const [state, formAction, pending] = useActionState(joinGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="inviteCode" className="block text-sm font-semibold">
          Invite code
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          required
          maxLength={12}
          defaultValue={initialCode}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCD-1234"
          className={`${inputClass} mt-1 font-mono uppercase tracking-widest`}
        />
      </div>
      <div>
        <label htmlFor="displayName" className="block text-sm font-semibold">
          Your name in this group
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={40}
          placeholder="What should everyone call you?"
          className={`${inputClass} mt-1`}
        />
        <p className="mt-1 text-sm text-muted">
          This is what the group sees. We never show your Google name.
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-accent">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Joining..." : "Join group"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create `app/groups/join/page.tsx`**

```tsx
import { Header } from "@/components/Header";
import { JoinGroupForm } from "@/components/JoinGroupForm";
import { cardClass } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Join a group" };

export default async function JoinGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requireUser();
  const { code } = await searchParams;

  return (
    <>
      <Header signedIn />
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Join a group</h1>
        <p className="mt-2 text-muted">
          Enter the invite code you were given, then choose the name the group will see.
        </p>
        <div className={`${cardClass} mt-6`}>
          <JoinGroupForm initialCode={code ?? ""} />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add app/groups/join components/JoinGroupForm.tsx
git commit -m "feat: add join-group flow with shareable invite link"
```

---

### Task 12: Group page (members, deadline, invite sharing)

**Files:**
- Create: `app/groups/[groupId]/page.tsx`, `components/InviteShare.tsx`
- The raffle and reveal controls are added in Task 13; in this task the page renders a placeholder section only for `closed`/`raffled` statuses.

**Interfaces:**
- Consumes: `requireUser`, `getDb`, `getGroupForMember`, `getGroupStatus`, `MIN_MEMBERS`, `formatInviteCode`, `Header`, `LocalTime`, `Countdown`, `StatusBadge`, UI constants.
- Produces: `<InviteShare code: string />` (client) with "Copy code" and "Copy invite link" buttons; the group page at `/groups/[groupId]` (404 for non-members).

- [ ] **Step 1: Create `components/InviteShare.tsx`**

```tsx
"use client";

import { useState } from "react";
import { buttonSecondary } from "@/components/ui";
import { formatInviteCode } from "@/lib/invite-code";

export function InviteShare({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const display = formatInviteCode(code);

  async function copy(kind: "code" | "link") {
    const text = kind === "code" ? display : `${window.location.origin}/groups/join?code=${display}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div>
      <p className="font-mono text-3xl font-bold tracking-widest text-primary">{display}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("code")} className={buttonSecondary}>
          {copied === "code" ? "Copied" : "Copy code"}
        </button>
        <button type="button" onClick={() => copy("link")} className={buttonSecondary}>
          {copied === "link" ? "Copied" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/groups/[groupId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { Header } from "@/components/Header";
import { InviteShare } from "@/components/InviteShare";
import { LocalTime } from "@/components/LocalTime";
import { StatusBadge } from "@/components/StatusBadge";
import { cardClass } from "@/components/ui";
import { getDb } from "@/lib/db";
import { MIN_MEMBERS, getGroupStatus } from "@/lib/group-status";
import { getGroupForMember } from "@/lib/groups";
import { requireUser } from "@/lib/session";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const user = await requireUser();
  const { groupId } = await params;
  const group = await getGroupForMember(getDb(), { groupId, userId: user.id });
  if (!group) notFound();

  const status = getGroupStatus(group, new Date());
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
            <InviteShare code={group.inviteCode} />
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

        {status === "closed" ? (
          <section className={cardClass}>
            <h2 className="text-lg font-bold">Signups are closed</h2>
            <p className="mt-1 text-muted">
              {group.isAdmin
                ? "You can run the raffle once everyone you expect has joined."
                : "Waiting for the organizer to run the raffle."}
            </p>
          </section>
        ) : null}
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add "app/groups/[groupId]/page.tsx" components/InviteShare.tsx
git commit -m "feat: add member-only group page with invite sharing"
```

---

### Task 13: Run the raffle and reveal UI

**Files:**
- Create: `app/groups/[groupId]/actions.ts`, `components/RaffleButton.tsx`, `components/RevealCard.tsx`
- Modify: `app/groups/[groupId]/page.tsx`

**Interfaces:**
- Consumes: `runRaffle`, `revealAssignment` (`@/lib/raffle-service`); `buildRevealSequence` (`@/lib/reveal-sequence`); `requireUser`; `getDb`; `FormState`; `MIN_MEMBERS`; UI constants.
- Produces:
  - `runRaffleAction(prev: FormState, formData: FormData): Promise<FormState>` - reads hidden `groupId`; on success calls `revalidatePath` for the group page.
  - `revealMatchAction(groupId: string): Promise<{ ok: true; name: string } | { ok: false; error: string }>`
  - `<RaffleButton groupId: string memberCount: number />`
  - `<RevealCard groupId: string decoys: string[] revealedName: string | null />` - when `revealedName` is set it shows the name directly; otherwise shows a button, calls `revealMatchAction`, plays the slot-roll animation from `buildRevealSequence`, and settles on the name. Honors `prefers-reduced-motion` (no animation).

- [ ] **Step 1: Create `app/groups/[groupId]/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { revealAssignment, runRaffle } from "@/lib/raffle-service";
import { requireUser } from "@/lib/session";

const RAFFLE_MESSAGES = {
  not_found: "We could not find that group.",
  not_admin: "Only the organizer can run the raffle.",
  too_early: "The raffle can only run after the signup deadline.",
  already_raffled: "The names have already been drawn.",
  not_enough_members: "You need at least 3 people before the raffle can run.",
} as const;

export async function runRaffleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const result = await runRaffle(getDb(), { groupId, userId: user.id });
  if (!result.ok) return { error: RAFFLE_MESSAGES[result.error] };
  revalidatePath(`/groups/${groupId}`);
  return { error: null };
}

export async function revealMatchAction(
  groupId: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const result = await revealAssignment(getDb(), { groupId, userId: user.id });
  if (!result.ok) return { ok: false, error: "No match is available yet." };
  return { ok: true, name: result.receiverName };
}
```

- [ ] **Step 2: Create `components/RaffleButton.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { runRaffleAction } from "@/app/groups/[groupId]/actions";
import { buttonPrimary } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { error: null };

export function RaffleButton({ groupId, memberCount }: { groupId: string; memberCount: number }) {
  const [state, formAction, pending] = useActionState(runRaffleAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = `Run the raffle for ${memberCount} people? This cannot be undone.`;
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Drawing names..." : "Run the raffle"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-accent">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 3: Create `components/RevealCard.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { revealMatchAction } from "@/app/groups/[groupId]/actions";
import { buttonPrimary, cardClass } from "@/components/ui";
import { buildRevealSequence } from "@/lib/reveal-sequence";

type Phase = "idle" | "loading" | "rolling" | "done";

export function RevealCard({
  groupId,
  decoys,
  revealedName,
}: {
  groupId: string;
  decoys: string[];
  revealedName: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(revealedName ? "done" : "idle");
  const [shown, setShown] = useState(revealedName ?? "");
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function reveal() {
    setPhase("loading");
    setError(null);
    try {
      const result = await revealMatchAction(groupId);
      if (!result.ok) {
        setPhase("idle");
        setError(result.error);
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setShown(result.name);
        setPhase("done");
        return;
      }
      setPhase("rolling");
      for (const frame of buildRevealSequence(decoys, result.name)) {
        if (cancelled.current) return;
        setShown(frame.name);
        await new Promise((resolve) => window.setTimeout(resolve, frame.delayMs));
      }
      if (!cancelled.current) setPhase("done");
    } catch {
      setPhase("idle");
      setError("Something went wrong. Please try again.");
    }
  }

  const waiting = phase === "idle" || phase === "loading";

  return (
    <section className={`${cardClass} text-center`} aria-live="polite">
      {waiting ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            The names are drawn
          </p>
          <h2 className="mt-2 text-2xl font-bold">Ready to find out who you are gifting?</h2>
          <button
            type="button"
            onClick={reveal}
            disabled={phase === "loading"}
            className={`${buttonPrimary} mt-6 px-8 py-3 text-base`}
          >
            {phase === "loading" ? "Shuffling..." : "Reveal my match"}
          </button>
          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-accent">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {phase === "done" ? "You are gifting" : "Drawing..."}
          </p>
          <p
            key={phase}
            className={`mt-3 break-words text-5xl font-extrabold tracking-tight ${
              phase === "done" ? "animate-pop text-primary" : "text-foreground/60"
            }`}
          >
            {shown}
          </p>
          {phase === "done" ? (
            <p className="mt-4 text-sm text-muted">Keep it secret. Only you can see this.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Update `app/groups/[groupId]/page.tsx`**

Add these imports near the top:
```tsx
import { RaffleButton } from "@/components/RaffleButton";
import { RevealCard } from "@/components/RevealCard";
```

Replace the final `status === "closed"` section (the block that renders "Signups are closed") with:

```tsx
        {status === "closed" ? (
          <section className={cardClass}>
            <h2 className="text-lg font-bold">Signups are closed</h2>
            {group.isAdmin ? (
              group.members.length >= MIN_MEMBERS ? (
                <>
                  <p className="mb-4 mt-1 text-muted">
                    Everyone who signed up is listed above. When you are ready, draw the names. This
                    can only be done once.
                  </p>
                  <RaffleButton groupId={group.id} memberCount={group.members.length} />
                </>
              ) : (
                <p className="mt-1 text-muted">
                  Only {group.members.length} {group.members.length === 1 ? "person has" : "people have"}{" "}
                  joined, and the raffle needs at least {MIN_MEMBERS}. Signups are closed, so this
                  group cannot be raffled.
                </p>
              )
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
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/groups/[groupId]" components/RaffleButton.tsx components/RevealCard.tsx
git commit -m "feat: add admin raffle button and animated per-member reveal"
```

---

### Task 14: Deployment readiness, README and final verification

**Files:**
- Create: `README.md` (replace the scaffold README)
- Verify: build, tests, lint

**Interfaces:** none (documentation and verification).

- [ ] **Step 1: Replace `README.md`**

````markdown
# Gift Raffle

A public web app for running private Secret-Santa style gift exchanges. People sign in with
Google (via WorkOS), create or join invite-code groups, and after the signup deadline the group
organizer runs a one-time raffle. Each member then reveals who they are gifting. Nobody gets
themselves, and nobody is picked twice.

Stack: Next.js 16, Netlify (hosting + Netlify Database), WorkOS AuthKit, Vitest.

## Run locally

```bash
npm install
cp .env.example .env.local        # then fill in the WorkOS values (see below)
npm run dev                       # netlify dev: app at http://localhost:8888 with a local Postgres
```

`netlify dev` starts a local Postgres-compatible database automatically. Apply the schema to it
once (and again after adding migrations):

```bash
npx netlify database migrations apply
```

No database account or setup is needed: in production Netlify provisions the database and applies
`netlify/database/migrations/` on every deploy.

## Tests

```bash
npm test            # unit + integration tests (uses an in-memory Netlify Database)
npm run typecheck
npm run lint
```

## WorkOS setup (one time)

1. Create an account at https://dashboard.workos.com and open the **Staging** environment.
2. Authentication: enable **Google OAuth**; disable Email + Password and any other method.
3. Redirects: Redirect URI `http://localhost:8888/callback`, Initiate login URI
   `http://localhost:8888/sign-in`, Sign-out redirect `http://localhost:8888/`.
4. Put `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD` (`openssl rand -base64 32`)
   and `NEXT_PUBLIC_WORKOS_REDIRECT_URI` in `.env.local`.

## Deploy to Netlify

1. Push this repo to GitHub and import it in Netlify (or run `npx netlify init`).
2. In Netlify -> Site configuration -> Environment variables add:
   `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`,
   `NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://<your-site>/callback`.
3. WorkOS **Production** environment: add the same three redirect URLs for your production domain
   and configure your own Google OAuth client (Google Cloud Console -> OAuth client of type Web
   application, with the redirect URI shown in WorkOS -> Authentication -> OAuth providers ->
   Google; publish the app so users do not see "Access blocked"). Use the Production API key and
   Client ID in Netlify.
4. Deploy. Netlify creates the database (because `@netlify/database` is a dependency) and applies
   the migrations before the deploy is published.
````

- [ ] **Step 2: Full automated verification**

Run each and confirm:
```bash
npm test
npm run typecheck
npm run lint
WORKOS_CLIENT_ID=client_dummy WORKOS_COOKIE_PASSWORD=dummy_cookie_password_of_32_chars_min NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:8888/callback npm run build
```
Expected: all tests pass; typecheck and lint clean; `next build` completes and lists the routes `/`, `/dashboard`, `/groups/new`, `/groups/join`, `/groups/[groupId]`, `/sign-in`, `/callback`. If the build fails because `proxy.ts` is not recognized by the installed Next version, report it to the user rather than changing the file name silently.

- [ ] **Step 3: Check that no secrets are tracked**

Run: `git ls-files | grep -E "^\.env" ; git status --short`
Expected: only `.env.example` is listed; nothing secret is staged.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with local setup, WorkOS and Netlify deploy steps"
```

- [ ] **Step 5: Manual end-to-end checklist (needs the user's WorkOS credentials; run after Task 8's user action is done)**

Run `npm run dev`, apply migrations (`npx netlify database migrations apply`), then using two different Google accounts (use a private window for the second):

1. Visit `http://localhost:8888/` signed out: landing page shows; "Sign in with Google" goes to WorkOS and offers only Google.
2. Account A signs in -> lands on `/dashboard` with the empty state. No Google name or email appears anywhere.
3. A creates a group with a deadline 2 minutes from now -> redirected to the group page showing the invite code, "Copy code" and "Copy invite link" work, A is listed as "you - organizer".
4. Account B opens the invite link while signed out -> is sent through sign-in and returns to the join page with the code pre-filled; B picks a name and joins. Trying A's name (any capitalization) shows the "already uses that name" error.
5. Create a third account/user (or temporarily lower the minimum) so there are at least 3 members; confirm that with fewer than 3 the organizer sees the "needs at least 3" message after the deadline.
6. Before the deadline: no raffle button; after the deadline: A sees "Run the raffle", confirms the prompt, and the page flips to the names-drawn state. Reloading and clicking again is impossible (button gone); B cannot join with the code any more.
7. Each member sees "Reveal my match", clicks it, watches the names roll and land on one name; reloading shows the name directly with no animation. Collect everyone's result: all names are distinct and nobody got themselves.
8. In the browser's View Source for an un-revealed member's page, the match name is not present.
9. Open `/groups/<id>` of a group from a non-member account: 404.

Report any failed item to the user with the observed behavior.
