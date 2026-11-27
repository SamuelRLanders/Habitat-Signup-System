import { redirect } from "next/navigation";

// /admin/data has no page of its own. Statistics is the first tab.
export default function DataPage() {
  redirect("/admin/data/statistics");
}
