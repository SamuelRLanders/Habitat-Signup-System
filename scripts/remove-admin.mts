// Removes an admin, such as an officer who has stepped down. They're signed
// out everywhere at once, since their sessions are deleted with them. The
// forms they created and the driver decisions they made are kept, with their
// name, and the owner takes over the upcoming builds they were responsible
// for. The owner can't be removed: make someone else the owner first
// (on the Admins page, or with admin:set-owner).
// Usage: npm run admin:remove -- someone@example.org
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:remove -- someone@example.org");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    console.log(`${email} isn't an admin.`);
  } else if (admin.role === "OWNER") {
    console.error(`${email} is the owner. Make someone else the owner first, with npm run admin:set-owner.`);
    process.exitCode = 1;
  } else {
    // As on the Admins page, the owner takes over the upcoming builds they
    // were responsible for (src/lib/admins/queries.ts, upcomingBuild).
    const owner = await prisma.user.findFirst({ where: { role: "OWNER" }, select: { id: true } });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" });
    const [handed] = await prisma.$transaction([
      prisma.shift.updateMany({
        where: {
          responsibleId: admin.id,
          cancelledAt: null,
          form: { status: { not: "CANCELLED" }, date: { gte: new Date(`${today}T00:00:00Z`) } },
        },
        data: { responsibleId: owner?.id ?? null },
      }),
      prisma.user.delete({ where: { id: admin.id } }),
    ]);
    console.log(`Removed ${admin.name || email} <${email}> as an admin, and signed them out.`);
    if (handed.count > 0) {
      console.log(`The owner is now responsible for the ${handed.count} upcoming builds they were responsible for.`);
    }
  }

  const left = await prisma.user.findMany({ orderBy: { email: "asc" }, select: { email: true, name: true } });
  console.log(`\nAdmins now (${left.length}):`);
  for (const { email, name } of left) console.log(`  ${name || "(no name)"} <${email}>`);
} finally {
  await prisma.$disconnect();
}
