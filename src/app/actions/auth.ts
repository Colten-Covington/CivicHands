"use server";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fail, type ActionState } from "@/lib/action-state";
import { auditInsert } from "@/lib/audit";
import { createSession, databaseConfigured, destroySession, hashPassword, isBootstrapAdmin, safeNext, verifyPassword, type Viewer } from "@/lib/auth";

const MAX_FAILED_SIGN_INS = 5;
const LOCK_MINUTES = 15;
// Used to keep response timing similar when an email is unknown.
let dummyHash: Promise<string> | null = null;

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters.").max(60),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254)),
  password: z.string().min(12, "Use at least 12 characters for your password.").max(200),
  agree: z.literal("on", { message: "Please agree to the community safety guidelines." }),
});

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(200),
});

function viewerFrom(user: typeof users.$inferSelect): Viewer {
  return { id: user.id, displayName: user.displayName, role: user.role, officialTitle: user.officialTitle, helperStatus: user.helperStatus };
}

async function promoteBootstrapAdmin(user: typeof users.$inferSelect) {
  if (user.role === "admin" || !isBootstrapAdmin(user.email)) return;
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
  if (user.lockedUntil && user.lockedUntil > new Date()) return fail("Too many attempts. Please wait a few minutes and try again.");

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failures = user.failedSignIns + 1;
    await getDb().update(users).set(
      failures >= MAX_FAILED_SIGN_INS
        ? { failedSignIns: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
        : { failedSignIns: sql`${users.failedSignIns} + 1` },
    ).where(eq(users.id, user.id));
    return generic;
  }
  if (user.suspendedAt) return fail("This account is suspended. Contact the CivicHands administrators if you believe this is a mistake.");

  await getDb().update(users).set({ failedSignIns: 0, lockedUntil: null }).where(eq(users.id, user.id));
  await promoteBootstrapAdmin(user);
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
