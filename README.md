# Habitat Signup System

A web app that lets Habitat for Humanity staff schedule volunteer shifts for home builds and lets the public sign up for them, alone or as a group. Everyone signs in with a 6-digit code sent to their email, so there are no passwords, and a signup can't be made in someone else's name.

## Features

**For volunteers (sign in with an emailed code)**
- Browse upcoming builds and their shifts, with date, time, address, and open spots
- Sign up as an individual or as a group (one signup that takes several spots). Details are saved and filled in next time.
- Volunteers must be 18 or older for now
- Sign the waiver online by scrolling through it and typing their full legal name
- Get a confirmation email with the shift details
- See upcoming and past shifts, cancel a shift, and change a group's size on their own page (`/me`)
- Group leaders get a waiver link to send their group. Members sign without an account, and the leader sees who has signed and when.

**For admins (sign in with an emailed code, admin role required)**
- Create builds (name, address, time zone) and add volunteer shifts to them (date, time, spots, notes)
- Publish, close, or cancel a build's signups
- View each shift's volunteers, including group members who signed through a group link, with phone numbers and text consent
- View everyone who has signed in
- Send email or SMS messages to everyone signed up for a shift
- Manage waiver text and versions
- Manage admin accounts

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript | One codebase for the public site, admin dashboard, and API |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) | Clean, accessible components that are quick to build with |
| Database | PostgreSQL (hosted on [Neon](https://neon.tech) or [Supabase](https://supabase.com)) | Relational data (builds ↔ shifts ↔ signups ↔ volunteers); free tiers available |
| ORM | [Prisma](https://www.prisma.io) | Type-safe queries and schema migrations |
| Auth | [Better Auth](https://better-auth.com) with 6-digit email codes | No passwords to manage; codes work on phones, where email links often open in another browser; built-in Prisma support |
| Email | [Resend](https://resend.com) + [React Email](https://react.email) | Transactional email with templates written as React components |
| SMS | [Twilio](https://www.twilio.com) | Standard SMS provider; handles opt-out (STOP) automatically |
| Validation | [Zod](https://zod.dev) | Shared validation for forms and server actions |
| Hosting | [Vercel](https://vercel.com) | Zero-config deploys for Next.js, with preview URLs for every branch |

## Data Model

- **User**: anyone who has signed in, with a role (volunteer or admin). Admins are made with `npm run admin:add`.
- **VolunteerProfile**: a user's saved details: name, phone, home address, emergency contact, birthday, text consent, and optionally sex and T-shirt size
- **LoginCodeRequest**: recent sign-in code requests, used to limit how often codes are sent
- **Build**: a home being built: name, address, description, time zone, and status (draft, published, closed, cancelled)
- **Shift**: a block of time at a build: start/end time, number of spots, notes. Shifts with signups are cancelled rather than deleted.
- **Registration**: one submission of the signup form: the leader (or individual), the group name and size (spots taken on each shift), and for groups, the secret token behind the waiver link
- **Signup**: a registration's spot on one shift, with its status. Each shift can be cancelled on its own.
- **GroupMember**: someone who signed the waiver through a group's link: legal name, birthday, phone, and text consent. Group members don't have accounts.
- **Waiver**: versioned waiver text; one version is active at a time
- **WaiverAcceptance**: an immutable record of a user or group member signing a waiver version for a registration, with the typed name, time, IP address, and browser
- **Message**: record of emails and texts sent by admins

## Design Principles

- **Sleek**: minimal, uncluttered layouts that use Habitat branding
- **Usable**: signup takes no more than a few steps, works well on phones, and meets WCAG 2.1 AA accessibility
- **Clear**: plain language, visible capacity and requirements, and obvious confirmation states

## Key Considerations

- **Waivers**: store an immutable record for every acceptance (waiver version, timestamp, typed name, IP address). The waiver loaded now is a sample, not a legal document: replace it with Habitat's real waiver, and have Habitat's legal contact approve the waiver flow. Minors (not allowed yet) would need a parent or guardian to accept.
- **Group signups**: the leader signs for themselves, and each member signs their own through the group's link. Group membership changes often, so the leader sees who has signed rather than a "complete" status.
- **Past headcounts**: a group's size is stored once per registration, so changing it also changes its past shifts' headcounts. Freezing each shift's headcount when it ends is planned along with attendance records.
- **SMS compliance**: text only volunteers who opted in, and honor STOP. US business texting requires A2P 10DLC registration through Twilio. **Approval can take weeks, so start it early.**
- **Privacy**: volunteer data is personal information. Keep it in the admin area only, use HTTPS everywhere, and don't collect more than you need.
- **Spam protection**: sign-in codes are rate limited per email and per IP address. Consider a CAPTCHA such as [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) on the sign-in form if it's abused.

## Getting Started

Requires Node.js 20.9+ and a PostgreSQL database (a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) project works).

```bash
npm install                # also generates the Prisma client
cp .env.example .env       # then set DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate         # create the database tables
npm run admin:add -- you@example.org "Your Name"   # add yourself as an admin
npm run waiver:seed -- scripts/sample-waiver.txt "Sample Volunteer Waiver (Not a Legal Document)"
npm run dev                # http://localhost:3000
```

**Signing in:** go to `/login` and enter your email. Until `RESEND_API_KEY` is set, the 6-digit code is printed in the terminal running `npm run dev` instead of emailed. Admins land on `/admin`, volunteers on `/me`. Signups stay closed until a waiver has been added.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Apply schema changes to the database (`prisma migrate dev`) |
| `npm run db:studio` | Browse and edit data in Prisma Studio |
| `npm run admin:add -- <email> "<name>"` | Make someone an admin (creates their account, or upgrades a volunteer's) |
| `npm run waiver:seed -- <file> "<title>"` | Add a new waiver version from a text file and make it the active one |
| `npm run seed:test` | Replace the test builds, shifts, volunteers, and signups (`-- --clean` only removes them). Test users have `@example.org` emails. |

**Project layout**

- `prisma/schema.prisma`: database schema
- `src/app/`: pages and routes (Next.js App Router)
- `src/components/ui/`: shadcn/ui components (add more with `npx shadcn@latest add <name>`)
- `src/app/login/`: the sign-in page for everyone (email, then code)
- `src/app/admin/`: admin dashboard; `(dashboard)/` holds the pages that require the admin role
- `src/app/builds/[buildId]/`: signup page for a build (the link behind the admin "Share" button)
- `src/app/me/`: a volunteer's own pages: signups, their details, and their groups' waivers
- `src/app/waiver/[token]/`: the group waiver page members open from their leader's link
- `src/lib/builds/`: build and shift queries and Server Actions
- `src/lib/signups/`: the signup form's queries, Server Action (validation, age check, and shift capacity check), and confirmation email
- `src/lib/me/`, `src/lib/waivers/`: queries and Server Actions for volunteers' pages and group waivers
- `src/lib/profile.ts`: the rules for a volunteer's details, shared by the signup form and the details page
- `src/lib/time.ts`: time zone conversion and date formatting (shift times are stored in UTC)
- `src/lib/auth/`: sign-in (Better Auth config, `requireUser()` and `requireAdmin()`, the sign-in Server Actions, and code rate limits)
- `src/proxy.ts`: redirects signed-out visitors away from `/admin` and `/me`
- `src/lib/email.ts`: sends email through Resend, or prints it locally
- `src/lib/prisma.ts`: shared database client (`import { prisma } from "@/lib/prisma"`)
- `src/generated/prisma/`: generated Prisma client (git-ignored)

## Roadmap

1. Scaffold the Next.js app, database schema, and admin login
2. Admin: create and manage builds and shifts
3. Volunteer accounts, signups, waivers, confirmation emails, and group signups
4. Admin messaging (email, then SMS)
5. Reminders, roster export, attendance, and reporting
