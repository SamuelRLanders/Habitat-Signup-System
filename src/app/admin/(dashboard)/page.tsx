import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function DashboardPage() {
  // Every admin page checks on its own. The layout's check doesn't re-run
  // when navigating between pages that share it.
  const admin = await requireAdmin();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2">
      <h1 className="text-2xl font-semibold">Welcome, {admin.name}</h1>
      <p className="text-muted-foreground">
        Opportunity management is coming next.
      </p>
    </div>
  );
}
