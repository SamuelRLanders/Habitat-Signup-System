import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Confirm sign in" };

// The page the emailed link opens. Signing in only happens when the admin
// clicks the button, because email scanners open links but don't submit forms.
export default async function VerifyPage({
  searchParams,
}: PageProps<"/admin/login/verify">) {
  const { token } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>Confirm sign in</h1>
          </CardTitle>
          <CardDescription>
            Sign in to the Habitat volunteer admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typeof token === "string" && token ? (
            <VerifyForm token={token} />
          ) : (
            <p className="text-sm">
              This sign-in link is incomplete.{" "}
              <a href="/admin/login" className="text-primary underline underline-offset-4">
                Request a new link
              </a>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
