# Habitat Signup System

A web app for the Purdue Habitat for Humanity chapter. Volunteer organization leaders (the admins) schedule shifts on home builds and publish one signup form per build day. Volunteers open the form from the home page or a shared link, confirm their email with a 6-digit code, and say which of the day's shifts they could work. Volunteers don't need an account, and only admins sign in.

## Features

**For volunteers (no account needed)**
- See published build days on the home page, each with its shifts, builds and addresses
- Before a form opens, look over the day; after it closes, see that it's closed
- Confirm an email address with an emailed 6-digit code, remembered on that browser for 2 hours
- Fill out the form: name, phone, birthday, T-shirt size, driver's license, and every shift that day they could work. Read the form's sections, such as which waivers to sign and links to them.
- Volunteers must be 18 or older on the build day
- Details are filled in from their last signup
- Update their signup while the form is open, and cancel it until the day's first shift starts, with an email each time

**For admins (sign in with an emailed code)**
- Create builds (name, address, time zone) and add shifts to them (date, time, spots, notes)
- Create one signup form per build day, with open and close times, a description and sections. A form offers every shift on its day, at every build, that isn't cancelled.
- Publish and share a form's link. A day takes at most as many signups as its shifts have spots.
- See each form's volunteers, the shifts each could work, how many are willing to work each shift, and T-shirt and driver's license totals. Download them as a CSV with a column per shift.
- See who's willing to work each shift
- Search and filter every volunteer on the People page, and download them as a CSV
- Cancel and restore builds and shifts. Cancelled ones disappear from forms, and volunteers' choices of them come back if they're restored.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript | One codebase for the public site and admin dashboard |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) | Clean, accessible components that are quick to build with |
| Database | PostgreSQL (hosted on [Supabase](https://supabase.com)) | Relational data (builds ↔ shifts ↔ forms ↔ volunteers) |
| ORM | [Prisma](https://www.prisma.io) | Type-safe queries and schema migrations |
| Admin auth | [Better Auth](https://better-auth.com) with 6-digit email codes | No passwords to manage; codes work on phones, where email links often open in another browser |
| Email | [Resend](https://resend.com) | Sign-in codes and signup confirmations |
| Validation | [Zod](https://zod.dev) | Shared validation for forms and Server Actions |
| Hosting | [Vercel](https://vercel.com) | Zero-config deploys for Next.js |

## Data Model

- **User**: an admin. Admins are added with `npm run admin:add`; volunteers don't have accounts.
- **LoginCodeRequest**: recent requests for emailed codes (admin sign-in and volunteer email checks), used to limit how often codes are sent
- **Build**: a home being built: name, address, description, time zone, status (active or cancelled), and the name of the admin who created it
- **Shift**: a block of time at a build: start/end time, number of spots, notes. Shifts volunteers chose are cancelled rather than deleted.
- **SignupForm**: the form for one build day (one per date): open and close times, draft or published, a description. Its shifts are every shift on its day that isn't cancelled.
- **FormSection**: a heading and text shown on a form, in order, such as a waiver link
- **Volunteer**: someone who has signed up, identified by the email they confirmed, with their latest details
- **FormSignup**: a volunteer's signup for a build day, with a copy of the details they submitted for it. Cancelling keeps the row.
- **ShiftPreference**: a shift a volunteer said they could work
- **VolunteerCode**, **VolunteerSession**: the codes volunteers confirm their email with, and the 2-hour browser sessions that follow (both stored hashed)
- **Message**, **MessageRecipient**: for emails admins will send to volunteers (not built yet)

## Key Considerations

- **Waivers**: signed outside the app. Admins add a section to each form linking each waiver, with instructions for filling it out. The app doesn't track who has signed them.
- **Placing volunteers**: volunteers say which shifts they could work; admins place them. Placing is done outside the app for now (the form's CSV has a column per shift), and an assignment tool is planned.
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
| `npm run db:migrate` | Apply schema changes to the database (`prisma migrate dev`) |
| `npm run db:studio` | Browse and edit data in Prisma Studio |
| `npm run admin:add -- <email> "<name>"` | Add an admin |
| `npm run seed:test` | Replace the test builds, shifts, forms, volunteers and signups (`-- --clean` only removes them; `-- --people 350` adds made-up volunteers). Test volunteers have `@example.org` emails. |

**Project layout**

- `prisma/schema.prisma`: database schema
- `src/app/page.tsx`: the public home page, listing published forms
- `src/app/signup/[formId]/`: a form's public page: the email step, the form itself, and a volunteer's signup with Update and Cancel
- `src/app/login/`: admin sign-in (email, then code)
- `src/app/admin/`: admin dashboard; `(dashboard)/` holds the pages that require signing in
- `src/lib/signup-forms/`: forms: when they're open, the shifts they offer, and the admin Server Actions
- `src/lib/form-signups/`: volunteers' signups: validation, the submit and cancel Server Actions, emails, and the admin rosters
- `src/lib/email-verification/`: volunteers' email codes and 2-hour sessions
- `src/lib/builds/`: build and shift queries and Server Actions
- `src/lib/admin/`: the People page's search and queries
- `src/lib/auth/`: admin sign-in (Better Auth config, `requireAdmin()`, the sign-in Server Actions, and code rate limits)
- `src/lib/time.ts`: time zone conversion and date formatting (shift times are stored in UTC)
- `src/proxy.ts`: redirects signed-out visitors away from `/admin`
- `src/lib/email.ts`: sends email through Resend, or prints it locally
- `src/lib/prisma.ts`: shared database client (`import { prisma } from "@/lib/prisma"`)
- `src/components/ui/`: shadcn/ui components (add more with `npx shadcn@latest add <name>`)
- `src/generated/prisma/`: generated Prisma client (git-ignored)

## Roadmap

1. Set up Resend so codes and confirmations are emailed
2. Placing volunteers on shifts from their choices
3. Pairing up groups that want to work together
4. More questions on the signup form
5. Messaging volunteers, such as when a build or shift is cancelled
