# Habitat Signup System

A web app that lets Habitat for Humanity staff publish volunteer opportunities and lets the public sign up for them, alone or as a group, without creating an account.

## Features

**For volunteers (no login required)**
- Browse upcoming opportunities with date, location, open spots, and requirements
- Sign up as an individual or as a group (group leader enters the group size and member details)
- Accept the liability waiver online as part of signup
- Get a confirmation email with event details, a calendar invite, and a private link to view or cancel the signup

**For admins (login required)**
- Create, edit, duplicate, and close volunteer opportunities (capacity, shifts, minimum age, location, notes)
- View and export rosters, including waiver status for each volunteer
- Send email or SMS messages to everyone signed up for an opportunity
- Manage waiver text and versions
- Manage admin accounts

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript | One codebase for the public site, admin dashboard, and API |
| UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) | Clean, accessible components that are quick to build with |
| Database | PostgreSQL (hosted on [Neon](https://neon.tech) or [Supabase](https://supabase.com)) | Relational data (opportunities ↔ signups ↔ volunteers); free tiers available |
| ORM | [Prisma](https://www.prisma.io) | Type-safe queries and schema migrations |
| Admin auth | [Better Auth](https://better-auth.com) with email magic links | No admin passwords to manage; built-in Prisma support |
| Email | [Resend](https://resend.com) + [React Email](https://react.email) | Transactional email with templates written as React components |
| SMS | [Twilio](https://www.twilio.com) | Standard SMS provider; handles opt-out (STOP) automatically |
| Validation | [Zod](https://zod.dev) | Shared validation for forms and server actions |
| Hosting | [Vercel](https://vercel.com) | Zero-config deploys for Next.js, with preview URLs for every branch |

## Data Model

- **Admin**: staff who can log in
- **Opportunity**: title, description, location, start/end time, capacity, minimum age, status
- **Volunteer**: name, email, phone, SMS opt-in, date of birth. Returning volunteers are matched by email.
- **Signup**: links a volunteer to an opportunity, with group size, group name, status, and a secret token for the manage/cancel link
- **GroupMember**: individual members listed under a group signup
- **Waiver**: versioned waiver text; one version is active at a time
- **WaiverAcceptance**: who accepted which waiver version, when, with typed signature, IP address, and guardian details for minors
- **Message**: record of emails and texts sent by admins

## Design Principles

- **Sleek**: minimal, uncluttered layouts that use Habitat branding
- **Usable**: signup takes no more than a few steps, works well on phones, and meets WCAG 2.1 AA accessibility
- **Clear**: plain language, visible capacity and requirements, and obvious confirmation states

## Key Considerations

- **Waivers**: store an immutable record for every acceptance (waiver version, timestamp, typed name, IP address). Minors need a parent or guardian to accept. Have Habitat's legal contact approve the waiver flow.
- **Group signups**: every adult in a group must accept the waiver. The leader can accept for themselves, and each member gets a link to accept their own.
- **SMS compliance**: text only volunteers who opted in, and honor STOP. US business texting requires A2P 10DLC registration through Twilio. **Approval can take weeks, so start it early.**
- **Privacy**: volunteer data is personal information. Keep it in the admin area only, use HTTPS everywhere, and don't collect more than you need.
- **Spam protection**: add rate limiting and a CAPTCHA such as [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) to the public signup form.

## Getting Started

Requires Node.js 20.9+ and a PostgreSQL database (a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) project works).

```bash
npm install                # also generates the Prisma client
cp .env.example .env       # then set DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate         # create the database tables
npm run admin:add -- you@example.org "Your Name"   # add yourself as an admin
npm run dev                # http://localhost:3000
```

**Signing in as an admin:** go to `/admin/login` and enter your email. Until `RESEND_API_KEY` is set, the sign-in link is printed in the terminal running `npm run dev` instead of emailed.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Apply schema changes to the database (`prisma migrate dev`) |
| `npm run db:studio` | Browse and edit data in Prisma Studio |
| `npm run admin:add -- <email> "<name>"` | Add an admin who can log in |

**Project layout**

- `prisma/schema.prisma`: database schema
- `src/app/`: pages and routes (Next.js App Router)
- `src/components/ui/`: shadcn/ui components (add more with `npx shadcn@latest add <name>`)
- `src/app/admin/`: admin dashboard; `(dashboard)/` holds the pages that require login
- `src/lib/auth/`: admin login (Better Auth config, `requireAdmin()`, and the login Server Actions)
- `src/proxy.ts`: redirects logged-out visitors away from `/admin`
- `src/lib/email.ts`: sends email through Resend, or prints it locally
- `src/lib/prisma.ts`: shared database client (`import { prisma } from "@/lib/prisma"`)
- `src/generated/prisma/`: generated Prisma client (git-ignored)

## Roadmap

1. Scaffold the Next.js app, database schema, and admin login
2. Admin: create and manage opportunities
3. Public: browse opportunities and sign up as an individual
4. Waiver acceptance and confirmation emails
5. Group signups
6. Admin messaging (email, then SMS)
7. Reminders, roster export, and reporting
