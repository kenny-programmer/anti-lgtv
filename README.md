# Gift Raffle

A public web app for running private Secret-Santa style gift exchanges. People sign in with
Google (via WorkOS), create or join invite-code groups, and after the signup deadline the group
organizer runs a one-time raffle. Each member then reveals who they are gifting. Nobody gets
themselves, and nobody is picked twice.

Stack: Next.js 16, Netlify (hosting + Netlify Database), WorkOS AuthKit, Vitest.

## Requirements

- Node.js **>= 22.13.0** (see `engines` in `package.json`; the Netlify CLI needs it).
- A WorkOS account for sign-in (see "WorkOS setup" below).

## Environment variables

The app needs the four WorkOS variables listed in `.env.example`:

| Variable | What it is |
| --- | --- |
| `WORKOS_CLIENT_ID` | WorkOS Client ID |
| `WORKOS_API_KEY` | WorkOS API key (secret) |
| `WORKOS_COOKIE_PASSWORD` | At least 32 characters, encrypts the session cookie (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Must exactly match a Redirect URI in the WorkOS dashboard |

Without them every page returns an error. `npm run build` still passes without them, because the
variables are only read when a request is served.

## Run locally

```bash
npm install
cp .env.example .env.local              # then fill in the four WorkOS values
npx netlify database migrations apply   # create the tables in the local database
npm run build
npm run dev                             # netlify dev: http://localhost:8888
```

`npm run dev` runs `netlify dev`, which serves the app on port 8888 and starts a local
Postgres-compatible database (stored in the git-ignored `.netlify/db`). `netlify dev` does **not**
apply migrations for you: run `npx netlify database migrations apply` once, and again after adding
a migration (it works whether or not `netlify dev` is running; `npx netlify database status` shows
what is applied or pending).

Note on `npm run dev`: Netlify's project detection starts the app with `npm run start`
(`next start`), so it serves the production build. That is why `npm run build` comes first, and you
need to rebuild after code changes. For a hot-reloading dev server use
`npx netlify dev --command "next dev" --target-port 3000` instead.

No database account or setup is needed: in production Netlify provisions the database and applies
`netlify/database/migrations/` on deploy.

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
   (`NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing it.)
3. WorkOS **Production** environment: add the same three redirect URLs for your production domain
   and configure your own Google OAuth client (Google Cloud Console -> OAuth client of type Web
   application, with the redirect URI shown in WorkOS -> Authentication -> OAuth providers ->
   Google; publish the app so users do not see "Access blocked"). Use the Production API key and
   Client ID in Netlify.
4. Deploy. Because `@netlify/database` is a dependency, Netlify provisions the database during the
   build and applies the migrations in `netlify/database/migrations/` as part of the deploy. You do
   not run migrations by hand in production.

## Limitations (v1)

- The signup deadline cannot be edited after the group is created.
- Members cannot leave a group and the organizer cannot remove members.
- There are no email notifications; share the invite code or link yourself.
- There are no exclusion pairs (for example "partners must not draw each other").
- A group needs at least 3 members to be raffled. If the signup deadline passes with fewer than 3,
  that group cannot be raffled and nobody can join it any more; the organizer should start a new
  group with a later deadline.

## Privacy

- The Google account name is never used or shown. Members are identified only by the display name
  they choose for each group.
- The Google email is stored only to identify the account and is never shown to other members.
- Group data (members, invite code, your own match) is visible only to members of that group.
  Anyone else gets a 404 for the group page.

## Manual end-to-end check

Needs real WorkOS credentials and two or three different Google accounts (use a private window
for each extra account). Run `npm run build`, apply migrations, start `npm run dev`, then:

1. Visit `http://localhost:8888/` signed out: the landing page shows; "Sign in with Google" goes
   to WorkOS and offers only Google.
2. Account A signs in and lands on `/dashboard` with the empty state. No Google name or email
   appears anywhere.
3. A creates a group with a deadline 2 minutes from now and is redirected to the group page showing
   the invite code. "Copy code" and "Copy invite link" work, and A is listed as "you - organizer".
4. Account B opens the invite link while signed out, is sent through sign-in, and returns to the
   join page with the code pre-filled; B picks a name and joins. Trying A's name (in any
   capitalization) shows the "already uses that name" error.
5. After the deadline with fewer than 3 members, every member sees a "Not enough people joined"
   section (with a link to start a new group) and no raffle button, and nobody can join any more.
   With 3 or more members (a third account C must join before the deadline) the organizer sees
   the "Run the raffle" button instead.
6. Before the deadline there is no raffle button. After the deadline A clicks "Run the raffle",
   confirms the prompt, and the page flips to the names-drawn state. After reloading, the button
   is gone, and B cannot join with the code any more.
7. Each member sees "Reveal my match", clicks it, watches the names roll and land on one name;
   reloading shows the name directly with no animation. Collect everyone's result: all names are
   distinct and nobody got themselves.
8. In the browser's View Source for the page of a member who has not revealed yet, the match name
   is not present.
9. Open `/groups/<id>` of a group from a non-member account: 404.
