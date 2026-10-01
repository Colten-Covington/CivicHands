// Password hashing for the maintenance scripts. Must match hashPassword(),
// verifyPassword(), and passwordSchema in src/lib/auth.ts.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

/** Returns an error message, or null when the password meets the policy. */
export function passwordProblem(password) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Keep the password under ${MAX_PASSWORD_LENGTH} characters.`;
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, expected] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const expectedKey = Buffer.from(expected, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expectedKey.length);
  return key.length === expectedKey.length && timingSafeEqual(key, expectedKey);
}
