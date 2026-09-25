// Makes someone an admin who can use the dashboard. If they've already
// signed in as a volunteer, their account is upgraded.
// Usage: npm run admin:add -- someone@example.org "Their Name"
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [emailArg, ...nameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const name = nameParts.join(" ").trim();

if (!email || !email.includes("@") || !name) {
  console.error('Usage: npm run admin:add -- someone@example.org "Their Name"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.role === "ADMIN") {
    console.log(`${email} is already an admin.`);
  } else if (existing) {
    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log(`Made ${email} an admin.`);
  } else {
    await prisma.user.create({ data: { email, name, role: "ADMIN" } });
    console.log(`Added ${name} <${email}> as an admin.`);
  }
} finally {
  await prisma.$disconnect();
}
