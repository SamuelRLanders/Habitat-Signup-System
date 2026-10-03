import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdmin } from "@/lib/auth/dal";
import { ADMIN_HOME, safeNextPath } from "@/lib/auth/redirects";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in" };

// Sign-in for admins. ?next= is where to go afterwards, such as the admin
// page they were sent here from.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);

  if (await getAdmin()) redirect(next ?? ADMIN_HOME);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm border-t-4 border-gold">
        <CardHeader>
          <CardTitle>
            <h1>Purdue Habitat Admin</h1>
          </CardTitle>
          <CardDescription>
            Enter your admin email and we&apos;ll send you a 6-digit code.
            Volunteering? You don&apos;t need to sign in.{" "}
            <Link href="/" className="text-primary underline underline-offset-4">
              Find a signup form
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
