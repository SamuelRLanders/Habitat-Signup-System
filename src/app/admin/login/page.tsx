import { redirect } from "next/navigation";
import { loginPath } from "@/lib/auth/redirects";

// The old admin sign-in address. Everyone signs in at /login now.
export default function AdminLoginPage() {
  redirect(loginPath("/admin"));
}
