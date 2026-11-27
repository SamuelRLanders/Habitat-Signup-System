# Habitat Signup System

A web app for the Purdue Habitat for Humanity chapter. Admins (the chapter's leaders) publish a signup form for each build day, listing the day's builds. Volunteers open a form from the home page or a shared link, confirm their email with a 6-digit code, and say which builds they could work at. The app makes sure everyone can be placed at a build with a ride, runs waitlists, and gives admins the assignments, Purdue's travel roster and the chapter's statistics. Volunteers don't need an account; only admins sign in.

> **Questions about the app?** [CONTEXT.md](CONTEXT.md) describes what it's for, how it's set up and how every feature is meant to be used. Upload it to an AI assistant and ask away. Admins can also download it from the admin **Help** page. Update it whenever a feature changes.

In the app, a **build** is one group working at one address on a day (the code calls it a `Shift`), and an **event** is a day of builds.

## Features

**For volunteers (no account needed)**
- See published build days on the home page, from before a form opens until the day's first build starts
- Confirm an email address with an emailed 6-digit code, remembered on that browser for 2 hours
- Fill out the form in steps: their information (name, phone, birthday, T-shirt size, driver's license), Purdue driver approval, how they're getting there, their car's seats, every build they could work at, friends to be placed with, then each waiver section. Details are filled in from their last signup.
- See why a build can't be chosen ("Only accepting people willing to drive others"), and join a full build's waitlist instead
- Sign up with a spot reserved for them, even before the form opens
- Cancel until the day's first build starts. Signups can't be edited: volunteers cancel and sign up again while the form is open.
- Volunteers must be 18 or older on the build day, and can sign up on one form a day

Volunteers are only ever emailed their codes. Admins contact them about everything else.

**For admins (sign in with an emailed code)**
- **Forms**: create a form for a build day with a name, open and close times, a description, sections (such as waiver links) and builds. Each build has a name, address, times, spots, description, lunch note and a responsible admin. A day can have several forms, such as one for an outside group shared only by link.
- **Form options**: list it on the home page; ask how volunteers are getting there (off for a group with its own transport); ask about friends; allow a waitlist for full builds; email the responsible admin when someone cancels after the form closes.
- **Reserved spots**: hold a build's spot for a named person by email, then copy the form link to send them. Reserved spots come out of the build's spots.
- **Overview, Volunteers and Waitlist tabs**: each build's likely placement, drivers needed, reserved spots and anyone who can't be placed; everyone signed up with totals and a CSV; the waitlist in join order. Copy the emails of everyone going to a build once the form closes.
- **Assignments tab**: a board with a column per build. *Planned assignments* show the app's placement; once the form closes, admins move people (including off the waitlist) with warnings for anything that breaks the placement rules. From the day's first build, *confirmed assignments* record who actually went: mark no-shows and add people who came without signing up. **Copy travel roster** copies Purdue's roster for the day.
- **Cancel an event**: the form says it's off and nobody is emailed. Can't be undone.
- **Data**: *Statistics* for any time range (people, spots filled, hours, new and returning volunteers, cancellations, no-shows, ages, transport, experience, T-shirt sizes, most builds, each event); search *People* and *Builds*, with details and CSV downloads. Editors can correct how many builds someone has done.
- **Drivers**: approve pending drivers through an end date, decline or revoke; add a driver to pending; or upload Purdue's `ApprovedDrivers.xlsx` to approve or extend the matches.
- **Help**: CONTEXT.md to download or copy, and the link to this repository.
- **Admins** (owner only): add, remove and change admins' roles, and transfer ownership.
- Before any action that emails people, see who will be emailed and whether it would pass the daily email limit.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript | One codebase for the public site and admin dashboard |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) | Clean, accessible components that are quick to build with |
| Database | PostgreSQL (hosted on [Supabase](https://supabase.com)) | Relational data (forms ↔ builds ↔ volunteers) |
| ORM | [Prisma](https://www.prisma.io) | Type-safe queries and schema migrations |
| Admin auth | [Better Auth](https://better-auth.com) with 6-digit email codes | No passwords to manage; codes work on phones, where email links often open in another browser |
| Email | [Resend](https://resend.com) | Sign-in codes and admin notices. The free plan sends 100 a day, which the app counts |
| Validation | [Zod](https://zod.dev) | Shared validation for forms and Server Actions |
| Placement | [yalps](https://github.com/IanManske/YALPS) | Solves the small integer program that places volunteers |
| Hosting | [Vercel](https://vercel.com) | Zero-config deploys for Next.js |

## Data Model

`prisma/schema.prisma` has comments on every table and field.

- **User**: an admin: the owner, an editor or a viewer. Volunteers don't have accounts.
- **OwnershipTransfer**: the owner's pending handover to another admin, a link that works for 7 days (stored hashed)
- **SignupForm**: a form for one build day: open and close times, draft, published or cancelled, its options, and when its planned and confirmed assignments were saved
- **Shift**: one of a form's builds: name, address, times (Indiana time), spots and responsible admin. Builds volunteers chose are cancelled rather than deleted.
- **FormSection**: a heading and text shown on a form, in order, such as a waiver link
- **Reservation**: a spot held at a build for a volunteer, by email
- **Volunteer**: someone who has signed up, identified by the email they confirmed, with their latest details, car seats, driver request and any admin correction to their builds done
- **FormSignup**: a volunteer's signup for a form, with a copy of their details. Also records when they joined the waitlist, their assigned and planned builds, no-shows, and whether an admin added them. Cancelling keeps the row.
- **ShiftPreference**: a build a volunteer said they could work at
- **GroupRequest**: a friend, by email, a volunteer asked to be placed with
- **DriverApproval**: an admin's approval (through an end date) or decline of a volunteer's Purdue driver approval
- **VolunteerCode**, **VolunteerSession**: volunteers' email codes and the 2-hour browser sessions that follow (both stored hashed)
- **LoginCodeRequest**: recent code requests, for rate limits
- **EmailDay**: emails sent through Resend each UTC day
- **Message**, **MessageRecipient**: for messaging volunteers from the app (not built yet)
- **Session**, **Account**, **Verification**: Better Auth's tables

## Admin roles

- **Owner** (exactly one): everything an editor can do, plus the **Admins** page: add admins (they're emailed), make them editors or viewers, remove them, and transfer ownership. The owner also gets the daily email limit warning and the alert when a volunteer cancels after a form closes.
- **Editor**: sees and changes forms, signups, assignments, people and drivers, and can be a build's responsible admin.
- **Viewer**: sees every admin page and can copy emails and download CSVs, but can't change anything. Every Server Action that writes calls `requireEditor()` (`src/lib/auth/dal.ts`), so this holds even outside the UI.

Transferring ownership emails the chosen admin a link. They sign in as themselves and choose **Accept ownership**; then they become the owner and the old owner becomes an editor and is emailed. Until then the owner can cancel. The database allows only one owner (a partial unique index). If the owner can't sign in, `npm run admin:set-owner` sets one directly. When an admin is removed or made a viewer, their upcoming builds go to the owner.

## Key Considerations

- **Placing volunteers**: volunteers list every build they could work at, and a signup is taken only if everyone can still be placed at one of their builds where every rider has a seat in a car going there. For every 3 riders without a seat, a spot is held for a driver (assuming a 4-seat car). After that, the placement tries to send someone highly experienced (6+ builds) to every build, then keep friends together. See `src/lib/placement/solver.ts` for the rules and how they're solved.
- **Waitlist**: while a form is open, the waitlist runs in join order whenever room opens up (a cancellation, more spots, a removed reservation). After it closes, admins move people off it on the Assignments tab.
- **Assignments**: the planned assignments are saved when the day's first build starts (`src/lib/data/final-placement.ts`) and become the confirmed ones, which the Data page counts. Anyone placed counts as having gone unless marked a no-show.
- **Emails**: only emails the chapter has approved are sent: codes, new admin and ownership emails, the after-close cancellation alert, and the owner's limit warning. At 85 a day, emails volunteers set off stop, keeping the rest of Resend's 100 for admins' sign-in codes, and the owner is warned.
- **Waivers**: signed outside the app, linked from each form's sections. The app doesn't track who has signed them.
- **Privacy**: volunteer data is personal information. Keep it in the admin area only, and don't collect more than you need. There are no gender questions or statistics.
- **Spam protection**: emailed codes are rate limited per email and per IP address, and each code allows 5 wrong guesses.
- **Database**: Prisma owns the migrations (`prisma/migrations`). Row-level security is enabled, with no policies, on every table, to block Supabase's Data API; enable it in any migration that creates a table.

## Getting Started

Requires Node.js 20.9+ and a PostgreSQL database.

```bash
npm install                # also generates the Prisma client
cp .env.example .env       # then set DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate         # create the database tables
npm run admin:add -- you@example.org "Your Name"   # add yourself as an admin
npm run admin:set-owner -- you@example.org         # and make yourself the owner
npm run dev                # http://localhost:3000
```

**Emailed codes:** until `RESEND_API_KEY` and `EMAIL_FROM` are set, emails are printed in the terminal running `npm run dev` instead of sent. A production server refuses to start sending without them.

**Signing in:** admins go to `/login`. Volunteers never sign in: they open a form from `/`.

**Branches:** `main` is the live site (Vercel deploys it). Work happens on `version-2` and is merged to `main` when it's ready to go live.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the tests (placement, waitlist, assignments, travel roster, sign-in redirects, statistics ranges) |
| `npm run db:migrate` | Apply schema changes to the development database (`prisma migrate dev`) |
| `npm run db:status:prod` | List migrations the production database hasn't had yet (changes nothing) |
| `npm run db:deploy:prod` | Apply committed migrations to the production database (`prisma migrate deploy`, never resets). Run it before merging additive changes to `main`; split column removals and renames across two releases. |
| `npm run db:studio` | Browse and edit data in Prisma Studio |
| `npm run admin:add -- <email> "<name>" [editor\|viewer]` | Add an admin (an editor unless said), without emailing them. The owner usually adds admins on the Admins page. |
| `npm run admin:remove -- <email>` | Remove an admin and sign them out (keeps the forms and decisions they made). Not the owner. |
| `npm run admin:set-owner -- <email>` | Make an admin the owner straight away; the old owner becomes an editor. For setup, or if the owner can't sign in. |
| `npm run admin:add:prod`, `admin:remove:prod`, `admin:set-owner:prod` | The same, on the production database, using the `DATABASE_URL` in `.env.production.local` (git-ignored). `.env` holds the development database's. |
| `npm run seed:test` | Replace the test forms and builds, volunteers and signups (`-- --clean` only removes them; `-- --people 350` adds made-up volunteers). Test volunteers have `@example.org` emails. |

**Project layout**

- `prisma/schema.prisma`: database schema
- `CONTEXT.md`: the app described for AI assistants, served on the Help page
- `src/app/page.tsx`: the public home page, listing published forms
- `src/app/signup/[formId]/`: a form's public page: the email step, the form itself, and a volunteer's signup with Cancel
- `src/app/login/`: admin sign-in (email, then code)
- `src/app/admin/(dashboard)/`: the admin pages, which require signing in: `forms/` (with each form's tabs), `data/`, `drivers/`, `help/` and `admins/`
- `src/lib/signup-forms/`: forms: their phases, queries, and the admin Server Actions (saving forms, assignments and confirmed assignments)
- `src/lib/form-builds.ts`, `src/lib/sections.ts`: validating the builds and sections the form editor sends
- `src/lib/form-signups/`: volunteers' signups: validation, the submit and cancel Server Actions, the waitlist, emails, experience and the admin rosters
- `src/lib/reservations/`: reserved spots
- `src/lib/placement/`: placing volunteers at builds: the solver, which decides whether a day can take a signup and who each build has room for, assignments checks and the travel roster
- `src/lib/data/`: the Data page's statistics and searches, and saving the planned assignments when a day starts
- `src/lib/admin/`: searching and editing volunteers
- `src/lib/drivers/`: driver approval status, queries, approve/decline/revoke and Purdue's driver list
- `src/lib/admins/`: managing admins and ownership transfers, and their emails
- `src/lib/email-verification/`: volunteers' email codes and 2-hour sessions
- `src/lib/auth/`: admin sign-in (Better Auth config, `requireAdmin()`/`requireEditor()`/`requireOwner()`, the sign-in Server Actions and code rate limits)
- `src/lib/time.ts`: Indiana time conversion and date formatting (times are stored in UTC)
- `src/lib/email.ts`, `src/lib/email-limit.ts`: sending email through Resend (or printing it locally) and the daily limit
- `src/lib/prisma.ts`: shared database client (`import { prisma } from "@/lib/prisma"`)
- `src/proxy.ts`: redirects signed-out visitors away from `/admin`
- `src/components/ui/`: shadcn/ui components (add more with `npx shadcn@latest add <name>`)
- `src/generated/prisma/`: generated Prisma client (git-ignored)
- `scripts/`: the admin and test data scripts

## Roadmap

1. Set up Resend on the live site so codes are emailed
2. Messaging volunteers from the app, such as where they'll work or when a build is cancelled
3. Clearing out old builds (confirmed assignments stay editable for now)
4. More questions on the signup form
