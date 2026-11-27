import { getAdmin } from "@/lib/auth/dal";
import { readContextFile } from "../context-file";

// Downloads CONTEXT.md, the description of the app for AI assistants, from
// the Help page. Admins only, like the rest of the admin pages.
export async function GET() {
  // Answer with a status rather than requireAdmin()'s redirect, since this
  // is a file download, not a page.
  if (!(await getAdmin())) {
    return new Response("Sign in as an admin to download this file.", { status: 401 });
  }

  return new Response(await readContextFile(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="CONTEXT.md"',
      "Cache-Control": "private, no-store",
    },
  });
}
