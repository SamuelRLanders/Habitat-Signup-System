// Adds an admin who can sign in and use the dashboard. Volunteers don't
// have accounts, so everyone added here is an admin. The owner usually
// adds admins on the Admins page instead; this script sends no email.
// Usage: npm run admin:add -- someone@example.org "Their Name" [editor|viewer]
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const USAGE = 'Usage: npm run admin:add -- someone@example.org "Their Name" [editor|viewer]';

const [emailArg, ...rest] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
// A last word of editor or viewer is the role; it's an editor otherwise.
const last = rest.at(-1)?.trim().toLowerCase();
const roleArg = last === "editor" || last === "viewer" ? last : null;
const name = (roleArg ? rest.slice(0, -1) : rest).join(" ").trim();
const role = roleArg === "viewer" ? "VIEWER" : "EDITOR";

if (!email || !email.includes("@") || !name) {
  console.error(USAGE);
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} is already an admin (${existing.role.toLowerCase()}).`);
  } else {
    await prisma.user.create({ data: { email, name, role } });
    console.log(`Added ${name} <${email}> as an ${role.toLowerCase()}.`);
  }
} finally {
  await prisma.$disconnect();
}
