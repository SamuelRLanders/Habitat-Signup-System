import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { formatPhone } from "@/lib/phone";
import { getProfileDefaults } from "@/lib/signups/queries";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your details" };

// The volunteer's saved contact and emergency details, used to fill in the
// signup form.
export default async function ProfilePage() {
  const user = await requireUser("/me/profile");
  const profile = await getProfileDefaults(user.id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Your details</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}. These details fill in the signup form for
          you, and Habitat uses them to reach you about your shifts.
        </p>
      </div>
      <ProfileForm
        defaults={
          profile && {
            ...profile,
            phone: formatPhone(profile.phone),
            emergencyContactPhone: formatPhone(profile.emergencyContactPhone),
          }
        }
      />
    </>
  );
}
