import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { getDb } from "@/db";
import { sessions, users, type User } from "@/db/schema";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const SESSION_COOKIE = "civichands_session";
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;
const MAX_FAILED_SIGN_INS = 5;
const LOCK_MINUTES = 15;

export type Viewer = Pick<User, "id" | "displayName" | "role" | "officialTitle" | "helperStatus" | "mustChangePassword">;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;
export const passwordSchema = z.string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`)
  .max(MAX_PASSWORD_LENGTH, `Keep the password under ${MAX_PASSWORD_LENGTH} characters.`);

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const expectedKey = Buffer.from(expected, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expectedKey.length);
  return key.length === expectedKey.length && timingSafeEqual(key, expectedKey);
}

/**
 * Checks an account's password and locks it after five failed comparisons; successful sign-ins reset the count.
 */
export async function checkAccountPassword(user: Pick<User, "id" | "passwordHash">, password: string): Promise<"ok" | "wrong" | "locked"> {
  const now = new Date();
  const canAttempt = and(eq(users.id, user.id), or(isNull(users.lockedUntil), lte(users.lockedUntil, now)));
  const [account] = await getDb().select({ lockedUntil: users.lockedUntil }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!account || (account.lockedUntil && account.lockedUntil > now)) return "locked";

  if (await verifyPassword(password, user.passwordHash)) {
    const [reset] = await getDb().update(users).set({ failedSignIns: 0, lockedUntil: null }).where(canAttempt).returning({ id: users.id });
    return reset ? "ok" : "locked";
  }

  const lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60 * 1000);
  const [attempt] = await getDb().update(users).set({
    failedSignIns: sql`case when ${users.lockedUntil} is not null and ${users.lockedUntil} <= ${now} then 1 else ${users.failedSignIns} + 1 end`,
    lockedUntil: sql`case when ${users.lockedUntil} is not null and ${users.lockedUntil} <= ${now} then null when ${users.failedSignIns} + 1 >= ${MAX_FAILED_SIGN_INS} then ${lockUntil} else ${users.lockedUntil} end`,
  }).where(canAttempt).returning({ lockedUntil: users.lockedUntil });
  if (!attempt) return "locked";
  return attempt.lockedUntil ? "locked" : "wrong";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token && databaseConfigured()) await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Returns the signed-in, non-suspended user for this request, or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!databaseConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const [row] = await getDb()
      .select({ id: users.id, displayName: users.displayName, role: users.role, officialTitle: users.officialTitle, helperStatus: users.helperStatus, mustChangePassword: users.mustChangePassword, suspendedAt: users.suspendedAt })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!row || row.suspendedAt) return null;
    return { id: row.id, displayName: row.displayName, role: row.role, officialTitle: row.officialTitle, helperStatus: row.helperStatus, mustChangePassword: row.mustChangePassword };
  } catch {
    return null;
  }
});

export async function requireViewer(next = "/account") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return viewer;
}

/** Staff powers are paused while an account is still using a temporary password someone else set. */
export function isAdmin(viewer: Viewer | null) {
  return viewer?.role === "admin" && !viewer.mustChangePassword;
}

/** City officials and administrators may manage reports. */
export function isStaff(viewer: Viewer | null) {
  return (viewer?.role === "admin" || viewer?.role === "city_official") && !viewer.mustChangePassword;
}

export function isBootstrapAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/** Only accept same-site relative redirect targets. */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/account") {
  const next = typeof value === "string" ? value : "";
  // Browsers strip tabs/newlines from URLs, so "/\t/evil.com" would become "//evil.com".
  if (!next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const base = "http://civichands.invalid";
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
