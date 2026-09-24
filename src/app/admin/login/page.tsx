import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdmin } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>Admin sign in</h1>
          </CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
