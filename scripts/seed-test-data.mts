// Fills the database with test builds, shifts, volunteers, and signups, for
// trying the app by hand. Everything it makes is marked so it can be removed:
// builds are named "[Test] …" and users have @example.org emails. Running it
// again replaces the old test data. Real data is never touched.
//
// Usage: npm run seed:test            (replace the test data)
//        npm run seed:test -- --clean (only remove it)
//
// Until RESEND_API_KEY is set, sign-in codes print in the dev server's
// terminal, so you can sign in as any of these test users.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Sex, TShirtSize } from "../src/generated/prisma/enums";

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

async function clean() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true },
  });
  const builds = await prisma.build.findMany({
    where: { name: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const buildIds = builds.map((b) => b.id);
  // Registrations for test builds or by test users. Waiver records block
  // deletes on purpose, so they go first.
  const registrations = {
    OR: [{ buildId: { in: buildIds } }, { leaderId: { in: userIds } }],
  };
  await prisma.waiverAcceptance.deleteMany({ where: { registration: registrations } });
  await prisma.groupMember.deleteMany({ where: { registration: registrations } });
  await prisma.signup.deleteMany({ where: { registration: registrations } });
  await prisma.registration.deleteMany({ where: registrations });
  await prisma.build.deleteMany({ where: { id: { in: buildIds } } });
  await prisma.loginCodeRequest.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`Removed ${builds.length} test builds and ${users.length} test users.`);
}

type Person = {
  first: string;
  last: string;
  sex?: Sex;
  shirt?: TShirtSize;
  sms?: boolean;
  birthday: string;
};

async function makeUser(email: string, person: Person | null) {
  return prisma.user.create({
    data: {
      email,
      name: person ? `${person.first} ${person.last}` : "",
      emailVerified: true,
      profile: person
        ? {
            create: {
              firstName: person.first,
              lastName: person.last,
              phone: `+1765555${String(Math.floor(1000 + Math.random() * 9000))}`,
              smsOptIn: person.sms ?? false,
              smsOptInAt: person.sms ? new Date() : null,
              address: "123 Test St, Lafayette, IN 47901",
              emergencyContactName: "Test Contact",
              emergencyContactPhone: "+17655550100",
              dateOfBirth: new Date(`${person.birthday}T00:00:00Z`),
              sex: person.sex,
              tShirtSize: person.shirt,
            },
          }
        : undefined,
    },
  });
}

async function seed() {
  const waiver = await prisma.waiver.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
  });
  if (!waiver) {
    console.error(
      'No active waiver. Add one first: npm run waiver:seed -- scripts/sample-waiver.txt "Sample Volunteer Waiver (Not a Legal Document)"',
    );
    process.exit(1);
  }
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    console.error('No admin yet. Add one first: npm run admin:add -- you@example.org "Your Name"');
    process.exit(1);
  }

  // ── Builds and shifts
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
    status: "DRAFT" | "PUBLISHED" | "CLOSED";
    shifts: ReturnType<typeof shift>[];
  }) =>
    prisma.build.create({
      data: {
        name: TEST_PREFIX + data.name,
        address: data.address,
        description: data.description,
        status: data.status,
        createdById: admin.id,
        shifts: { create: data.shifts },
      },
      include: { shifts: { orderBy: { startsAt: "asc" } } },
    });

  const maple = await createBuild({
    name: "Maple Street Home",
    address: "412 Maple St, Lafayette, IN 47904",
    description: "A three-bedroom home for the Rivera family. We're framing walls and raising the roof trusses this month.\n\nWear closed-toe shoes. Lunch is provided on Saturdays.",
    status: "PUBLISHED",
    shifts: [
      shift("2026-10-10", 8, 12, 12, "Framing. No experience needed."),
      shift("2026-10-10", 13, 17, 12),
      shift("2026-10-17", 8, 12, 10),
      shift("2026-10-17", 13, 17, 10),
      shift("2026-10-24", 8, 14, 15, "Roof trusses. Must be comfortable on ladders."),
    ],
  });
  const riverside = await createBuild({
    name: "Riverside Duplex",
    address: "88 Riverside Dr, West Lafayette, IN 47906",
    description: "Interior finishing on a duplex: drywall, painting, and trim.",
    status: "PUBLISHED",
    shifts: [
      shift("2026-11-07", 9, 13, 6),
      shift("2026-11-07", 13, 17, 6),
      shift("2026-11-14", 9, 15, 8, "Painting day. Wear clothes you don't mind getting paint on."),
      shift("2026-11-21", 9, 13, 4),
    ],
  });
  await createBuild({
    name: "Oak Avenue Repair",
    address: "1520 Oak Ave, Lafayette, IN 47905",
    description: "Porch and ramp repair for a veteran's home. Still being planned.",
    status: "DRAFT",
    shifts: [shift("2026-12-05", 9, 13, 5), shift("2026-12-12", 9, 13, 5)],
  });
  const elm = await createBuild({
    name: "Elm Court Landscaping",
    address: "7 Elm Ct, Lafayette, IN 47909",
    description: "Final landscaping before the family moves in. Signups are full.",
    status: "CLOSED",
    shifts: [shift("2026-10-31", 9, 12, 8)],
  });
  // Already happened, so it shows under past shifts.
  const summer = await createBuild({
    name: "Summer Blitz Build",
    address: "300 Harrison St, Lafayette, IN 47901",
    status: "PUBLISHED",
    shifts: [shift("2026-08-15", 8, 12, 20), shift("2026-08-22", 8, 12, 20)],
  });

  // ── Users. Dana has no saved details, to try the first-time flow.
  const alice = await makeUser(`alice${TEST_DOMAIN}`, { first: "Alice", last: "Nguyen", sex: "FEMALE", shirt: "S", sms: true, birthday: "1992-04-11" });
  const ben = await makeUser(`ben${TEST_DOMAIN}`, { first: "Ben", last: "Okafor", sex: "MALE", shirt: "L", sms: true, birthday: "1985-09-02" });
  const carmen = await makeUser(`carmen${TEST_DOMAIN}`, { first: "Carmen", last: "Diaz", shirt: "M", birthday: "1978-01-23" });
  await makeUser(`dana${TEST_DOMAIN}`, null);
  const eli = await makeUser(`eli${TEST_DOMAIN}`, { first: "Eli", last: "Brooks", sex: "MALE", shirt: "XL", sms: false, birthday: "2000-06-30" });

  // ── Signups
  const register = async ({
    user,
    signedName,
    build,
    shifts,
    size = 1,
    groupName,
  }: {
    user: { id: string };
    signedName: string;
    build: { id: string };
    shifts: { id: string }[];
    size?: number;
    groupName?: string;
  }) => {
    const registration = await prisma.registration.create({
      data: {
        buildId: build.id,
        leaderId: user.id,
        size,
        groupName: size > 1 ? groupName : null,
        waiverToken: size > 1 ? randomBytes(18).toString("base64url") : null,
        signups: { create: shifts.map((s) => ({ shiftId: s.id, userId: user.id })) },
      },
    });
    await prisma.waiverAcceptance.create({
      data: { signedName, waiverId: waiver.id, registrationId: registration.id, userId: user.id },
    });
    return registration;
  };
  const memberSigns = async (registrationId: string, legalName: string, birthday: string, sms: boolean) => {
    const member = await prisma.groupMember.create({
      data: {
        registrationId,
        legalName,
        dateOfBirth: new Date(`${birthday}T00:00:00Z`),
        phone: `+1317555${String(Math.floor(1000 + Math.random() * 9000))}`,
        smsOptIn: sms,
        smsOptInAt: sms ? new Date() : null,
      },
    });
    await prisma.waiverAcceptance.create({
      data: { signedName: legalName, waiverId: waiver.id, registrationId, groupMemberId: member.id },
    });
  };

  // Alice: on her own, two Maple shifts, and a past one.
  await register({ user: alice, signedName: "Alice M. Nguyen", build: maple, shifts: [maple.shifts[0], maple.shifts[2]] });
  await register({ user: alice, signedName: "Alice M. Nguyen", build: summer, shifts: [summer.shifts[0]] });

  // Ben: leads a youth group of 6 at Maple and Riverside. Three have signed.
  const youth = await register({
    user: ben,
    signedName: "Benjamin Okafor",
    build: maple,
    shifts: [maple.shifts[0], maple.shifts[4]],
    size: 6,
    groupName: "Lafayette Youth Group",
  });
  await memberSigns(youth.id, "Grace Kim", "1999-02-14", true);
  await memberSigns(youth.id, "Marcus Hall", "2001-11-03", false);
  await memberSigns(youth.id, "Priya Shah", "1998-07-19", true);
  await register({
    user: ben,
    signedName: "Benjamin Okafor",
    build: riverside,
    shifts: [riverside.shifts[2]],
    size: 4,
    groupName: "Lafayette Youth Group",
  });

  // Carmen: one Riverside shift, which nearly fills it, and a past shift.
  await register({ user: carmen, signedName: "Carmen R. Diaz", build: riverside, shifts: [riverside.shifts[3]] });
  await register({ user: carmen, signedName: "Carmen R. Diaz", build: summer, shifts: [summer.shifts[1]] });

  // Eli: leads a group of 3 nobody else has signed for yet.
  const eliGroup = await register({
    user: eli,
    signedName: "Elijah Brooks",
    build: riverside,
    shifts: [riverside.shifts[0], riverside.shifts[1]],
    size: 3,
    groupName: "Brooks Family",
  });

  // Fill up the closed build.
  await register({ user: carmen, signedName: "Carmen R. Diaz", build: elm, shifts: [elm.shifts[0]], size: 8, groupName: "Diaz Landscaping Crew" });

  const youthLink = `${SITE}/waiver/${youth.waiverToken}`;
  const eliLink = `${SITE}/waiver/${eliGroup.waiverToken}`;
  console.log(`
Test data created. Sign in at ${SITE}/login with any of these emails;
the 6-digit code prints in the dev server's terminal.

  alice@example.org   Individual: 2 upcoming Maple shifts, 1 past shift
  ben@example.org     Group leader: youth group of 6 (3 members signed) at
                      Maple, and a group of 4 at Riverside
  carmen@example.org  Individual at Riverside, a past shift, and a full
                      8-person crew on the closed Elm Court build
  dana@example.org    New account with no saved details, no signups
  eli@example.org     Group leader: group of 3 at Riverside, nobody signed yet

Group waiver links (open signed out, or in a private window):
  Ben's youth group:  ${youthLink}
  Eli's family:       ${eliLink}

Builds (admin: ${SITE}/admin/builds):
  Maple Street Home      ${SITE}/builds/${maple.id}
  Riverside Duplex       ${SITE}/builds/${riverside.id}
  Oak Avenue Repair      draft, admins only
  Elm Court Landscaping  closed to signups
  Summer Blitz Build     past shifts only

Remove it all with: npm run seed:test -- --clean`);
}

try {
  await clean();
  if (!process.argv.includes("--clean")) await seed();
} finally {
  await prisma.$disconnect();
}
