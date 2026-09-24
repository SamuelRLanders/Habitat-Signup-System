import { redirect } from "next/navigation";

// /admin has no page of its own. Builds is the first tab.
export default function AdminHomePage() {
  redirect("/admin/builds");
}
