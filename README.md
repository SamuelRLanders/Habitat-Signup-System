# Habitat Signup System

A web app for the Purdue Habitat for Humanity chapter. Volunteer organization leaders (the admins) publish one signup form per build day, listing the day's builds. Volunteers open the form from the home page or a shared link, confirm their email with a 6-digit code, and say which of the day's builds they could work at. Volunteers don't need an account, and only admins sign in.

## Features

**For volunteers (no account needed)**
- See published build days on the home page, each with its builds
- Before a form opens, look over the day; after it closes, see that it's closed
- Confirm an email address with an emailed 6-digit code, remembered on that browser for 2 hours
- Fill out the form in steps: name, phone, birthday, T-shirt size and driver's license; Purdue driver approval (if they have a license); how they're getting there; their car's seats (if they'll drive others); every build that day they could work at; then each waiver. Builds without room for them, given how they're getting there, are marked full.
- Licensed volunteers are asked to fill out Purdue's driver approval form. Saying they did makes their approval pending, and only pending or approved drivers with a car of at least 3 seats can offer to drive others.
- Volunteers must be 18 or older on the build day
- Details are filled in from their last signup
- Cancel their signup until the day's first build starts, with an email each time. Signups can't be changed: to change one, volunteers cancel and sign up again while the form is open

