// Applies ADMIN_TEMP_PASSWORD to the ADMIN_EMAILS accounts in DATABASE_URL.
//
// Runs during Vercel production builds (after migrations) and locally with
// `npm run db:bootstrap-admins`. For each ADMIN_EMAILS address:
//
// - No account yet, and the deployment has no active administrator: creates
//   an administrator account with the temporary password.
// - Existing administrator (or any existing account while there is no active
//   administrator, which is then promoted): sets the temporary password,
//   clears any sign-in lockout, and signs the account out everywhere.
//
// Each ADMIN_TEMP_PASSWORD value is applied to an account only once, so later
// deploys don't undo a password the owner has since changed. To issue another
// temporary password (e.g. the administrator forgot theirs), change the value
// and redeploy. Temporary passwords must be replaced at the next sign-in, and
// every change is recorded in the audit log. The password is never logged.
import { neon } from "@neondatabase/serverless";
import { hashPassword, passwordProblem, verifyPassword } from "./lib/password.mjs";

const log = (message) => console.log(`[bootstrap-admins] ${message}`);
function fail(message) {
  console.error(`[bootstrap-admins] ${message}`);
  process.exit(1);
}

const tempPassword = (process.env.ADMIN_TEMP_PASSWORD ?? "").replace(/[\r\n]+$/, "");
const emails = [...new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))];

if (!tempPassword) {
  log("ADMIN_TEMP_PASSWORD is not set; nothing to do.");
  process.exit(0);
}
if (emails.length === 0) {
  log("ADMIN_TEMP_PASSWORD is set but ADMIN_EMAILS is empty; nothing to do.");
  process.exit(0);
}
const problem = passwordProblem(tempPassword);
if (problem) fail(`ADMIN_TEMP_PASSWORD is not a valid password: ${problem}`);
const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is not set in this environment.");

const sql = neon(url);
const configured = "the deployment's ADMIN_EMAILS configuration";

async function apply(email, noActiveAdmin) {
  const [user] = await sql`select id, display_name, role, suspended_at, bootstrap_password_hash from users where email = ${email} limit 1`;

  if (!user) {
    if (!noActiveAdmin) return log(`${email}: no account, and the deployment already has an administrator. Ask an administrator to grant access after this person signs up.`);
    const passwordHash = await hashPassword(tempPassword);
    // One statement so the account and its audit event are created together.
    const [created] = await sql`
      with created as (
        insert into users (email, password_hash, display_name, role, must_change_password, bootstrap_password_hash)
        values (${email}, ${passwordHash}, 'Administrator', 'admin', true, ${passwordHash})
        on conflict (email) do nothing
        returning id
      )
      insert into audit_events (actor_role, action, target_type, target_id, public_summary, private_details)
      select 'system', 'user.created', 'user', id, ${`An administrator account was created from ${configured}.`},
        jsonb_build_object('userId', id, 'via', 'ADMIN_TEMP_PASSWORD')
      from created
      returning target_id`;
    return log(created ? `${email}: created an administrator account with the temporary password.` : `${email}: an account was created concurrently; redeploy to apply the temporary password.`);
  }

  if (user.suspended_at) return log(`${email}: account is suspended; skipped.`);
  const promote = user.role !== "admin";
  if (promote && !noActiveAdmin) return log(`${email}: account is not an administrator, and the deployment already has one; skipped.`);
  if (await verifyPassword(tempPassword, user.bootstrap_password_hash)) {
    return log(`${email}: this ADMIN_TEMP_PASSWORD was already applied; skipped. Change the value to issue a new temporary password.`);
  }

  const passwordHash = await hashPassword(tempPassword);
  const details = JSON.stringify({ userId: user.id, via: "ADMIN_TEMP_PASSWORD" });
  await sql.transaction([
    sql`update users set password_hash = ${passwordHash}, bootstrap_password_hash = ${passwordHash}, must_change_password = true,
        failed_sign_ins = 0, locked_until = null, role = 'admin' where id = ${user.id}`,
    sql`delete from sessions where user_id = ${user.id}`,
    ...(promote
      ? [sql`insert into audit_events (actor_role, action, target_type, target_id, public_summary, private_details)
          values ('system', 'user.role_changed', 'user', ${user.id}, ${`${user.display_name} was granted administrator access from ${configured}.`},
          ${JSON.stringify({ from: user.role, to: "admin" })}::jsonb)`]
      : []),
    sql`insert into audit_events (actor_role, action, target_type, target_id, public_summary, private_details)
        values ('system', 'user.password_set', 'user', ${user.id}, 'A temporary password was set for an administrator account from the deployment configuration.', ${details}::jsonb)`,
  ]);
  log(`${email}: set the temporary password${promote ? " and granted administrator access" : ""}; the account was signed out everywhere.`);
}

try {
  const [{ count }] = await sql`select count(*)::int as count from users where role = 'admin' and suspended_at is null`;
  const noActiveAdmin = count === 0;
  for (const email of emails) await apply(email, noActiveAdmin);
  log("Done. Remove ADMIN_TEMP_PASSWORD from the environment once the administrator has signed in and chosen a new password.");
} catch (error) {
  fail(`Failed: ${error?.message ?? error}${error?.code === "42703" ? " (run the database migrations first)" : ""}`);
}
