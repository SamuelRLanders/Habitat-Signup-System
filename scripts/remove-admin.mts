// Removes an admin, such as an officer who has stepped down. They're signed
// out everywhere at once, since their sessions are deleted with them. The
// forms they created and the driver decisions they made are kept, with their
// name. The last admin can't be removed, so someone can always sign in.
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
  } else if ((await prisma.user.count()) === 1) {
    console.error(`${email} is the only admin. Add another with npm run admin:add before removing them.`);
    process.exitCode = 1;
  } else {
    await prisma.user.delete({ where: { id: admin.id } });
    console.log(`Removed ${admin.name || email} <${email}> as an admin, and signed them out.`);
  }

  const left = await prisma.user.findMany({ orderBy: { email: "asc" }, select: { email: true, name: true } });
  console.log(`\nAdmins now (${left.length}):`);
  for (const { email, name } of left) console.log(`  ${name || "(no name)"} <${email}>`);
} finally {
  await prisma.$disconnect();
}
