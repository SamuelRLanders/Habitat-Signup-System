// Fills the database with test builds, shifts, signup forms, volunteers and
// their signups, for trying the app by hand. Everything it makes is marked
// so it can be removed: builds are named "[Test] …", signup forms'
// descriptions start with "[Test] ", and volunteers have @example.org
// emails. Running it again replaces the old test data. Real data is never
// touched.
//
// Usage: npm run seed:test                 (replace the test data)
//        npm run seed:test -- --people 350 (also add 350 made-up volunteers,
//                                           for trying the People search)
//        npm run seed:test -- --clean      (only remove it)
//
// Volunteers don't sign in. To try signing up, open a form with any
// @example.org address: until RESEND_API_KEY is set, codes print in the
// terminal running `npm run dev`.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { TShirtSize } from "../src/generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TEST_DOMAIN = "@example.org";
const TEST_PREFIX = "[Test] ";
const SITE = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// A time in Indiana (Eastern) on a date, as UTC. Good enough for test data:
// Eastern is UTC-4 until Nov 1, 2026 and UTC-5 after.
function at(date: string, hour: number) {
  const offset = date >= "2026-11-01" || date < "2026-03-08" ? 5 : 4;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour + offset));
}

const day = (date: string) => new Date(`${date}T00:00:00Z`);

async function clean() {
  const testEmail = { endsWith: TEST_DOMAIN };
  const testForm = { description: { startsWith: TEST_PREFIX } };
  // Signups and driver approvals block deleting their forms and
  // volunteers, so they go first.
  await prisma.formSignup.deleteMany({
    where: { OR: [{ form: testForm }, { volunteer: { email: testEmail } }] },
  });
  await prisma.driverApproval.deleteMany({ where: { volunteer: { email: testEmail } } });
  const volunteers = await prisma.volunteer.deleteMany({ where: { email: testEmail } });
  const builds = await prisma.build.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  const forms = await prisma.signupForm.deleteMany({ where: testForm });
  await prisma.volunteerCode.deleteMany({ where: { email: testEmail } });
  await prisma.volunteerSession.deleteMany({ where: { email: testEmail } });
  await prisma.loginCodeRequest.deleteMany({ where: { email: testEmail } });
  console.log(
    `Removed ${builds.count} test builds, ${forms.count} test forms and ${volunteers.count} test volunteers.`,
  );
}

type Person = {
  first: string;
  last: string;
  shirt: TShirtSize;
  license: boolean;
  birthday: string;
};

function details(person: Person) {
  return {
    firstName: person.first,
    lastName: person.last,
    phone: `+1765555${String(Math.floor(1000 + Math.random() * 9000))}`,
    dateOfBirth: day(person.birthday),
    tShirtSize: person.shirt,
    hasDriversLicense: person.license,
  };
}

