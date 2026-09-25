// Adds a new waiver version from a text file and makes it the one volunteers
// sign. Earlier versions are kept, since signatures point to them.
// Usage: npm run waiver:seed -- path/to/waiver.txt "Volunteer Release and Waiver"
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [path, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(" ").trim();

if (!path || !title) {
  console.error(
    'Usage: npm run waiver:seed -- path/to/waiver.txt "Volunteer Release and Waiver"',
  );
  process.exit(1);
}

const body = (await readFile(path, "utf8")).trim();
if (!body) {
  console.error(`${path} is empty.`);
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const waiver = await prisma.$transaction(async (tx) => {
    const latest = await tx.waiver.findFirst({ orderBy: { version: "desc" } });
    await tx.waiver.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    return tx.waiver.create({
      data: {
        version: (latest?.version ?? 0) + 1,
        title,
        body,
        isActive: true,
      },
    });
  });
  console.log(`Added "${waiver.title}" as version ${waiver.version}. It's now active.`);
} finally {
  await prisma.$disconnect();
}
