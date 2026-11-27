import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// CONTEXT.md, at the top of the repository: a description of the app for
// admins to give an AI assistant, so they can ask it about the app. Keep it
// up to date when features change. next.config.ts includes it in the
// deployed files for the Help page and its download.
export function readContextFile() {
  return readFile(path.join(process.cwd(), "CONTEXT.md"), "utf8");
}

// Where the Help page downloads it from (./CONTEXT.md/route.ts).
export const CONTEXT_FILE_PATH = "/admin/help/CONTEXT.md";
