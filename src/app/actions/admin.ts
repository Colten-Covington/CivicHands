"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { helperApplications, helpOffers, needs, sessions, users } from "@/db/schema";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { auditInsert } from "@/lib/audit";
import { checkAccountPassword, getViewer, hashPassword, isAdmin, isStaff, passwordSchema } from "@/lib/auth";
import { statusLabels } from "@/lib/needs";

/**
 * Withdraws a user's open offers and releases reports they were assigned to, so a revoked or
 * suspended helper can no longer be accepted or see private locations.
 */
async function releaseOffersFor(userId: string, neighborOnly: boolean) {
  const kinds = neighborOnly ? (["neighbor_help"] as const) : (["neighbor_help", "public_cleanup"] as const);
  const active = await getDb().select({ id: helpOffers.id, status: helpOffers.status, needId: helpOffers.needId }).from(helpOffers).innerJoin(needs, eq(needs.id, helpOffers.needId))
    .where(and(eq(helpOffers.helperId, userId), inArray(helpOffers.status, ["pending", "accepted"]), inArray(needs.kind, [...kinds])));
  if (active.length === 0) return [];
  const now = new Date();
  const assignedNeedIds = active.filter((offer) => offer.status === "accepted").map((offer) => offer.needId);
  await getDb().update(helpOffers).set({ status: "withdrawn", respondedAt: now }).where(inArray(helpOffers.id, active.map((offer) => offer.id)));
  if (assignedNeedIds.length) await getDb().update(needs).set({ status: "open", updatedAt: now }).where(and(inArray(needs.id, assignedNeedIds), eq(needs.status, "claimed")));
  return assignedNeedIds;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

const roleNames = { member: "community member", city_official: "city official", admin: "administrator" } as const;

/** City officials and administrators can move any report through its lifecycle with a public note. */
export async function updateNeedStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!isStaff(viewer)) return fail("Only city officials and administrators can manage reports.");
  const parsed = z.object({
    needId: z.uuid(),
    status: z.enum(["open", "claimed", "completed", "referred", "closed"]),
    publicNote: z.string().trim().max(500).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please choose a status and keep the note under 500 characters.");
  const { needId, status, publicNote } = parsed.data;

  const [need] = await getDb().select({ status: needs.status }).from(needs).where(eq(needs.id, needId)).limit(1);
  if (!need) return fail("That report wasn't found.");
  if (need.status === status && !publicNote) return fail("Choose a new status or add a public update.");

  const now = new Date();
  const offerUpdate = status === "completed"
    ? getDb().update(helpOffers).set({ status: "completed" }).where(and(eq(helpOffers.needId, needId), eq(helpOffers.status, "accepted")))
    : status === "claimed"
      ? null
      : getDb().update(helpOffers).set({ status: "declined", respondedAt: now }).where(and(eq(helpOffers.needId, needId), eq(helpOffers.status, "accepted")));

  const summary = need.status === status ? "Public update posted." : `Status changed from ${statusLabels[need.status]} to ${statusLabels[status]}.`;
  const updateNeed = getDb().update(needs).set({ status, updatedAt: now, completedAt: status === "completed" ? now : null }).where(eq(needs.id, needId));
  const audit = auditInsert(viewer, { action: "need.status_changed", targetType: "need", targetId: needId, needId, publicSummary: summary, publicNote, privateDetails: { from: need.status, to: status } });
  if (offerUpdate) await getDb().batch([updateNeed, offerUpdate, audit]);
  else await getDb().batch([updateNeed, audit]);
  refreshAll();
  return ok("Report updated.");
}

/** Moderation: remove a report from the public map (or restore it). The reason stays private to staff. */
export async function setNeedHidden(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!isStaff(viewer)) return fail("Only city officials and administrators can moderate reports.");
  const parsed = z.object({ needId: z.uuid(), hidden: z.enum(["true", "false"]), reason: z.string().trim().min(3, "Add a short reason for the audit log.").max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please add a reason.");
  const hidden = parsed.data.hidden === "true";
  const { needId, reason } = parsed.data;

  const [need] = await getDb().select({ hidden: needs.hidden }).from(needs).where(eq(needs.id, needId)).limit(1);
  if (!need) return fail("That report wasn't found.");
  if (need.hidden === hidden) return fail(hidden ? "That report is already hidden." : "That report is already on the public map.");

  await getDb().batch([
    getDb().update(needs).set({ hidden, updatedAt: new Date() }).where(eq(needs.id, needId)),
    auditInsert(viewer, {
      action: hidden ? "need.hidden" : "need.restored",
      targetType: "need",
      targetId: needId,
      needId,
      publicSummary: hidden ? "Report removed from the public map by moderators." : "Report restored to the public map by moderators.",
      privateDetails: { reason },
    }),
  ]);
  refreshAll();
  return ok(hidden ? "Report hidden from the public map." : "Report restored.");
}

export async function reviewHelperApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return fail("Only administrators can vet helpers.");
  const parsed = z.object({ applicationId: z.uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please choose a decision.");
  const { applicationId, decision, note } = parsed.data;

  const [application] = await getDb().select().from(helperApplications).where(eq(helperApplications.id, applicationId)).limit(1);
  if (!application || application.status !== "pending") return fail("That application has already been reviewed.");
  if (application.userId === viewer.id) return fail("Another administrator must review your own application.");

  const now = new Date();
  await getDb().batch([
    getDb().update(helperApplications).set({ status: decision, reviewerId: viewer.id, reviewNote: note || null, reviewedAt: now }).where(eq(helperApplications.id, applicationId)),
    getDb().update(users).set({ helperStatus: decision }).where(eq(users.id, application.userId)),
    auditInsert(viewer, {
      action: `helper.${decision}`,
      targetType: "helper_application",
      targetId: applicationId,
      publicSummary: decision === "approved" ? "A helper application was approved." : "A helper application was declined.",
      privateDetails: { userId: application.userId, note: note || null },
    }),
  ]);
  refreshAll();
  return ok(decision === "approved" ? "Helper approved." : "Application declined.");
}

export async function revokeHelper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return fail("Only administrators can change helper status.");
  const parsed = z.object({ userId: z.uuid(), reason: z.string().trim().min(3, "Add a short reason for the audit log.").max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please add a reason.");
  const { userId, reason } = parsed.data;
  if (userId === viewer.id) return fail("You can't change your own helper status.");

  const [revoked] = await getDb().update(users).set({ helperStatus: "revoked" }).where(and(eq(users.id, userId), eq(users.helperStatus, "approved"))).returning({ id: users.id });
  if (!revoked) return fail("That user isn't currently a vetted helper.");
  const released = await releaseOffersFor(userId, true);
  await getDb().batch([
    auditInsert(viewer, { action: "helper.revoked", targetType: "user", targetId: userId, publicSummary: "A helper's vetted status was revoked.", privateDetails: { userId, reason } }),
    ...released.map((needId) => auditInsert(viewer, { action: "need.released", targetType: "need", targetId: needId, needId, publicSummary: "The assigned helper is no longer available; this report is open again." })),
  ]);
  refreshAll();
  return ok("Helper status revoked.");
}

/** Administrators designate city officials and other administrators. These designations are public. */
export async function setUserRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return fail("Only administrators can change roles.");
  const parsed = z.object({
    userId: z.uuid(),
    role: z.enum(["member", "city_official", "admin"]),
    officialTitle: z.string().trim().max(120).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the role details.");
  const { userId, role } = parsed.data;
  const officialTitle = parsed.data.officialTitle || null;
  if (userId === viewer.id) return fail("Ask another administrator to change your own role.");
  if (role === "city_official" && !officialTitle) return fail("Add the official's department or title, e.g. “Public Works, City of Texas City”.");

  const [user] = await getDb().select({ displayName: users.displayName, role: users.role, officialTitle: users.officialTitle }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return fail("That user wasn't found.");
  if (user.role === role && (user.officialTitle ?? null) === (role === "member" ? null : officialTitle)) return fail("Nothing changed.");

  const title = role === "member" ? null : officialTitle;
  const publicName = title ? `${user.displayName} (${title})` : user.displayName;
  const publicSummary = role === "member"
    ? `${user.displayName} is no longer a ${roleNames[user.role]}.`
    : `${publicName} was designated as ${role === "admin" ? "an" : "a"} ${roleNames[role]}.`;

  await getDb().batch([
    getDb().update(users).set({ role, officialTitle: title }).where(eq(users.id, userId)),
    auditInsert(viewer, { action: "user.role_changed", targetType: "user", targetId: userId, publicSummary, privateDetails: { from: user.role, to: role } }),
  ]);
  refreshAll();
  return ok("Role updated.");
}

export async function setUserSuspended(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return fail("Only administrators can suspend accounts.");
  const parsed = z.object({ userId: z.uuid(), suspend: z.enum(["true", "false"]), reason: z.string().trim().min(3, "Add a short reason for the audit log.").max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please add a reason.");
  const suspend = parsed.data.suspend === "true";
  const { userId, reason } = parsed.data;
  if (userId === viewer.id) return fail("You can't suspend your own account.");
  const [user] = await getDb().select({ suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return fail("That user wasn't found.");
  if (Boolean(user.suspendedAt) === suspend) return fail(suspend ? "That account is already suspended." : "That account isn't suspended.");

  const audit = auditInsert(viewer, {
    action: suspend ? "user.suspended" : "user.reinstated",
    targetType: "user",
    targetId: userId,
    publicSummary: suspend ? "A member account was suspended." : "A suspended member account was reinstated.",
    privateDetails: { userId, reason },
  });
  const update = getDb().update(users).set({ suspendedAt: suspend ? new Date() : null }).where(eq(users.id, userId));
  if (suspend) {
    await getDb().batch([update, getDb().delete(sessions).where(eq(sessions.userId, userId)), audit]);
    const released = await releaseOffersFor(userId, false);
    if (released.length) await getDb().batch([
      auditInsert(viewer, { action: "need.released", targetType: "need", targetId: released[0], needId: released[0], publicSummary: "The assigned helper is no longer available; this report is open again." }),
      ...released.slice(1).map((needId) => auditInsert(viewer, { action: "need.released", targetType: "need", targetId: needId, needId, publicSummary: "The assigned helper is no longer available; this report is open again." })),
    ]);
  } else await getDb().batch([update, audit]);
  refreshAll();
  return ok(suspend ? "Account suspended and signed out everywhere." : "Account reinstated.");
}

const setPasswordSchema = z.object({
  userId: z.uuid(),
  newPassword: passwordSchema,
  confirmPassword: z.string().max(200),
  adminPassword: z.string().min(1, "Enter your own password to confirm.").max(200),
}).refine((data) => data.newPassword === data.confirmPassword, { message: "The new passwords don't match." });

/**
 * There is no email-based reset yet, so administrators can set a new password for another account
 * (including other administrators) and share it with the owner through a trusted channel. The acting
 * administrator re-enters their own password. The account is unlocked and signed out everywhere.
 */
export async function setUserPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return fail("Only administrators can set passwords.");
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const { userId, newPassword, adminPassword } = parsed.data;
  if (userId === viewer.id) return fail("Change your own password from your account page.");

  const [self] = await getDb().select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.id, viewer.id)).limit(1);
  if (!self) return fail("Please sign in again.");
  const check = await checkAccountPassword(self, adminPassword);
  if (check === "locked") return fail("Too many incorrect attempts on your password. Please wait a few minutes and try again.");
  if (check === "wrong") return fail("Your own password was incorrect.");

  const [user] = await getDb().select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return fail("That user wasn't found.");

  await getDb().batch([
    getDb().update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: true, failedSignIns: 0, lockedUntil: null }).where(eq(users.id, userId)),
    getDb().delete(sessions).where(eq(sessions.userId, userId)),
    auditInsert(viewer, {
      action: "user.password_set",
      targetType: "user",
      targetId: userId,
      publicSummary: "An administrator set a new password for an account.",
      privateDetails: { userId, role: user.role },
    }),
  ]);
  refreshAll();
  return ok("Password set and the account was signed out everywhere. Share it privately; they'll be asked to choose their own password when they sign in.");
}

/** Lets a locked-out user try signing in again before the 15-minute lockout ends. */
export async function clearSignInLockout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return fail("Only administrators can unlock accounts.");
  const parsed = z.object({ userId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("That user wasn't found.");
  const { userId } = parsed.data;

  const [user] = await getDb().select({ lockedUntil: users.lockedUntil, failedSignIns: users.failedSignIns }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return fail("That user wasn't found.");
  if ((!user.lockedUntil || user.lockedUntil <= new Date()) && user.failedSignIns === 0) return fail("That account isn't locked.");

  await getDb().batch([
    getDb().update(users).set({ failedSignIns: 0, lockedUntil: null }).where(eq(users.id, userId)),
    auditInsert(viewer, { action: "user.unlocked", targetType: "user", targetId: userId, publicSummary: "An administrator cleared an account's sign-in lockout.", privateDetails: { userId } }),
  ]);
  refreshAll();
  return ok("Sign-in lockout cleared.");
}

/** Ends every active session for an account, e.g. after a lost device. */
export async function signOutUserEverywhere(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) return fail("Only administrators can sign accounts out.");
  const parsed = z.object({ userId: z.uuid(), reason: z.string().trim().min(3, "Add a short reason for the audit log.").max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please add a reason.");
  const { userId, reason } = parsed.data;
  if (userId === viewer.id) return fail("Use Sign out, or change your password to sign out your other devices.");

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return fail("That user wasn't found.");

  await getDb().batch([
    getDb().delete(sessions).where(eq(sessions.userId, userId)),
    auditInsert(viewer, { action: "user.signed_out", targetType: "user", targetId: userId, publicSummary: "An administrator signed an account out of all devices.", privateDetails: { userId, reason } }),
  ]);
  refreshAll();
  return ok("Signed out of all devices.");
}
