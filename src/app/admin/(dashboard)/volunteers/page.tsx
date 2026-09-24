import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Volunteers" };

export default async function VolunteersPage() {
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Volunteers</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          The volunteer database is coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
