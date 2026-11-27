"use server";

import { revalidatePath } from "next/cache";
import { driverStatuses } from "@/lib/drivers/status";
import { getVerifiedEmail } from "@/lib/email-verification/session";
import { firstErrors, formValues, type ActionState } from "@/lib/forms";
import { loadPlacementDay, travelOf } from "@/lib/placement/load";
import type { BuildRoom } from "@/lib/placement/room";
import { buildRoom, signupChecker } from "@/lib/placement/solver";
import { prisma } from "@/lib/prisma";
import { formPhase } from "@/lib/signup-forms/phase";
import { offeredShifts } from "@/lib/signup-forms/queries";
import { fromDay, toDay } from "@/lib/time";
import { MAX_GROUP_REQUESTS } from "@/lib/volunteers";
import {
  carSeatsSchema,
  detailsSchema,
  driverFormSchema,
  groupEmailSchema,
  oldEnoughOn,
  TOO_YOUNG,
  transportationSchema,
  type SignupField,
} from "./details";
import { alertAdminsOfCancellation } from "./closed-cancellation";
import { cancelDeadline, getMyReservation, sameDayMessage, sameDaySignup } from "./queries";
import { fillFromWaitlist } from "./waitlist";

// Volunteers signing up through a form and cancelling their signup. A
// signup can't be changed (that keeps placing drivers and riders simple):
// to change it, they cancel and sign up again. Anyone can post to these,
// so everything is checked here: the confirmed email comes from the
// session cookie, never the form, and the form has to be open (or, to
// cancel, its first build not started). A volunteer with a reserved spot
// (see Reservation) can sign up as soon as the form is published, for that
// build only, and is always taken.

export type SignupFormState = {
  errors?: Partial<Record<SignupField | "form", string>>;
  success?: boolean;
  // Who each build has room for now (by its ID), when the builds the
  // volunteer chose filled up while they were filling out the form.
  rooms?: Record<string, BuildRoom>;
};

const SESSION_EXPIRED =
  "Your email confirmation has expired. Refresh the page and confirm your email again. Your answers will need to be re-entered.";

function revalidateSignup(formId: string) {
  revalidatePath(`/signup/${formId}`);
  revalidatePath("/admin", "layout");
}

// A published form with the builds it offers, or null.
async function loadForm(formId: string) {
  const form = await prisma.signupForm.findUnique({
    where: { id: formId, status: "PUBLISHED" },
    select: {
      name: true,
      date: true,
      status: true,
      opensAt: true,
      closesAt: true,
      askTransportation: true,
      askGroups: true,
      waitlist: true,
      shifts: offeredShifts,
    },
  });
  if (!form) return null;
  return { ...form, day: toDay(form.date) };
}

