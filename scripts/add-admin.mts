// Adds an admin who can log in to the dashboard.
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
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} is already an admin.`);
  } else {
    await prisma.admin.create({ data: { email, name } });
    console.log(`Added ${name} <${email}> as an admin.`);
  }
} finally {
  await prisma.$disconnect();
}
