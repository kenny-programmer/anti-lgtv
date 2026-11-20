# Gift Exchange Raffle App — Design Spec

Date: 2026-11-20

## Purpose

A public, multi-tenant web app for running "Secret Santa" style gift
exchanges. Anyone can sign in with Google, create a private group
(protected by an invite code), invite others into it, and once a
signup deadline passes, run a one-time random raffle that assigns each
member a single other member to gift — guaranteeing no one is assigned
themselves and every member is assigned exactly once as giver and
once as receiver.

The product is public (anyone can sign up), but each group is private:
only people with the group's invite code can see or join it. There is
no cross-group visibility — a user who belongs to multiple groups
(e.g. two separate friend circles) sees them as fully separate
contexts, including a separate display name per group.

## Stack

- **Framework:** Next.js (App Router), deployed on **Netlify**.
- **Database:** **Netlify DB** (Netlify's managed Postgres) — provisioned
  automatically through the Netlify integration, no manual DB setup
  required by the user.
- **ORM:** Prisma, pointed at the Netlify DB connection string.
- **Auth:** **WorkOS AuthKit**, configured with **Google as the only
  social connection** (matches "login via Gmail"). WorkOS handles the
  hosted login UI and session; we never see the user's Google password.

## Data Model

```
User
  id                 (pk)
  workos_user_id      unique, from WorkOS
  email               from WorkOS — internal only, never shown to other members
  created_at

Group
  id                 (pk)
  name
  invite_code         unique, 8 chars [A-Z0-9], displayed as XXXX-XXXX
  signup_deadline      timestamp
  status               enum: open | closed | raffled
  created_by           -> User.id (the admin)
  created_at

Membership
  id                 (pk)
  group_id            -> Group.id
  user_id             -> User.id
  display_name         per-group nickname, set by the member on join
  joined_at
  unique(group_id, user_id)

Assignment
  id                 (pk)
  group_id            -> Group.id
  giver_membership_id    -> Membership.id
  receiver_membership_id -> Membership.id
  unique(group_id, giver_membership_id)
  unique(group_id, receiver_membership_id)
```

`status` transitions one-way: `open` → `closed` (deadline passed,
signups locked) → `raffled` (assignments computed, permanent).

## Core Flows

1. **Landing page (public, no login required).** Explains what the
   app does and offers "Sign in with Google." No group data is ever
   rendered here.

2. **Login.** WorkOS AuthKit hosted page, Google-only. On first login,
   we create (or find, by `workos_user_id`) the `User` row.

3. **Create group.** Any logged-in user can create a group: name +
   signup deadline. Creator becomes the group's admin
   (`Group.created_by`). An 8-character invite code is generated
   (cryptographically random, `[A-Z0-9]`, rendered as `XXXX-XXXX`) and
   shown to the creator to share however they like (text, chat, etc.)
   — the app itself never emails or publishes it.

4. **Join group.** A logged-in user enters an invite code. If the
   group is `open` and the deadline hasn't passed, they're prompted
   for a display name (their nickname *for this group only*) and a
   `Membership` row is created. Joining a group they're already in,
   joining with a bad code, or joining after the deadline all show a
   clear error — no membership is created.

5. **Group dashboard.** Shows the group name, countdown to deadline
   (or "closed" once passed), the member list (display names only —
   never emails), and the current status. The admin additionally sees
   a "Run the raffle" button, enabled only once the deadline has
   passed and the group has ≥3 members.

6. **Run the raffle (admin only, one-time).** A server action computes
   a random derangement (a permutation of members with no fixed
   points — nobody is assigned to themselves) over the group's
   memberships, writes all `Assignment` rows in a single transaction,
   and flips `Group.status` to `raffled`. Algorithm: shuffle the
   member list and pair member *i* with member *i+1* (wrapping
   around); if the group has only 2 members this degenerates to a
   fixed pair-swap, which is still a valid derangement. Re-running the
   raffle on an already-`raffled` group is rejected — assignments are
   permanent.

7. **Reveal.** Once `Group.status == raffled`, each member's dashboard
   shows a "Reveal your match" button. Clicking it plays a client-side
   slot-roll animation cycling through member display names before
   settling on that member's actual assigned receiver (already fixed
   server-side — the animation is cosmetic, not the source of
   randomness). After the first reveal, the dashboard just shows the
   name directly on return visits rather than replaying the animation.

## Security & Privacy

- Invite codes are generated with a cryptographically secure random
  source, 8 chars over `[A-Z0-9]` (~2.8 trillion combinations) — not
  guessable by the public.
- Groups are fully isolated: a user can only see a group's members,
  deadline, or assignments if they hold a `Membership` in that group.
- Emails (from WorkOS) are stored only to identify the `User` account
  and are never displayed to other group members — only per-group
  display names are shown.
- A user can belong to any number of groups; display name, membership,
  and assignment data are always scoped to a single `group_id` and
  never shared across groups.

## Error Handling / Edge Cases

- Invalid invite code, already-closed group, or already-member →
  friendly inline error, no state change.
- Admin attempts to run the raffle before the deadline, or with <3
  members → button disabled with explanatory copy.
- Raffle re-run attempts after `status == raffled` → rejected
  server-side (idempotent safeguard even if the disabled button is
  bypassed).
- Group creation deadline must be in the future; enforced on the
  server, not just the client form.

## Testing

- **Unit:** derangement algorithm — no fixed points, every member
  appears exactly once as giver and once as receiver, correctness at
  N=2 (edge case) and N=3–10.
- **Integration:** full group lifecycle against a test DB — create →
  join (multiple users) → deadline enforcement (join blocked after
  deadline) → raffle (run once, reject second run) → reveal (each
  member sees only their own assignment).
- **Manual:** WorkOS Google login flow end-to-end, invite code
  share/join on a second account, and the reveal animation in a
  browser.

## Out of Scope (v1)

- Manual exclusion pairs (e.g. excluding spouses from matching each
  other) — only self-exclusion is enforced in v1.
- Automatic/scheduled raffle triggering — the admin manually clicks
  "Run the raffle" after the deadline.
- Gift wishlists, price ranges, or shipping/logistics features.
- Email notifications (deadline reminders, raffle-ready alerts).
