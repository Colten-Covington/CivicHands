// Sets a new password for an account directly in DATABASE_URL.
//
// CivicHands has no email-based password reset yet. Administrators can set
// passwords for other accounts from /admin, but if no administrator can sign
// in (for example, the only administrator forgot their password), run:
//
//   npm run user:set-password -- someone@example.org
//
// The password is read from a hidden prompt, or from the first line of stdin
// when piped, so it never appears in shell history or process listings. The
// account is unlocked, signed out everywhere, and the change is audited.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

// Must match hashPassword() in src/lib/auth.ts.
const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

function fail(message) {
  console.error(`[set-password] ${message}`);
  process.exit(1);
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Reads one line; when interactive, input is not echoed. */
function prompt(question) {
  return new Promise((resolve) => {
    const interactive = Boolean(process.stdin.isTTY);
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
    if (interactive) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) process.stdout.write(text);
      };
    }
    let answered = false;
    rl.question(question, (answer) => {
      answered = true;
      if (interactive) process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
    rl.on("close", () => {
      if (!answered) resolve("");
    });
  });
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) fail("Usage: npm run user:set-password -- <email>");
const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is not set in this environment.");

const sql = neon(url);
const [user] = await sql`select id, role, suspended_at from users where email = ${email} limit 1`;
if (!user) fail(`No account uses ${email}.`);

let password;
if (process.stdin.isTTY) {
  password = await prompt("New password: ");
  const confirm = await prompt("Confirm new password: ");
  if (password !== confirm) fail("The passwords don't match.");
} else {
  password = (await prompt("")).replace(/\r$/, "");
}
if (password.length < MIN_PASSWORD_LENGTH) fail(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`);
if (password.length > MAX_PASSWORD_LENGTH) fail(`Keep the password under ${MAX_PASSWORD_LENGTH} characters.`);

const passwordHash = await hashPassword(password);
await sql.transaction([
  sql`update users set password_hash = ${passwordHash}, failed_sign_ins = 0, locked_until = null where id = ${user.id}`,
  sql`delete from sessions where user_id = ${user.id}`,
  sql`insert into audit_events (actor_role, action, target_type, target_id, public_summary, private_details)
      values ('system', 'user.password_set', 'user', ${user.id}, 'A new password was set for an account from the server console.', ${JSON.stringify({ userId: user.id, role: user.role, via: "cli" })}::jsonb)`,
]);

console.log(`[set-password] Password updated for ${email} (${user.role}). The account was unlocked and signed out everywhere.`);
if (user.suspended_at) console.log("[set-password] Note: this account is suspended, so it still can't sign in until an administrator reinstates it.");