**For admins (sign in with an emailed code)**
- Create signup forms for a build day, each with a name, open and close times, a description, sections, and its builds. A day can have several separate forms, such as one for an outside group, which can be left off the home page and shared by link. Volunteers can only sign up on one form a day.
- Give each build a name, address, start and end time, spots, description and lunch note
- Turn off a form's transportation questions, for a group getting itself to the build: volunteers aren't asked how they're getting there or for driver approval, and everyone is placed as getting there on their own. Turn off the friends question too, if it isn't wanted.
- Cancel a build day's event: its form says the event is off, and everyone signed up is emailed. Cancelling can't be undone.
- Before any decision that emails volunteers (cancelling an event, approving or extending a driver), see who will be emailed, with a caution if it would go past the daily email limit
- Publish and share a form's link. A day takes a signup only while everyone can still be placed at a build they chose, with a ride if they need one (see Placing volunteers below).
- See each form's volunteers, the builds each could work at, how many are willing to work at each build, and T-shirt and driver's license totals. Download them as a CSV with a column per build.
- See a likely placement for each build, how many more drivers are needed, and anyone who can't be placed. After everyone having a spot and a ride, the placement tries to send someone highly experienced to every build, then keeps friends together.
- Track each volunteer's experience: builds are counted from past signups, and admins can edit how many builds someone has done on the People page (for builds before the app, say); later builds still add on. New is 0 builds, low 1–2, moderate 3–5, high 6 or more.
- Once a form closes, move volunteers between builds (or out of every build) on its Assignments tab by dragging them, with warnings before saving anything that breaks the placement rules. Saved assignments are marked custom, and can be reverted to the app's default placement. They're read-only once the event day is over, when the form shows as Passed.
- Copy the emails of the volunteers going to each build, once its form closes
- Copy Purdue's travel roster for a build day: who's going to each build, who's driving whom, and phone numbers, following the likely placement
- Search and filter every volunteer on the People page, and download them as a CSV
- Approve pending drivers through an end date (suggested a year after they asked), decline them, or revoke an approval on the Drivers page. Each decision records the admin's name, and approved drivers are emailed.
- Check drivers against Purdue's approved driver list: download ApprovedDrivers.xlsx from Purdue's SharePoint, upload it on the Drivers page, and approve the matches (by email, or by name to double-check) with their Purdue end dates. Approved drivers Purdue has renewed can be extended. The file isn't kept.
- See each volunteer's driver status and how they're getting there on the rosters, with ride and seat totals
- Remove builds from a form. A build volunteers chose is cancelled rather than deleted: it disappears from the form, and volunteers' choices of it come back if it's restored.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript | One codebase for the public site and admin dashboard |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) | Clean, accessible components that are quick to build with |
| Database | PostgreSQL (hosted on [Supabase](https://supabase.com)) | Relational data (forms ↔ builds ↔ volunteers) |
| ORM | [Prisma](https://www.prisma.io) | Type-safe queries and schema migrations |
| Admin auth | [Better Auth](https://better-auth.com) with 6-digit email codes | No passwords to manage; codes work on phones, where email links often open in another browser |
| Email | [Resend](https://resend.com) | Sign-in codes, signup confirmations, and notices to volunteers. The free plan sends 100 a day, which the app counts |
| Validation | [Zod](https://zod.dev) | Shared validation for forms and Server Actions |
| Hosting | [Vercel](https://vercel.com) | Zero-config deploys for Next.js |

## Data Model

- **User**: an admin. Admins are added with `npm run admin:add`; volunteers don't have accounts.
- **LoginCodeRequest**: recent requests for emailed codes (admin sign-in and volunteer email checks), used to limit how often codes are sent
- **SignupForm**: the form for one build day (one per date): open and close times, draft or published, a description, and the name of the admin who created it
- **Shift**: one of a form's builds (the app calls it a build): name, address, description, start/end time on the form's day (Indiana time), number of spots. Builds volunteers chose are cancelled rather than deleted.
- **FormSection**: a heading and text shown on a form, in order, such as a waiver link
- **Volunteer**: someone who has signed up, identified by the email they confirmed, with their latest details
- **FormSignup**: a volunteer's signup for a build day, with a copy of the details they submitted for it. Cancelling keeps the row.
- **ShiftPreference**: a build a volunteer said they could work at
- **DriverApproval**: an admin's approval (through an end date) or decline of a volunteer's Purdue driver approval, with the admin's name. A volunteer is pending while `Volunteer.driverRequestedAt` is set.
- **VolunteerCode**, **VolunteerSession**: the codes volunteers confirm their email with, and the 2-hour browser sessions that follow (both stored hashed)
- **Message**, **MessageRecipient**: for emails admins will send to volunteers (not built yet)
- **EmailDay**: how many emails were sent through Resend each UTC day. When a day reaches 90 of Resend's 100, the operations lead (set in `src/lib/email.ts`) is emailed once.

## Key Considerations

- **Waivers**: signed outside the app. Admins add a section to each form linking each waiver, with instructions for filling it out. The app doesn't track who has signed them.
- **Placing volunteers**: volunteers say which of the day's builds they could work at; admins place them later, so until then volunteers can be moved between their choices. A signup is taken only if there's a way to place everyone at one of their builds where every rider has a seat in a car going there. Riders can sign up before there are enough drivers: for every 3 riders without a seat, a spot is held for a driver (assuming a 4-seat car), and only a driver can take it. Pending drivers count. Finding a placement is a small integer program, solved with [yalps](https://github.com/IanManske/YALPS); see `src/lib/placement/solver.ts` for the rules and how it works. Admins still place volunteers outside the app (the form's CSV has a column per build).
- **Groups**: everyone signs up on their own through the same link. A way to pair up groups is planned.
- **Privacy**: volunteer data is personal information. Keep it in the admin area only, use HTTPS everywhere, and don't collect more than you need.
- **Spam protection**: emailed codes are rate limited per email and per IP address, and each code allows 5 wrong guesses. Consider a CAPTCHA such as [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) if the forms are abused.

## Getting Started

Requires Node.js 20.9+ and a PostgreSQL database.

```bash
npm install                # also generates the Prisma client
cp .env.example .env       # then set DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate         # create the database tables
npm run admin:add -- you@example.org "Your Name"   # add yourself as an admin
npm run dev                # http://localhost:3000
```

**Emailed codes:** until `RESEND_API_KEY` and `EMAIL_FROM` are set, emails (admin sign-in codes, volunteer codes and confirmations) are printed in the terminal running `npm run dev` instead of sent. A production server refuses to start sending without them.

**Signing in:** admins go to `/login`. Volunteers never sign in: they open a form from `/`.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the tests (the placement solver's) |
| `npm run db:migrate` | Apply schema changes to the database (`prisma migrate dev`) |
| `npm run db:studio` | Browse and edit data in Prisma Studio |
| `npm run admin:add -- <email> "<name>"` | Add an admin |
| `npm run seed:test` | Replace the test forms and builds, volunteers and signups (`-- --clean` only removes them; `-- --people 350` adds made-up volunteers). Test volunteers have `@example.org` emails. |

**Project layout**

- `prisma/schema.prisma`: database schema
- `src/app/page.tsx`: the public home page, listing published forms
- `src/app/signup/[formId]/`: a form's public page: the email step, the form itself, and a volunteer's signup with Update and Cancel
- `src/app/login/`: admin sign-in (email, then code)
- `src/app/admin/`: admin dashboard; `(dashboard)/` holds the pages that require signing in
- `src/lib/signup-forms/`: forms: when they're open, the builds they offer, and the admin Server Actions (which save a form's builds)
- `src/lib/form-builds.ts`, `src/lib/sections.ts`: validating the builds and sections the form editor sends
- `src/lib/form-signups/`: volunteers' signups: validation, the submit and cancel Server Actions, emails, and the admin rosters
- `src/lib/email-verification/`: volunteers' email codes and 2-hour sessions
- `src/lib/admin/`: the People page's search and queries
- `src/lib/drivers/`: driver approval status, the Drivers page's queries, and approve/decline/revoke
- `src/lib/placement/`: placing volunteers at builds: the solver, which decides whether a day can take a signup and who each build has room for, and loading a form's signups for it
- `src/lib/auth/`: admin sign-in (Better Auth config, `requireAdmin()`, the sign-in Server Actions, and code rate limits)
- `src/lib/time.ts`: Indiana time conversion and date formatting (build times are stored in UTC)
- `src/proxy.ts`: redirects signed-out visitors away from `/admin`
- `src/lib/email.ts`: sends email through Resend, or prints it locally
- `src/lib/prisma.ts`: shared database client (`import { prisma } from "@/lib/prisma"`)
- `src/components/ui/`: shadcn/ui components (add more with `npx shadcn@latest add <name>`)
- `src/generated/prisma/`: generated Prisma client (git-ignored)

## Roadmap

1. Set up Resend so codes and confirmations are emailed
2. Confirming placements in the app and emailing volunteers where they'll work
3. Pairing up groups that want to work together
4. More questions on the signup form
5. Messaging volunteers, such as when a build is cancelled
