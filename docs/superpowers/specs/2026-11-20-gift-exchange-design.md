# Gift Exchange Raffle App — Design Spec

Date: 2026-11-20 (revised after verifying current Netlify Database and
WorkOS AuthKit APIs — see "Revision notes" at the end)

## Purpose

A public, multi-tenant web app for running "Secret Santa" style gift
exchanges. Anyone can sign in with Google, create a private group
(protected by an invite code), invite others into it, and once a
signup deadline passes, run a one-time random raffle that assigns each
member a single other member to gift — guaranteeing no one is assigned
themselves and no member is assigned to more than one giver (every
member gives exactly once and receives exactly once).

The product is public (anyone can sign up), but each group is private:
only people with the group's invite code can see or join it. There is
no cross-group visibility — a user who belongs to multiple groups
(e.g. two separate friend circles) sees them as fully separate
contexts, including a separate display name per group.

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Tailwind), deployed
  on **Netlify**.
- **Database:** **Netlify Database** (Netlify's managed Postgres, GA) via
  the `@netlify/database` package. Netlify provisions the database and
  applies migrations automatically on deploy — the user sets up no
  database. Locally, `netlify dev` runs a built-in Postgres-compatible
  database; automated tests use `@netlify/database-dev`.
- **Data access:** plain SQL (`db.sql` tagged templates, and `db.pool`
  for transactions) with SQL migration files in
  `netlify/database/migrations/`. No ORM: Netlify applies only SQL files
  from that directory, and Prisma is not a supported path on Netlify
  Database.
- **Auth:** **WorkOS AuthKit** (`@workos-inc/authkit-nextjs`), with
  **Google as the only sign-in method** (matches "login via Gmail").
  WorkOS hosts the login UI and session; we never see a Google password.
- **Tests:** Vitest.

## Data Model

```
users
  id                  uuid pk
  workos_user_id      text unique
  email               text — internal only, never shown to other members
  created_at

groups
  id                  uuid pk
  name                text, 1–80 chars
  invite_code         text unique, exactly 8 chars [A-Z0-9]
  signup_deadline     timestamptz
  raffled_at          timestamptz null — set once, when the raffle runs
  created_by          -> users.id (the admin)
  created_at

memberships
  id                  uuid pk
  group_id            -> groups.id
  user_id             -> users.id
  display_name        text, 1–40 chars, per-group nickname
  joined_at
  unique(group_id, user_id)
  unique(group_id, lower(display_name))

assignments
  id                       uuid pk
  group_id                 -> groups.id
  giver_membership_id      -> memberships.id
  receiver_membership_id   -> memberships.id
  revealed_at              timestamptz null — set when the giver first reveals
  unique(group_id, giver_membership_id)
  unique(group_id, receiver_membership_id)   -- nobody is picked twice
  check(giver_membership_id <> receiver_membership_id)  -- nobody picks self
```

The two hard guarantees ("nobody gets themselves", "once Tom is picked
for someone, nobody else can get Tom") are enforced by the database
itself, not only by application code.

**Group status is derived, never stored:** `raffled` if `raffled_at` is
set; otherwise `closed` if `now >= signup_deadline`; otherwise `open`.
(A stored status would go stale at the deadline because nothing runs
at that moment.)

## Core Flows

1. **Landing page (public, no login required).** Explains what the
   app does and offers "Sign in with Google." Signed-in visitors are
   redirected to their dashboard. No group data is rendered here.

2. **Login.** WorkOS AuthKit hosted page, Google-only. On first login
   we create (or find, by `workos_user_id`) the `users` row.

3. **Create group.** Any signed-in user can create a group: group name,
   their own display name, and a signup deadline. They become the
   admin (`groups.created_by`) **and a member** (their membership is
   created in the same transaction). An 8-character invite code is
   generated (cryptographically random, `[A-Z0-9]`, shown as
   `XXXX-XXXX`) and displayed with a copy button and a shareable invite
   link (`/groups/join?code=XXXX-XXXX`). The app never emails or
   publishes the code. The deadline must be in the future (enforced
   server-side).

4. **Join group.** A signed-in user enters an invite code (or opens an
   invite link, which pre-fills it; signed-out visitors are sent
   through login and returned to the link). They choose a display name
   for this group. Joining is one atomic SQL statement that only
   succeeds if the group exists, has not been raffled, and the deadline
   has not passed. Failures are distinguished for the user: unknown
   code, signups closed, already a member, or display name already taken
   in this group (case-insensitive).

5. **Group dashboard (members only; non-members get a 404).** Shows
   the group name, deadline (rendered in the viewer's local timezone)
   with a countdown, the member list (display names only), and the
   derived status. The admin sees a "Run the raffle" button, enabled
   only when status is `closed` and there are ≥3 members. The invite
   code is shown to members while the group is `open`.

6. **Run the raffle (admin only, one time).** In one transaction:
   (a) atomically claim the group with
   `UPDATE groups SET raffled_at = now WHERE id = ? AND raffled_at IS NULL AND signup_deadline <= now`
   — zero rows means it was already raffled / not yet closed, so the
   action stops; (b) read the members; (c) require ≥3; (d) compute a
   random derangement; (e) insert all assignment rows. Because the claim
   is a single conditional UPDATE, double-clicks and concurrent requests
   cannot raffle twice. Algorithm: Fisher–Yates shuffle (crypto RNG) of
   member ids, then member *i* gives to member *i+1* (wrapping around) —
   a single cycle, so no one is ever matched to themselves.

7. **Reveal.** Once raffled, each member sees a "Reveal my match"
   button. Their match's name is **not** in the page until they click:
   clicking calls a server action that returns the name and stamps
   `assignments.revealed_at`. The client then plays a slot-machine
   style raffle animation cycling through the group's display names
   and settling on the returned name. On later visits (`revealed_at`
   set) the name is shown directly, with no animation.

## Security & Privacy

- Invite codes: cryptographically secure random, 8 chars over
  `[A-Z0-9]` (~2.8 trillion combinations).
- Groups are fully isolated: every group query is scoped by membership;
  non-members cannot read a group's members, deadline, or assignments.
- Every server action re-checks the signed-in user itself; it never
  trusts hidden form fields for identity or permissions.
- Emails are stored only to identify the `users` row and are never
  shown to other members.
- A member can only ever read their own assignment.
- Netlify Database connection strings and WorkOS secrets live only in
  environment variables, never in git.

## Error Handling / Edge Cases

- Unknown/invalid invite code, closed group, already-a-member, taken
  display name → specific inline error, no state change.
- Raffle attempted before the deadline, with <3 members, by a
  non-admin, or a second time → rejected server-side (the disabled
  button is only a convenience).
- Deadline must be in the future at creation (server-side).
- Dates are stored in UTC (`timestamptz`) and rendered in the viewer's
  local timezone in the browser.

## Testing

- **Unit:** raffle algorithm (permutation + no fixed points across many
  random runs, N=2..12), invite-code generation/normalisation, derived
  group status.
- **Integration (real Postgres via `@netlify/database-dev`):** create →
  join → closed-after-deadline → raffle → reveal, including: joining
  rejected after the deadline and after the raffle; duplicate member /
  duplicate display name rejected; second raffle rejected; non-admin
  rejected; <3 members rejected; each member can read only their own
  assignment; database constraints reject self-assignment and a
  duplicate receiver.
- Note: the local test database does not enforce row locks across
  separate connections, so true concurrent-request races cannot be
  tested locally. The design avoids depending on locks for
  correctness: the raffle's claim is a single atomic conditional UPDATE.
- **Manual:** WorkOS Google sign-in end to end, invite link flow on a
  second account, the reveal animation in a browser.

## Out of Scope (v1)

- Manual exclusion pairs (e.g. keeping spouses from matching each other).
- Automatic/scheduled raffle triggering — the admin clicks the button.
- Leaving a group, removing members, editing the deadline or display
  name after joining.
- Wishlists, price limits, shipping/logistics.
- Email notifications.

## Revision notes (vs. the first approved draft)

- **Prisma → plain SQL on `@netlify/database`.** Netlify Database
  (the current product; `NETLIFY_DB_URL`, not the deprecated
  `NETLIFY_DATABASE_URL`/Neon flow) auto-provisions and auto-migrates
  only from SQL files in `netlify/database/migrations/`.
- **Stored `status` → derived status** (`raffled_at` + deadline).
- **Reveal is server-side** (`assignments.revealed_at`; name withheld
  until clicked) instead of a client-side flag.
- **Creator is automatically a member**; display names are unique per
  group (otherwise two "Mike"s make a reveal ambiguous); invite links
  added.