async function seed() {
  const admin = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!admin) {
    console.error('No admin yet. Add one first: npm run admin:add -- you@example.org "Your Name"');
    process.exit(1);
  }

  // ── Builds and shifts (each build has one shift a day)
  const shift = (date: string, start: number, end: number, capacity: number, notes?: string) => ({
    startsAt: at(date, start),
    endsAt: at(date, end),
    capacity,
    notes,
  });
  const createBuild = (data: {
    name: string;
    address: string;
    description?: string;
    shifts: ReturnType<typeof shift>[];
  }) =>
    prisma.build.create({
      data: {
        name: TEST_PREFIX + data.name,
        address: data.address,
        description: data.description,
        createdByName: admin.name,
        createdById: admin.id,
        shifts: { create: data.shifts },
      },
      include: { shifts: { orderBy: { startsAt: "asc" } } },
    });

  const maple = await createBuild({
    name: "Maple Street Home",
    address: "412 Maple St, Lafayette, IN 47904",
    description: "A three-bedroom home for the Rivera family. We're framing walls and raising the roof trusses this month.\n\nWear closed-toe shoes. Lunch is provided on Saturdays.",
    shifts: [
      shift("2026-10-10", 8, 12, 12, "Framing. No experience needed."),
      shift("2026-10-17", 8, 12, 10),
      shift("2026-10-24", 8, 14, 15, "Roof trusses. Must be comfortable on ladders."),
    ],
  });
  await createBuild({
    name: "Riverside Duplex",
    address: "88 Riverside Dr, West Lafayette, IN 47906",
    description: "Interior finishing on a duplex: drywall, painting, and trim.",
    shifts: [
      shift("2026-11-07", 9, 13, 6),
      shift("2026-11-14", 9, 15, 8, "Painting day. Wear clothes you don't mind getting paint on."),
      shift("2026-11-21", 9, 13, 4),
    ],
  });
  await createBuild({
    name: "Oak Avenue Repair",
    address: "1520 Oak Ave, Lafayette, IN 47905",
    description: "Porch and ramp repair for a veteran's home. Still being planned.",
    shifts: [shift("2026-12-05", 9, 13, 5), shift("2026-12-12", 9, 13, 5)],
  });
  await createBuild({
    name: "Elm Court Landscaping",
    address: "7 Elm Ct, Lafayette, IN 47909",
    description: "Final landscaping before the family moves in.",
    shifts: [shift("2026-10-31", 9, 12, 8)],
  });
  // Already happened, so it shows under past builds.
  const summer = await createBuild({
    name: "Summer Blitz Build",
    address: "300 Harrison St, Lafayette, IN 47901",
    shifts: [shift("2026-08-15", 8, 12, 20), shift("2026-08-22", 8, 12, 20)],
  });
  // Shares build days with Maple, so those days' forms span two builds.
  const cedar = await createBuild({
    name: "Cedar Lane Home",
    address: "2210 Cedar Ln, West Lafayette, IN 47906",
    description: "Exterior siding on a new home.",
    shifts: [
      shift("2026-10-10", 9, 15, 8, "Siding. We'll teach you to use the tools."),
      shift("2026-10-17", 9, 15, 8),
    ],
  });

  // ── Signup forms, one per build day. Days left without one show a
  // "Create one" link on their build's page.
  const waivers = [
    { position: 0, title: "Purdue waiver", body: "Sign the Purdue volunteer waiver before your shift: https://example.org/purdue-waiver\n\nUnder “Organization”, choose Habitat for Humanity." },
    { position: 1, title: "Chapter waiver", body: "Also sign the chapter's waiver at https://example.org/chapter-waiver. Use your full legal name." },
  ];
  const createForm = async (data: {
    date: string;
    status: "DRAFT" | "PUBLISHED";
    opens: [string, number];
    closes: [string, number];
    description: string;
    sections?: typeof waivers;
  }) => {
    // Forms are one per day, so leave a day alone if it has a real form.
    if (await prisma.signupForm.findUnique({ where: { date: day(data.date) } })) {
      console.log(`Skipped the ${data.date} test form: that day already has a form.`);
      return null;
    }
    return prisma.signupForm.create({
      data: {
        date: day(data.date),
        status: data.status,
        opensAt: at(...data.opens),
        closesAt: at(...data.closes),
        description: TEST_PREFIX + data.description,
        createdByName: admin.name,
        createdById: admin.id,
        sections: { create: data.sections ?? [] },
      },
    });
  };
  const oct10 = await createForm({
    date: "2026-10-10",
    status: "PUBLISHED",
    opens: ["2026-09-28", 9],
    closes: ["2026-10-08", 22],
    description: "Two builds this Saturday. Meet at your build's address 15 minutes before your shift starts.",
    sections: waivers,
  });
  await createForm({
    date: "2026-10-17",
    status: "PUBLISHED",
    opens: ["2026-10-11", 9],
    closes: ["2026-10-15", 22],
    description: "Opens the Sunday before.",
    sections: waivers,
  });
  await createForm({
    date: "2026-11-07",
    status: "DRAFT",
    opens: ["2026-10-20", 9],
    closes: ["2026-11-05", 22],
    description: "Still being planned.",
  });
  const aug15 = await createForm({
    date: "2026-08-15",
    status: "PUBLISHED",
    opens: ["2026-08-01", 9],
    closes: ["2026-08-13", 22],
    description: "Summer blitz kickoff.",
  });

  // ── Volunteers and their signups. Each signup copies the volunteer's
  // details, as the real form does.
  const volunteer = (email: string, person: Person) =>
    prisma.volunteer.create({ data: { email: email + TEST_DOMAIN, ...details(person) } });
  const signUp = async (
    who: Awaited<ReturnType<typeof volunteer>>,
    form: { id: string } | null,
    shifts: { id: string }[],
    transportation: "NEEDS_RIDE" | "OWN_WAY" | "CAN_DRIVE",
    cancelled = false,
  ) => {
    if (!form) return;
    const { firstName, lastName, phone, dateOfBirth, tShirtSize, hasDriversLicense } = who;
    await prisma.formSignup.create({
      data: {
        firstName,
        lastName,
        phone,
        dateOfBirth,
        tShirtSize,
        hasDriversLicense,
        transportation,
        carSeats: transportation === "CAN_DRIVE" ? who.carSeats : null,
        formId: form.id,
        volunteerId: who.id,
        cancelledAt: cancelled ? new Date() : null,
        preferences: { create: shifts.map((s) => ({ shiftId: s.id })) },
      },
    });
  };

  const alice = await volunteer("alice", { first: "Alice", last: "Nguyen", shirt: "S", license: true, birthday: "1992-04-11" });
  const ben = await volunteer("ben", { first: "Ben", last: "Okafor", shirt: "L", license: true, birthday: "1985-09-02" });
  const carmen = await volunteer("carmen", { first: "Carmen", last: "Diaz", shirt: "M", license: false, birthday: "1978-01-23" });
  const dana = await volunteer("dana", { first: "Dana", last: "Reyes", shirt: "XL", license: true, birthday: "2004-12-01" });
  const eli = await volunteer("eli", { first: "Eli", last: "Brooks", shirt: "XL", license: true, birthday: "2000-06-30" });

  // Drivers: Alice is approved, Ben and Eli are waiting for approval (Eli
  // asked after a past approval ran out), and Dana has a license but hasn't
  // filled out Purdue's form.
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const approve = (who: { id: string }, until: string, ago: number) =>
    prisma.driverApproval.create({
      data: {
        volunteerId: who.id,
        decision: "APPROVED",
        requestedAt: daysAgo(ago + 5),
        decidedAt: daysAgo(ago),
        approvedUntil: day(until),
        decidedByName: admin.name,
        decidedById: admin.id,
      },
    });
  await approve(alice, "2027-06-30", 90);
  await approve(eli, "2026-09-15", 380);
  await prisma.volunteer.update({ where: { id: alice.id }, data: { carSeats: 5 } });
  await prisma.volunteer.update({ where: { id: ben.id }, data: { driverRequestedAt: daysAgo(3), carSeats: 7 } });
  await prisma.volunteer.update({ where: { id: eli.id }, data: { driverRequestedAt: daysAgo(1), carSeats: 0 } });
  const withCar = async (who: { id: string }) => prisma.volunteer.findUniqueOrThrow({ where: { id: who.id } });

  const [mapleOct10] = maple.shifts;
  const [cedarOct10] = cedar.shifts;
  await signUp(await withCar(alice), oct10, [mapleOct10, cedarOct10], "CAN_DRIVE");
  await signUp(await withCar(ben), oct10, [mapleOct10], "CAN_DRIVE");
  await signUp(carmen, oct10, [cedarOct10], "NEEDS_RIDE");
  await signUp(await withCar(eli), oct10, [mapleOct10, cedarOct10], "OWN_WAY");
  await signUp(dana, oct10, [mapleOct10], "NEEDS_RIDE", true);
  await signUp(alice, aug15, [summer.shifts[0]], "OWN_WAY");
  await signUp(carmen, aug15, [summer.shifts[0]], "NEEDS_RIDE");

  console.log(`
Test data created. See it at ${SITE}/admin/forms, ${SITE}/admin/builds
and ${SITE}/admin/people. Volunteers see published forms at ${SITE}/.

Signup forms:
  Sat, Oct 10   open; Maple and Cedar Lane shifts; waivers; 4 signups
                and 1 cancelled
  Sat, Oct 17   published, opens Oct 11
  Sat, Nov 7    draft
  Sat, Aug 15   past, 2 signups

Builds: Maple Street Home, Riverside Duplex, Oak Avenue Repair, Elm Court
Landscaping, Summer Blitz Build (past) and Cedar Lane Home (shares days
with Maple).

Volunteers: alice, ben, carmen, dana and eli @example.org. Open the Oct 10
form with one of them to see, update or cancel their signup.

Drivers (${SITE}/admin/drivers): Alice approved through Jun 30, 2027;
Ben and Eli pending (Eli's earlier approval expired Sep 15); Dana has a
license but isn't approved.

Remove it all with: npm run seed:test -- --clean`);
}

