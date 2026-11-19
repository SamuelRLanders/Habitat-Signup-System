// Makes an admin the owner straight away, without the emailed link the
// Admins page uses. For setting up the first owner, or recovering when the
// owner can't sign in. The old owner, if any, becomes an editor. Sends no
// email.
// Usage: npm run admin:set-owner -- someone@example.org
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:set-owner -- someone@example.org");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    console.error(`${email} isn't an admin. Add them first with npm run admin:add.`);
    process.exitCode = 1;
  } else if (admin.role === "OWNER") {
    console.log(`${email} is already the owner.`);
  } else {
    // Demote first: the database allows only one owner at a time.
    await prisma.$transaction([
      prisma.user.updateMany({ where: { role: "OWNER" }, data: { role: "EDITOR" } }),
      prisma.user.update({ where: { id: admin.id }, data: { role: "OWNER" } }),
      prisma.ownershipTransfer.deleteMany({}),
    ]);
    console.log(`${admin.name || email} <${email}> is now the owner. The old owner, if any, is now an editor.`);
  }
} finally {
  await prisma.$disconnect();
}
