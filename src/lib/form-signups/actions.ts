"use server";

import { revalidatePath } from "next/cache";
import { driverStatuses } from "@/lib/drivers/status";
import { getVerifiedEmail } from "@/lib/email-verification/session";
import { firstErrors, formValues, type ActionState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { formPhase } from "@/lib/signup-forms/phase";
import { offeredShifts, totalSpots } from "@/lib/signup-forms/queries";
import { fromDay, toDay } from "@/lib/time";
import {
  carSeatsSchema,
  detailsSchema,
  driverFormSchema,
  oldEnoughOn,
  TOO_YOUNG,
  transportationSchema,
  type SignupField,
} from "./details";
import { sendCancellation, sendSignupConfirmation } from "./emails";
import { cancelDeadline } from "./queries";

// Volunteers signing up through a form and cancelling their signup. A
// signup can't be changed (that keeps placing drivers and riders simple):
// to change it, they cancel and sign up again. Anyone can post to these,
// so everything is checked here: the confirmed email comes from the
// session cookie, never the form, and the form has to be open (or, to
// cancel, its first shift not started).

export type SignupFormState = {
  errors?: Partial<Record<SignupField | "form", string>>;
  success?: boolean;
};

const SESSION_EXPIRED =
  "Your email confirmation has expired. Refresh the page and confirm your email again. Your answers will need to be re-entered.";

function revalidateSignup(formId: string) {
  revalidatePath(`/signup/${formId}`);
  revalidatePath("/admin", "layout");
}

// A published form with the shifts it offers, or null.
async function loadForm(formId: string) {
  const form = await prisma.signupForm.findUnique({
    where: { id: formId, status: "PUBLISHED" },
    select: { date: true, status: true, opensAt: true, closesAt: true },
  });
  if (!form) return null;
  const day = toDay(form.date);
  const shifts = (await offeredShifts([day])).get(day) ?? [];
  return { ...form, day, shifts };
}

// Signs up. Signing up again after cancelling counts as a new signup, but
// someone already signed up can't sign up again over it.
export async function submitSignup(
  formId: string,
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const email = await getVerifiedEmail();
  if (!email) return { errors: { form: SESSION_EXPIRED } };

  const form = await loadForm(formId);
  if (!form || formPhase(form) !== "open") {
    return { errors: { form: "This form isn't taking signups right now. Refresh the page to see why." } };
  }

  // ── Check the answers.
  const values = formValues(formData);
  const parsed = detailsSchema.safeParse(values);
  const shiftIds = [...new Set(formData.getAll("shiftId").map(String))];
  const errors: SignupFormState["errors"] = parsed.success ? {} : firstErrors(parsed.error);
  if (shiftIds.length === 0) errors.shifts = "Choose at least one build you could work at.";
  if (parsed.success && !oldEnoughOn(parsed.data.dateOfBirth, form.day)) {
    errors.dateOfBirth = TOO_YOUNG;
  }

  // Driving. Volunteers with a license who aren't approved or pending are
  // asked whether they've filled out Purdue's driver approval form; only
  // drivers who are approved or pending (counting a "yes" just now) can
  // offer to drive others, and then they give their car's seats.
  const hasLicense = values.hasDriversLicense === "yes";
  const known = await prisma.volunteer.findUnique({ where: { email }, select: { id: true } });
  const driver = known
    ? (await driverStatuses([known.id])).get(known.id)!
    : { status: "none" as const };
  const askDriverForm = hasLicense && driver.status === "none";
  const driverForm = askDriverForm ? driverFormSchema.safeParse(values.driverForm) : null;
  if (driverForm && !driverForm.success) errors.driverForm = driverForm.error.issues[0].message;
  const nowPending = driverForm?.success && driverForm.data === "done";

  const transportation = transportationSchema.safeParse(values.transportation);
  if (!transportation.success) errors.transportation = transportation.error.issues[0].message;
  const drives = transportation.success && transportation.data === "CAN_DRIVE";
  if (drives && !(hasLicense && (driver.status !== "none" || nowPending))) {
    errors.transportation =
      "Only volunteers with a driver's license who are approved or waiting for approval can drive others.";
  }
  const carSeats = drives ? carSeatsSchema.safeParse(values.carSeats) : null;
  if (carSeats && !carSeats.success) errors.carSeats = carSeats.error.issues[0].message;

  if (!parsed.success || !transportation.success || Object.keys(errors).length > 0) {
    return { errors };
  }
  const seats = carSeats?.success ? carSeats.data : null;

  const offered = new Map(form.shifts.map((shift) => [shift.id, shift]));
  if (!shiftIds.every((id) => offered.has(id))) {
    return {
      errors: {
        shifts: "One of the builds you chose is no longer offered that day. Refresh the page to see the current builds.",
      },
    };
  }

  const details = { ...parsed.data, dateOfBirth: fromDay(parsed.data.dateOfBirth) };
  const capacity = totalSpots(form.shifts);

  // ── Save, making sure a new signup still fits.
  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        // Lock the form until this transaction ends, so two people can't
        // both take its last spot.
        await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;

        const active = await tx.formSignup.findFirst({
          where: { formId, volunteer: { email }, cancelledAt: null },
          select: { id: true },
        });
        if (active) return { outcome: "already" as const };
        const taken = await tx.formSignup.count({ where: { formId, cancelledAt: null } });
        if (taken >= capacity) return { outcome: "full" as const };

        // Their latest details, for the next form they fill out. Saying
        // they've filled out the driver form makes their approval pending.
        const latest = {
          ...details,
          ...(nowPending && { driverRequestedAt: new Date() }),
          ...(seats !== null && { carSeats: seats }),
        };
        const volunteer = await tx.volunteer.upsert({
          where: { email },
          create: { email, ...latest },
          update: latest,
        });
        const answers = { ...details, transportation: transportation.data, carSeats: seats };
        const signup = await tx.formSignup.upsert({
          where: { formId_volunteerId: { formId, volunteerId: volunteer.id } },
          create: { formId, volunteerId: volunteer.id, ...answers },
          update: { ...answers, cancelledAt: null },
        });

        // Signing up again replaces every choice from the cancelled signup.
        await tx.shiftPreference.deleteMany({ where: { signupId: signup.id } });
        await tx.shiftPreference.createMany({
          data: shiftIds.map((shiftId) => ({ signupId: signup.id, shiftId })),
        });

        return { outcome: "saved" as const };
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    console.error("Signup failed", error);
    return { errors: { form: "Something went wrong saving your signup. Please try again in a moment." } };
  }

  if (result.outcome === "already") {
    revalidateSignup(formId);
    return {
      errors: {
        form: "You're already signed up for this day. To make changes, cancel your signup and sign up again.",
      },
    };
  }
  if (result.outcome === "full") {
    revalidateSignup(formId);
    return { errors: { form: "Sorry, this build day just filled up." } };
  }

  // The signup is saved, so a failed email doesn't undo it.
  try {
    await sendSignupConfirmation({
      to: email,
      firstName: details.firstName,
      formId,
      day: form.day,
      shifts: shiftIds.map((id) => offered.get(id)!),
    });
  } catch (error) {
    console.error("Failed to send signup confirmation", error);
  }

  revalidateSignup(formId);
  return { success: true };
}

export async function cancelSignup(formId: string): Promise<ActionState> {
  const email = await getVerifiedEmail();
  if (!email) return { error: SESSION_EXPIRED };

  const form = await loadForm(formId);
  const now = new Date();
  if (!form || now < form.opensAt || now >= cancelDeadline(form.day, form.shifts)) {
    return { error: "Signups for this day can't be cancelled here anymore. Please contact the organizers." };
  }

  const signup = await prisma.formSignup.findFirst({
    where: { formId, volunteer: { email }, cancelledAt: null },
    select: { id: true, firstName: true },
  });
  if (!signup) return { error: "You don't have a signup for this day to cancel." };

  await prisma.formSignup.update({
    where: { id: signup.id },
    data: { cancelledAt: now },
  });

  try {
    await sendCancellation({ to: email, firstName: signup.firstName, formId, day: form.day });
  } catch (error) {
    console.error("Failed to send cancellation email", error);
  }

  revalidateSignup(formId);
  return {};
}
