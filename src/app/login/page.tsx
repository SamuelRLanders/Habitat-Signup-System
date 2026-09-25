import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUser } from "@/lib/auth/dal";
import { homePath, safeNextPath } from "@/lib/auth/redirects";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Habitat for Humanity Sign Up Portal" };

// Sign-in for volunteers and admins. ?next= is where to go afterwards, such
// as the build page the volunteer came from.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);

  const user = await getUser();
  if (user) redirect(next ?? homePath(user.role ?? "VOLUNTEER"));

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>Habitat for Humanity Sign In Portal</h1>
          </CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a 6-digit code. New
            volunteers get an account automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