// Signs up, or joins the waitlist. Volunteers choose builds with room for
// them ("shiftId"), or, on a form with a waitlist, full builds to wait for
// ("waitlistShiftId"), but not both: with room somewhere they're simply
// signed up there. Signing up again after cancelling counts as a new
// signup, but someone already signed up (or waiting) can't sign up again
// over it. With a reserved spot, the builds sent are ignored: they sign up
// for its build.
export async function submitSignup(
  formId: string,
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const email = await getVerifiedEmail();
  if (!email) return { errors: { form: SESSION_EXPIRED } };

  const form = await loadForm(formId);
  const reserved = form && (await getMyReservation(prisma, formId, email, form.shifts));
  const phase = form && formPhase(form);
  if (!form || !(phase === "open" || (phase === "not-open" && reserved))) {
    return { errors: { form: "This form isn't taking signups right now. Refresh the page to see why." } };
  }

  // ── Check the answers.
  const values = formValues(formData);
  const parsed = detailsSchema.safeParse(values);
  const shiftIds = reserved ? [reserved.shiftId] : [...new Set(formData.getAll("shiftId").map(String))];
  const waitlistIds = reserved ? [] : [...new Set(formData.getAll("waitlistShiftId").map(String))];
  const joining = waitlistIds.length > 0;
  const errors: SignupFormState["errors"] = parsed.success ? {} : firstErrors(parsed.error);
  if (shiftIds.length === 0 && !joining) errors.shifts = "Choose at least one build you could work at.";
  if (shiftIds.length > 0 && joining) {
    errors.shifts = "Choose builds with room, or join waitlists, but not both.";
  }
  if (joining && !form.waitlist) {
    errors.shifts = "This form's waitlist is closed. Refresh the page to see which builds have room.";
  }
  if (parsed.success && !oldEnoughOn(parsed.data.dateOfBirth, form.day)) {
    errors.dateOfBirth = TOO_YOUNG;
  }

  // Driving, on a form that asks how volunteers are getting there.
  // Volunteers with a license who aren't approved or pending are asked
  // whether they've filled out Purdue's driver approval form; only drivers
  // who are approved or pending (counting a "yes" just now) can offer to
  // drive others, and then they give their car's seats. On a form that
  // doesn't ask, everyone is getting there on their own.
  const asksTransportation = form.askTransportation;
  const hasLicense = values.hasDriversLicense === "yes";
  const known = await prisma.volunteer.findUnique({ where: { email }, select: { id: true } });
  const driver = known
    ? (await driverStatuses([known.id])).get(known.id)!
    : { status: "none" as const };
  const askDriverForm = asksTransportation && hasLicense && driver.status === "none";
  const driverForm = askDriverForm ? driverFormSchema.safeParse(values.driverForm) : null;
  if (driverForm && !driverForm.success) errors.driverForm = driverForm.error.issues[0].message;
  const nowPending = driverForm?.success && driverForm.data === "done";

  const transportation = transportationSchema.safeParse(
    asksTransportation ? values.transportation : "OWN_WAY",
  );
  if (!transportation.success) errors.transportation = transportation.error.issues[0].message;
  const drives = transportation.success && transportation.data === "CAN_DRIVE";
  if (drives && !(hasLicense && (driver.status !== "none" || nowPending))) {
    errors.transportation =
      "Only volunteers with a driver's license who are approved or waiting for approval can drive others.";
  }
  const carSeats = drives ? carSeatsSchema.safeParse(values.carSeats) : null;
  if (carSeats && !carSeats.success) errors.carSeats = carSeats.error.issues[0].message;

  // Friends they'd like to be placed with, by Purdue email. Only asked when
  // the form asks and the day has more than one build; with one, everyone's
  // together anyway.
  const groupEmails = new Set<string>();
  if (form.askGroups && form.shifts.length > 1) {
    for (const value of formData.getAll("groupEmail").map(String)) {
      if (!value.trim()) continue;
      const friend = groupEmailSchema.safeParse(value);
      if (!friend.success) errors.groupEmails = friend.error.issues[0].message;
      else if (friend.data === email) errors.groupEmails = "Enter your friends' emails, not your own.";
      else groupEmails.add(friend.data);
    }
    if (groupEmails.size > MAX_GROUP_REQUESTS) {
      errors.groupEmails = `You can ask to be placed with up to ${MAX_GROUP_REQUESTS} people.`;
    }
  }

  if (!parsed.success || !transportation.success || Object.keys(errors).length > 0) {
    return { errors };
  }
  const seats = carSeats?.success ? carSeats.data : null;

  const offered = new Map(form.shifts.map((shift) => [shift.id, shift]));
  // The builds they chose, to work at or to wait for.
  const chosenIds = joining ? waitlistIds : shiftIds;
  if (!chosenIds.every((id) => offered.has(id))) {
    return {
      errors: {
        shifts: "One of the builds you chose is no longer offered that day. Refresh the page to see the current builds.",
      },
    };
  }

  const details = { ...parsed.data, dateOfBirth: fromDay(parsed.data.dateOfBirth) };
  // How they count when placing volunteers (src/lib/placement).
  const newcomer = {
    ...travelOf(
      transportation.data,
      seats,
      hasLicense && (driver.status !== "none" || !!nowPending),
      asksTransportation,
    ),
    buildIds: shiftIds,
  };

  // ── Save, making sure a new signup still fits.
  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        // Lock the form until this transaction ends, so two people can't
        // both take its last spot. Its event may have been cancelled, or
        // its questions changed, since it was loaded.
        const [locked] = await tx.$queryRaw<
          { status: string; askTransportation: boolean; askGroups: boolean; waitlist: boolean }[]
        >`
          SELECT status, "askTransportation", "askGroups", waitlist FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;
        if (locked?.status !== "PUBLISHED") return { outcome: "closed" as const };
        if (locked.askTransportation !== form.askTransportation || locked.askGroups !== form.askGroups) {
          return { outcome: "changed" as const };
        }
        if (joining && !locked.waitlist) return { outcome: "no-waitlist" as const };

        const active = await tx.formSignup.findFirst({
          where: { formId, volunteer: { email }, cancelledAt: null },
          select: { id: true },
        });
        if (active) return { outcome: "already" as const };

        // An editor may have reserved or removed their spot since the page
        // loaded.
        const held = await getMyReservation(tx, formId, email, form.shifts);
        if (held?.shiftId !== reserved?.shiftId || (held?.signupId ?? null) !== null) {
          return { outcome: "reservation" as const };
        }

        // A day can have several forms, but a volunteer can only be at one.
        const sameDay = await sameDaySignup(tx, formId, form.date, email);
        if (sameDay) return { outcome: "same-day" as const, formName: sameDay.name };

        // There has to be a way to place everyone at a build they chose,
        // them included, with a ride for everyone who needs one. Anyone can
        // join a waitlist, and a reserved spot is always theirs.
        if (!joining && !held) {
          const day = await loadPlacementDay(tx, formId, form.shifts, asksTransportation);
          if (!signupChecker(day)(newcomer)) {
            return { outcome: "full" as const, rooms: Object.fromEntries(buildRoom(day)) };
          }
        }

        // Their latest details, for the next form they fill out. Saying
        // they've filled out the driver form makes their approval pending.
        const latest = {
          ...details,
          ...(nowPending && { driverRequestedAt: new Date(), driverAddedByName: null }),
          ...(seats !== null && { carSeats: seats }),
        };
        const volunteer = await tx.volunteer.upsert({
          where: { email },
          create: { email, ...latest },
          update: latest,
        });
        const answers = {
          ...details,
          transportation: transportation.data,
          carSeats: seats,
          // Joining again puts them at the back of the line.
          waitlistedAt: joining ? new Date() : null,
        };
        const signup = await tx.formSignup.upsert({
          where: { formId_volunteerId: { formId, volunteerId: volunteer.id } },
          create: { formId, volunteerId: volunteer.id, ...answers },
          // Signing up again starts over: any custom assignment from before
          // they cancelled is dropped.
          update: { ...answers, cancelledAt: null, assignedShiftId: null },
        });

        // Signing up again replaces every choice (and friend) from the
        // cancelled signup.
        await tx.shiftPreference.deleteMany({ where: { signupId: signup.id } });
        await tx.shiftPreference.createMany({
          data: chosenIds.map((shiftId) => ({ signupId: signup.id, shiftId })),
        });
        await tx.groupRequest.deleteMany({ where: { signupId: signup.id } });
        await tx.groupRequest.createMany({
          data: [...groupEmails].map((friend) => ({ signupId: signup.id, email: friend })),
        });
        if (held) await tx.reservation.update({ where: { id: held.id }, data: { signupId: signup.id } });

        // Room may have opened up that nobody has been added to yet, such
        // as from a build that was restored. Going through the waitlist in
        // order adds them now if they fit, without jumping ahead of anyone
        // who was waiting first.
        if (joining) await fillFromWaitlist(tx, formId);

        return { outcome: "saved" as const };
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    console.error("Signup failed", error);
    return { errors: { form: "Something went wrong saving your signup. Please try again in a moment." } };
  }

  if (result.outcome === "closed") {
    revalidateSignup(formId);
    return { errors: { form: "This form isn't taking signups right now. Refresh the page to see why." } };
  }
  if (result.outcome === "changed") {
    revalidateSignup(formId);
    return {
      errors: {
        form: "This form's questions were just changed. Refresh the page to see them. Your answers will need to be re-entered.",
      },
    };
  }
  if (result.outcome === "already") {
    revalidateSignup(formId);
    return {
      errors: {
        form: "You're already signed up for this day. To make changes, cancel your signup and sign up again.",
      },
    };
  }
  if (result.outcome === "reservation") {
    revalidateSignup(formId);
    return {
      errors: {
        form: "Your reserved spot was just changed. Refresh the page to see it. Your answers will need to be re-entered.",
      },
    };
  }
  if (result.outcome === "no-waitlist") {
    revalidateSignup(formId);
    return {
      errors: { shifts: "This form's waitlist was just closed. Refresh the page to see which builds have room." },
    };
  }
  if (result.outcome === "same-day") {
    return { errors: { form: sameDayMessage(result.formName) } };
  }
  if (result.outcome === "full") {
    revalidateSignup(formId);
    return {
      errors: {
        shifts:
          form.waitlist
            ? "Sorry, the builds you chose just filled up. We've updated which builds still have room: choose another, or join a waitlist."
            : "Sorry, the builds you chose just filled up. We've updated which builds still have room: choose another, or check the home page for other days.",
      },
      rooms: result.rooms,
    };
  }

  // Volunteers aren't emailed a confirmation: the form's page shows their
  // signup instead.
  revalidateSignup(formId);
  return { success: true };
}

export async function cancelSignup(formId: string): Promise<ActionState> {
  const email = await getVerifiedEmail();
  if (!email) return { error: SESSION_EXPIRED };

  // Someone with a reserved spot can sign up, and so cancel, before the
  // form opens.
  const form = await loadForm(formId);
  const now = new Date();
  if (!form || now >= cancelDeadline(form.day, form.shifts)) {
    return { error: "Signups for this day can't be cancelled here anymore. Please contact the organizers." };
  }

  const NOTHING_TO_CANCEL = "You don't have a signup for this day to cancel.";
  const cancelled = await prisma.$transaction(
    async (tx) => {
      // Lock the form until this transaction ends, as a signup does, so
      // the spot freed up goes to the waitlist before anyone else.
      await tx.$queryRaw`SELECT id FROM "SignupForm" WHERE id = ${formId} FOR UPDATE`;
      const signup = await tx.formSignup.findFirst({
        where: { formId, volunteer: { email }, cancelledAt: null },
        select: { id: true, waitlistedAt: true },
      });
      if (!signup) return null;
      await tx.formSignup.update({ where: { id: signup.id }, data: { cancelledAt: now } });
      // A reserved spot they signed up with goes back to everyone.
      await tx.reservation.deleteMany({ where: { signupId: signup.id } });
      // While the form is open, whoever's waiting can have their spot.
      if (!signup.waitlistedAt) await fillFromWaitlist(tx, formId);
      return signup;
    },
    { timeout: 20_000 },
  );
  if (!cancelled) return { error: NOTHING_TO_CANCEL };

  // Volunteers aren't emailed about it: the form's page says it's cancelled.

  // After the form closes, admins may have set the assignments and sent
  // the travel roster, so the build's admins hear about it. Someone who
  // was only waiting wasn't at any build.
  if (formPhase(form, now) === "closed" && !cancelled.waitlistedAt) {
    try {
      await alertAdminsOfCancellation(formId, cancelled.id);
    } catch (error) {
      console.error("Failed to email admins about a cancellation", error);
    }
  }

  revalidateSignup(formId);
  return {};
}
