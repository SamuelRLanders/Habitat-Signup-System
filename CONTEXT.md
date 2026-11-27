# Habitat Signup System: context for AI assistants

> **What this file is.** A description of the Purdue Habitat for Humanity signup app: what it's for, how it's set up, what every feature does, and how admins are meant to use it. Upload it to an AI assistant at the start of a chat, then ask questions about the app, such as "How do I reserve a spot for someone?" or "Why does a build show as full when it has empty spots?".
>
> **Instructions for the AI reading this.** Answer questions about the app from this file. Use the app's own words (build, event, form, waitlist, reserved spot, planned and confirmed assignments), and name the page, tab and button the admin should use. If this file doesn't cover something, say so rather than guessing, and suggest asking the app's owner or reading the code on GitHub. Most people asking are student volunteer leaders, not programmers: answer in plain language unless they ask about the code. Never ask them to paste in volunteers' personal details (names, phone numbers, emails, birthdays); you don't need them to answer.

---

## 1. What the app is for

The app runs volunteer signups for the **Purdue Habitat for Humanity** student chapter.

- **Admins** (the chapter's leaders) create one **signup form** per build day, listing that day's builds. Only admins sign in.
- **Volunteers** open a form from the home page or a shared link, confirm their email with a 6-digit code, fill out the form, and say which of the day's builds they could work at. Volunteers never make an account or a password.
- The app works out whether everyone who signs up can be **placed** at a build with a ride, holds spots for drivers, runs **waitlists**, and gives admins the **assignments** (who goes where), the **travel roster** Purdue needs, and **statistics** afterwards.

Waivers are **not** signed in the app. Admins add a section to each form linking each waiver (Purdue's, the chapter's, or others), with instructions. The app doesn't track who has signed them.

## 2. Words the app uses

| Word | Meaning |
|---|---|
| **Build** | One group working at one address on a day, with a start and end time, a number of volunteer spots, and an admin responsible for it. (In the code and database a build is called a `Shift`.) |
| **Event** / **build day** | A day with one or more builds. |
| **Signup form** (or just **form**) | What volunteers fill out for an event. It has a name, the event day, open and close times, a description, sections, options and its builds. A day can have several separate forms, such as one for an outside group. |
| **Section** | A heading and text on a form, such as a waiver link with instructions. Volunteers step through each one. Links in the text are clickable. |
| **Placement** | The app's plan for which build each volunteer goes to, following the placement rules (section 6). |
| **Rider / own way / driver** | How a volunteer is getting there: needs a ride, getting there on their own, or can drive others in their car. |
| **Held spot** | A spot kept open for a driver who hasn't signed up yet, because riders need seats. |
| **Waitlist** | People waiting for a full build. They're added automatically while the form is open if room opens up. |
| **Reserved spot** | A spot an editor holds at a build for one named person (by email). |
| **Responsible admin** | The admin (editor or owner) in charge of organizing a build. |
| **Planned assignments** | Where everyone is going, until the day's first build starts. |
| **Confirmed assignments** | Where everyone actually went, from the moment the day's first build starts. Admins correct these, including no-shows, and they feed the Data page. |
| **No-show** | Someone placed at a build who didn't come and didn't cancel. |
| **Experience** | How many builds someone has done: **New** 0, **Low** 1–2, **Moderate** 3–5, **High** 6 or more. |

## 3. Who can do what (admin roles)

Every admin signs in at `/login` with their email and an emailed 6-digit code. There are three roles:

- **Owner** (exactly one): everything an editor can do, plus the **Admins** page: add admins (they're emailed a welcome), make them editors or viewers, remove them, and transfer ownership. The owner also gets the email when the site nears its daily email limit, and (with the responsible admin) the alert when a volunteer cancels after a form closes.
- **Editor**: sees and changes forms, signups, assignments, people and drivers. Can be a build's responsible admin.
- **Viewer**: sees every admin page and can copy emails and download CSVs, but can't change anything.

**Transferring ownership:** on the Admins page, the owner picks another admin, who is emailed a link that works for 7 days. Nothing changes until that admin opens the link, signed in as themselves, and chooses **Accept ownership**. They then become the owner and the old owner becomes an editor (and is emailed). The owner can cancel the transfer until it's accepted.

When an admin is removed or made a viewer, any upcoming builds they were responsible for go to the owner, and the confirm dialog says so.

## 4. The admin pages

The admin area is at `/admin`. Its tabs along the top are **Forms**, **Data**, **Drivers**, **Admins** (owner only) and **Help**. The header also has **Volunteer site** (the public home page, as volunteers see it) and **Sign out**.

### 4.1 Forms

Lists signup forms under **Upcoming** and **Past**. Editors see **New form**.

**A form's status (its badge):**

- **Draft**: only admins can see it.
- **Not open yet**: published, so volunteers can see it, but they can't fill it out until it opens.
- **Open**: volunteers can sign up.
- **Closed**: past its close time. Nobody new can sign up. People who signed up can still cancel until the day's first build starts.
- **Passed**: closed, and the event day is over (admins only; volunteers just see closed).
- **Cancelled**: an admin cancelled the event. Final, can't be undone.

**Creating or editing a form** (Edit form). Fields:

- **Name**, **Event day**, **Opens** and **Closes** (date and time, Indiana time), **Description**.
- **Options** (switches):
  - **List on the home page**: off, the form is only reachable through its link (for an outside group, say).
  - **Ask how volunteers are getting there**: off, nobody is asked about rides or driver approval, and everyone counts as getting there on their own (for a group with its own transport).
  - **Let volunteers ask to work with friends**: the friends step on the form.
  - **Let volunteers join a waitlist for full builds** (on by default).
  - **Email admins when a volunteer cancels after the form closes** (on by default).
- **Sections**: headings and text shown on the form, in order, such as each waiver.
- **Builds**: each with a name, address, start and end time, volunteer spots, description, lunch note, responsible admin, and reserved spots (see 4.1.5). A build volunteers already chose is cancelled rather than deleted when removed: it disappears from the form, and volunteers' choices come back if it's restored.

**Form actions** (top of a form's page): **Share** (the link and a copy button, once published), **Edit form**, **Publish** / **Unpublish**, **Delete** (drafts only; deletes the form, builds and sections), **Cancel event**.

- Unpublishing hides the form; signups are kept, but volunteers can't see or cancel them until it's published again.
- **Cancel event** makes the form say the event is off and stops signups. It emails nobody: download the volunteer list from the Volunteers tab to contact people.

A volunteer can only be signed up on **one form per day**.

#### 4.1.1 Overview tab

Each build with its spots, how many volunteers could work there, who's likely going there, and a summary such as "4 need a ride · 1 driver, 4 seats for riders · 2 on their own · 1 highly experienced · 1 spot held for a driver". It also lists reserved spots and whether each person has signed up yet, how many more drivers are needed, and anyone who can't be placed. Once the form closes, each build has **Copy emails** (the emails of everyone going there, for an email's To or Bcc).

#### 4.1.2 Volunteers tab

Everyone signed up: their details, the builds each could work at, friends they asked for (and whether the assignments keep them together), experience, driver status and transport. Totals for T-shirt sizes, experience, and rides and seats. **Download CSV** (a column per build). People who cancelled are listed separately.

#### 4.1.3 Waitlist tab

Shown when the form has a waitlist, or anyone is still on it. Everyone waiting, in the order they joined, with contact details, transport and the full builds they'd take. While the form is open they're added automatically when room opens up. After it closes, admins add them by moving them on the Assignments tab.

#### 4.1.4 Assignments tab

A board with a column per build, plus **Not placed**, **Waitlist** (when anyone's waiting) and, on confirmed assignments, **No-shows**. Each volunteer is a card with a **Move** menu (works with a mouse, keyboard or touch screen). Anyone can look at it at any time; nobody can be moved until the form closes. Viewers can't move anyone.

- **Planned assignments** (until the day's first build starts). Before an admin saves anything, the board shows the app's placement. Once the form closes, editors can move people and save; saving lists anything that breaks the placement rules (such as a rider without a seat), which the admin can save anyway. Saved assignments are marked custom; **Revert to default** goes back to the app's placement. Moving someone from the waitlist onto a build adds them when saved; they aren't emailed, so check with them first. Reserved spots nobody has signed up with show faded at their build; after close, editors can add that person there (if they've signed up for anything before, so the app has their details).
- **Confirmed assignments** (from the moment the day's first build starts). The planned assignments are copied as they were then, and admins correct them to show who actually went where: mark **no-shows**, move people, and use **Add volunteer** for someone who came without signing up (they start in Not placed). The placement rules don't apply. **Revert to planned** goes back to the planned assignments. These stay editable; a cancelled event's are read-only.
- **Copy travel roster**: copies Purdue's travel roster for the day (who's going to each build, who's driving whom, phone numbers), from the current assignments, with warnings about anything to check before sending it. If the browser won't copy, a popup shows it to copy by hand.

#### 4.1.5 Reserved spots

In the form editor, each build shows **Reserved: N** and **Reserve a spot**. An editor searches for the volunteer, or types the Purdue email of someone who has never signed up. Rules:

- A reserved spot comes out of the build's spots: general volunteers only get spots minus reserved, and the public form only shows those.
- One reservation per person per day. A build must have room for it ("raise its spots first"). People already signed up or on the waitlist for the form can't be given one.
- Nobody is emailed. Use **Copy form link** to send the person the form yourself.
- Once the form is published, the person can sign up with it, even **before the form opens**. They see "A spot is held for you at …"; that build is chosen and locked, and they fill out the rest as normal. They're always accepted, even as a rider with no driver; admins are warned on the Assignments tab and the travel roster.
- Unclaimed reservations are held until an editor removes them. A reserved person who cancels releases the spot. Either way, while the form is open, the waitlist runs.
- Admins can still move a reserved person on the board.

### 4.2 Data

Three tabs. Every admin, viewers included, sees all of it.

- **Statistics**: for a time range (presets or custom dates), from events that are over: people who volunteered, spots filled (and % full), volunteer hours (from each build's times), events and builds, new and returning volunteers, cancellations, left on the waitlist, and no-shows. Charts: ages on the build day, volunteers each month, how volunteers got to the site, experience levels, T-shirt sizes, most builds. Then each event and how full it was. Attendance comes from each event's confirmed assignments: anyone placed counts as having gone unless marked a no-show. There are no gender statistics, by design.
- **People**: search and filter everyone who has signed up (nothing is listed until you search or filter). Click a row for details: their latest information, builds done (editors can edit the count, such as for builds before the app; later builds still add on), no-shows, and their signups. **Download CSV**.
- **Builds**: search and filter every build, past or upcoming. Click a row for its details, including who went. **Download CSV**.

### 4.3 Drivers

Purdue requires drivers to be approved. Volunteers with a license are asked on the form whether they've filled out Purdue's driver approval form; saying yes makes them **pending**. Only pending or approved drivers with a car of at least 3 seats (counting the driver's) can offer to drive others.

- **Pending** drivers: check with Purdue, then **Approve** through an end date (filled in as a year after they asked) or **Decline**.
- **Approved** drivers: **Revoke** ends an approval early.
- **Add driver**: put a volunteer who hasn't asked into pending.
- **Auto approve**: download `ApprovedDrivers.xlsx` from Purdue's SharePoint (it needs a Purdue sign-in), upload it here, and approve the matches (by email, or by name to double-check) with Purdue's end dates. Approved drivers Purdue has renewed can be extended. The file isn't kept.

Every decision records the admin's name. Drivers aren't emailed about decisions; their next signup form shows their status.

### 4.4 Help

Where this file lives: **Download CONTEXT.md** or **Copy text**, with how to use it with an AI assistant, and **View on GitHub** for the app's code. Every admin can open it.

### 4.5 Admins (owner only)

The admins, their roles, add/remove/role changes, and ownership transfer (see section 3).

## 5. What volunteers see

- **Home page** (`/`): published, listed forms, from before they open until the day's first build starts (closed ones with a "Closed" badge).
- **A form's page** (`/signup/<id>`): the build details, then:
  1. **Confirm your email**: a 6-digit code is emailed. The browser remembers the email for 2 hours. Codes are rate limited and each allows 5 wrong guesses.
  2. **The form**, in steps (each unlocks after the one before):
     - **Your information**: name, phone, birthday, T-shirt size, driver's license. Filled in from their last signup. Volunteers must be **18 or older** on the build day.
     - **Driver approval** (if they have a license and the form asks about transport).
     - **Getting to the site**: need a ride, own way, or can drive others (drivers only).
     - **Your car** (if driving others): seats.
     - **Builds you could work at**: every build they could do. Builds without room for them, given how they're getting there, are marked with why (for example "Only accepting people willing to drive others"). On a waitlist form, full builds can be chosen to wait for, but not mixed with builds that have room.
     - **Friends to work with** (if the form asks, and the day has more than one build): Purdue emails of friends to be placed with.
     - **Each section**, such as each waiver.
  3. **Their signup**, with **Cancel**. Signups can't be edited: to change one, cancel and sign up again while the form is open.
- After the form closes, signed-up volunteers can still sign in (behind a button) and cancel until the day's first build starts. After that the page just says the day has started.
- A cancelled event's page only says the event is cancelled.

Volunteers only ever get one kind of email: their 6-digit codes. They are **not** emailed when they sign up, cancel, come off the waitlist, get a reserved spot, or when an event is cancelled. Admins contact volunteers themselves.

## 6. How placement works (why a build can look full)

Volunteers don't pick one build; they list every build they could work at, and the app keeps a plan (a "placement") that puts everyone at one of their choices. A **new signup is accepted only if there's still a plan that places everyone**, including them, where:

1. **Room**: at each build, the volunteers placed there plus the spots held for drivers fit in its spots.
2. **Rides**: every rider has a seat in the car of a driver placed at the same build, or in a car still being waited for.

Riders can sign up before there are enough drivers: for every 3 riders without a seat (or fewer, for the last car), **one spot is held for a driver**, assuming a 4-seat car. Only a driver can take a held spot. Pending drivers count as drivers.

So a build can be **full for some volunteers and not others**: it might take a driver or someone getting there on their own, but not another rider. Example: a build with 10 spots has 6 riders, 2 own-way volunteers and no drivers. The 6 riders need 2 cars, so 2 spots are held: 6 + 2 + 2 = 10, full for everyone but drivers.

Because volunteers can be moved between their choices, whether a build has room depends on everyone's choices, not just how many people chose that build.

After the rules, the plan tries (in order) to send **someone highly experienced** (6+ builds) to every build, then to **keep friends together**. These never decide whether someone can sign up.

Reserved spots sit outside this: they come off the build's spots first, and a reserved person is placed at their build regardless.

A form that doesn't ask about transport treats everyone as getting there on their own, so only spots matter.

## 7. The waitlist

- On a form with the waitlist switch on, a volunteer whose chosen builds are all full can join the waitlist for them instead ("If you join the waitlist for any build(s), you won't be placed immediately, but if someone cancels you will be added automatically and contacted.").
- Waiting people aren't counted, placed, exported or included in copied emails.
- **While the form is open**: when someone cancels, an admin raises a build's spots, a reservation is removed, or someone joins the waitlist, the app goes through the waitlist in join order and adds anyone who now fits at a build they chose. They aren't emailed; admins contact them.
- **After the form closes**: admins move waitlisted people onto builds on the Assignments tab.
- Turning the waitlist switch off stops new people joining; those already waiting stay and are still added.
- Volunteers leave the waitlist with Cancel. They aren't shown their place in line.

## 8. Emails

The app sends email through Resend, whose free plan allows **100 emails a day** (UTC days). The app counts every email.

Emails the app sends:

- Volunteers' and admins' 6-digit codes.
- To a new admin when the owner adds them; the ownership transfer link; and to the old owner when a transfer is accepted.
- When a volunteer cancels **after a form closes** (and before the build), to that build's responsible admin and the owner (once if the same person), with what it changes for rides and the build's waitlist. Only if the form's cancellation emails switch is on.
- To the owner, once, when the day's count reaches 85.

At **85 emails in a day**, emails volunteers set off (their codes) stop until the next day, keeping the last 15 for admins' sign-in codes. Before any admin action that sends email, the confirm dialog says who'll be emailed and warns if it would pass the limit.

## 9. How it's built (for developers)

| Part | Choice |
|---|---|
| Framework | Next.js (App Router, version 16) with TypeScript and React 19 |
| UI | Tailwind CSS and shadcn/ui components (Base UI) |
| Database | PostgreSQL on Supabase, through Prisma (Prisma owns the migrations; row-level security is on, with no policies, for every table) |
| Admin sign-in | Better Auth with emailed 6-digit codes |
| Email | Resend |
| Validation | Zod |
| Placement | An integer program solved with the `yalps` library (`src/lib/placement/solver.ts`), checked step by step after solving |
| Hosting | Vercel. The `main` branch is the live site; work happens on other branches (currently `version-2`) |

All times are **Indiana time** (stored in UTC). Every admin page and Server Action checks the admin's role on the server, so viewers can't change anything even outside the UI.

**Where things are:**

- `prisma/schema.prisma`: the database schema, with comments on every table.
- `src/app/page.tsx`: the public home page. `src/app/signup/[formId]/`: a form's public page.
- `src/app/login/`: admin sign-in.
- `src/app/admin/(dashboard)/`: the admin pages (forms, data, drivers, help, admins).
- `src/lib/signup-forms/`: forms and their admin actions. `src/lib/form-signups/`: volunteers' signups, waitlist, emails and rosters.
- `src/lib/placement/`: the placement solver and loading a form's signups for it.
- `src/lib/data/`: the Data page's statistics and searches, and saving the planned assignments when the first build starts.
- `src/lib/drivers/`: driver approvals and Purdue's driver list.
- `src/lib/auth/`: sign-in and role checks (`requireAdmin()`, `requireEditor()`, `requireOwner()`).
- `src/lib/email.ts`, `src/lib/email-limit.ts`: sending and counting email.
- `scripts/`: command-line scripts to add or remove admins, set the owner, and seed test data.

**Main tables:** `User` (admins), `SignupForm`, `Shift` (builds), `FormSection`, `Volunteer` (one per email, with their latest details), `FormSignup` (a volunteer's signup for a form, with waitlist, assignment, planned build and no-show fields), `ShiftPreference` (builds a volunteer could work at), `GroupRequest` (friends), `Reservation` (reserved spots), `DriverApproval`, `VolunteerCode` / `VolunteerSession` (volunteers' email codes and 2-hour sessions), `EmailDay` (emails sent each day), `OwnershipTransfer`.

The README in the repository has setup steps and the list of commands.

## 10. Common questions

**How do I set up a build day?** Forms → New form. Fill in the name, day, open and close times and description; add a section for each waiver; add each build with its address, times, spots and responsible admin. Save, check it, then Publish and Share the link.

**Can I run a separate signup for an outside group on the same day?** Yes: make another form for that day, turn off "List on the home page", and send them its link. Turn off the transport question if they bring their own. Each volunteer can still only be on one form per day.

**A build shows full but has empty spots.** Spots are probably held for drivers (section 6), or reserved for named people (4.1.5). The Overview tab shows held and reserved spots, and how many more drivers are needed.

**Someone needs to change their signup.** They cancel and sign up again while the form is open. After it closes, an admin moves them on the Assignments tab.

**How do I guarantee someone a spot?** Edit form → the build → Reserve a spot, then Copy form link and send it to them.

**Someone came who didn't sign up.** On the confirmed assignments (from the day's first build onward), use Add volunteer, then move them to the build they went to.

**Someone didn't show up.** On the confirmed assignments, move them to No-shows.

**How do I email everyone going to a build?** Once the form closes, use Copy emails on the build (Overview tab), and paste them into your own email's Bcc.

**How do I send Purdue the travel roster?** Assignments tab → Copy travel roster, check its warnings, and paste it into your email.

**Will volunteers get an email when…?** Almost never: they only get their sign-in codes. Contact them yourself.

**I'm a viewer and can't change anything.** That's the viewer role. Ask the owner to make you an editor.

## 11. Not built yet

- Emailing or texting volunteers from the app (the `Message` tables exist for it, unused).
- Signing waivers in the app (they're linked from form sections instead).
- Clearing out old builds: confirmed assignments stay editable indefinitely for now.