// Lots of made-up volunteers with a spread of details and first-signup
// dates. Their emails are person0001@example.org and so on, so clean()
// removes them too.
async function seedPeople(count: number) {
  const firstNames = ["Olivia", "Emma", "Ava", "Sophia", "Mia", "Harper", "Amelia", "Grace", "Zoe", "Lucia", "Nora", "Maya", "Aisha", "Hannah", "Chloe", "Liam", "Noah", "James", "Lucas", "Mateo", "Ethan", "Henry", "Owen", "Samuel", "Jamal", "Wei", "Diego", "Caleb", "Isaac", "Leo"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "O'Brien", "Müller"];
  const sizes: TShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  const now = Date.now();
  const twoYears = 2 * 365 * 24 * 60 * 60 * 1000;

  const volunteers = [];
  for (let i = 1; i <= count; i++) {
    const birthYear = 1950 + Math.floor(Math.random() * 58);
    const createdAt = new Date(now - Math.random() * twoYears);
    volunteers.push({
      email: `person${String(i).padStart(4, "0")}${TEST_DOMAIN}`,
      firstName: pick(firstNames),
      lastName: pick(lastNames),
      phone: `+1765${String(2000000 + Math.floor(Math.random() * 7999999))}`,
      dateOfBirth: new Date(Date.UTC(birthYear, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28))),
      tShirtSize: pick(sizes),
      hasDriversLicense: Math.random() < 0.7,
      createdAt,
      updatedAt: createdAt,
    });
  }
  await prisma.volunteer.createMany({ data: volunteers });
  console.log(`
Added ${count} made-up volunteers (person0001${TEST_DOMAIN} and on) for the People search.`);
}

try {
  await clean();
  if (!process.argv.includes("--clean")) {
    await seed();
    const peopleArg = process.argv.indexOf("--people");
    if (peopleArg !== -1) await seedPeople(Number(process.argv[peopleArg + 1]) || 350);
  }
} finally {
  await prisma.$disconnect();
}
