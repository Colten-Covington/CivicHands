"use server";
import { randomUUID } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { auditInsert } from "@/lib/audit";
import { checkAccountPassword, createSession, databaseConfigured, destroySession, getViewer, hashPassword, isBootstrapAdmin, passwordSchema, safeNext, verifyPassword, type Viewer } from "@/lib/auth";

// Used to keep response timing similar when an email is unknown.
let dummyHash: Promise<string> | null = null;

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters.").max(60),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254)),
  password: passwordSchema,
  agree: z.literal("on", { message: "Please agree to the community safety guidelines." }),
});

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(200),
});

function viewerFrom(user: typeof users.$inferSelect): Viewer {
  return { id: user.id, displayName: user.displayName, role: user.role, officialTitle: user.officialTitle, helperStatus: user.helperStatus, mustChangePassword: user.mustChangePassword };
}

/**
 * Grants admin to an ADMIN_EMAILS account only while the deployment has no active administrator.
 * After that, roles are managed (and audited) by administrators, so a demotion is never undone here.
 */
async function promoteBootstrapAdmin(user: typeof users.$inferSelect) {
  if (user.role === "admin" || !isBootstrapAdmin(user.email)) return;
  const [{ value: admins }] = await getDb().select({ value: count() }).from(users).where(and(eq(users.role, "admin"), isNull(users.suspendedAt)));
  if (admins > 0) return;
  await getDb().batch([
    getDb().update(users).set({ role: "admin" }).where(eq(users.id, user.id)),
    auditInsert(null, {
      action: "user.role_changed",
      targetType: "user",
      targetId: user.id,
      publicSummary: `${user.displayName} was granted administrator access from the deployment's ADMIN_EMAILS configuration.`,
      privateDetails: { from: user.role, to: "admin" },
    }),
  ]);
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!databaseConfigured()) return fail("Accounts are unavailable until a database is configured.");
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your details.");
  const { displayName, email, password } = parsed.data;

  const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return fail("We couldn't create an account with that email. Try signing in instead.");

  const [user] = await getDb().insert(users).values({ displayName, email, passwordHash: await hashPassword(password) }).onConflictDoNothing().returning();
  if (!user) return fail("We couldn't create an account with that email. Try signing in instead.");
  await auditInsert(viewerFrom(user), { action: "user.signed_up", targetType: "user", targetId: user.id, publicSummary: "A new member joined CivicHands." });
  await promoteBootstrapAdmin(user);
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!databaseConfigured()) return fail("Accounts are unavailable until a database is configured.");
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Enter your email and password.");
  const { email, password } = parsed.data;
  const generic = fail("That email and password didn't match.");

  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    dummyHash ??= hashPassword(randomUUID());
    await verifyPassword(password, await dummyHash);
    return generic;
  }
  const result = await checkAccountPassword(user, password);
  if (result === "locked") return fail("Too many attempts. Please wait a few minutes and try again.");
  if (result === "wrong") return generic;
  if (user.suspendedAt) return fail("This account is suspended. Contact the CivicHands administrators if you believe this is a mistake.");

  await promoteBootstrapAdmin(user);
  await createSession(user.id);
  redirect(user.mustChangePassword ? "/account#password" : safeNext(formData.get("next")));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: passwordSchema,
  confirmPassword: z.string().max(200),
}).refine((data) => data.newPassword === data.confirmPassword, { message: "The new passwords don't match." });

/** Signed-in members change their own password. Other devices are signed out; this one gets a fresh session. */
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in again.");
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) return fail("Choose a password that's different from your current one.");

  const [user] = await getDb().select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.id, viewer.id)).limit(1);
  if (!user) return fail("Please sign in again.");
  const result = await checkAccountPassword(user, currentPassword);
  if (result === "locked") return fail("Too many attempts. Please wait a few minutes and try again.");
  if (result === "wrong") return fail("Your current password is incorrect.");

  await getDb().batch([
    getDb().update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false }).where(eq(users.id, viewer.id)),
    getDb().delete(sessions).where(eq(sessions.userId, viewer.id)),
    auditInsert(viewer, { action: "user.password_changed", targetType: "user", targetId: viewer.id, publicSummary: "A member changed their account password." }),
  ]);
  await createSession(viewer.id);
  revalidatePath("/", "layout");
  return ok("Password changed. You've been signed out on your other devices.");
}
