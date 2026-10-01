import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, count, desc, eq, gt, ilike, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { clearSignInLockout, reviewHelperApplication, revokeHelper, setUserPassword, setUserRole, setUserSuspended, signOutUserEverywhere } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { SiteHeader } from "@/components/site-header";
import { StaffNeedControls } from "@/components/staff-need-controls";
import { getDb } from "@/db";
import { auditEvents, helperApplications, needs, users } from "@/db/schema";
import { isAdmin, isStaff, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, requireViewer } from "@/lib/auth";
import { formatDateTime, formatWhen } from "@/lib/format";
import { kindLabels, statusLabels } from "@/lib/needs";

export const metadata = { title: "Administration — CivicHands" };
export const dynamic = "force-dynamic";

type Search = { tab?: string; q?: string; status?: string; visibility?: string; review?: string; role?: string; account?: string; target?: string; page?: string };
const needStatuses = ["open", "claimed", "completed", "referred", "closed"] as const;
const roles = ["member", "moderator", "city_official", "admin"] as const;
const roleLabels = { member: "Member", moderator: "Moderator", city_official: "City official", admin: "Administrator" } as const;
const accountFilters = { suspended: "Suspended", locked: "Locked out", helper_pending: "Helper application pending", helpers: "Vetted helpers" } as const;
const AUDIT_PAGE_SIZE = 100;
const AUDIT_MAX_PAGE = 1000;

function adminHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return `/admin?${query}`;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer("/admin");
  if (viewer.mustChangePassword) redirect("/account#password");
  if (!isStaff(viewer)) notFound();
  const admin = isAdmin(viewer);
  const params = await searchParams;
  const tabs = admin ? [["reports", "Reports"], ["helpers", "Helper vetting"], ["users", "Users & roles"], ["audit", "Full audit log"]] : [["reports", "Reports"]];
  const tab = tabs.some(([key]) => key === params.tab) ? params.tab! : "reports";

  return <main>
    <SiteHeader/>
    <section className="page">
      <p className="eyebrow">{admin ? "Administrator" : viewer.role === "moderator" ? "Moderator" : `City official${viewer.officialTitle ? ` · ${viewer.officialTitle}` : ""}`}</p>
      <h1 className="page-title">{admin ? "Administration" : "Manage reports"}</h1>
      <p className="muted">Every action here is recorded in the <Link href="/transparency">public audit log</Link> under your name. Private notes and reasons are visible to administrators only.</p>
      <Overview admin={admin}/>
      <nav className="tab-row" aria-label="Admin sections">{tabs.map(([key, label]) => <Link key={key} className={tab === key ? "active" : ""} href={`/admin?tab=${key}`}>{label}</Link>)}</nav>
      {tab === "reports" && <ReportsTab params={params}/>}
      {tab === "helpers" && admin && <HelpersTab/>}
      {tab === "users" && admin && <UsersTab params={params} viewerId={viewer.id}/>}
      {tab === "audit" && admin && <AuditTab params={params}/>}
    </section>
  </main>;
}

/** Moderation queue at a glance. Each figure links to the matching filtered list. */
async function Overview({ admin }: { admin: boolean }) {
  const db = getDb();
  const now = new Date();
  const [[open], [hidden], [pendingReview], [pending], [suspended], [locked]] = await Promise.all([
    db.select({ value: count() }).from(needs).where(and(eq(needs.status, "open"), eq(needs.hidden, false))),
    db.select({ value: count() }).from(needs).where(eq(needs.hidden, true)),
    db.select({ value: count() }).from(needs).where(inArray(needs.reviewStatus, ["pending", "changes_requested"])),
    admin ? db.select({ value: count() }).from(helperApplications).where(eq(helperApplications.status, "pending")) : Promise.resolve([{ value: 0 }]),
    admin ? db.select({ value: count() }).from(users).where(isNotNull(users.suspendedAt)) : Promise.resolve([{ value: 0 }]),
    admin ? db.select({ value: count() }).from(users).where(gt(users.lockedUntil, now)) : Promise.resolve([{ value: 0 }]),
  ]);
  const stats: [number, string, string][] = [
    [open.value, "Open reports", adminHref({ tab: "reports", status: "open", visibility: "visible" })],
    [hidden.value, "Hidden reports", adminHref({ tab: "reports", visibility: "hidden" })],
    [pendingReview.value, "Reports needing review", adminHref({ tab: "reports", review: "pending" })],
  ];
  if (admin) stats.push(
    [pending.value, "Helper applications", adminHref({ tab: "helpers" })],
    [suspended.value, "Suspended accounts", adminHref({ tab: "users", account: "suspended" })],
    [locked.value, "Locked out now", adminHref({ tab: "users", account: "locked" })],
  );
  return <div className="stat-grid">{stats.map(([value, label, href]) => <Link key={label} href={href} className="stat-link"><strong>{value}</strong><span>{label}</span></Link>)}</div>;
}

async function ReportsTab({ params }: { params: Search }) {
  const filters: SQL[] = [];
  const status = needStatuses.find((value) => value === params.status);
  const review = ["pending", "approved", "changes_requested", "rejected"].find((value) => value === params.review);
  if (status) filters.push(eq(needs.status, status));
  if (review === "pending") filters.push(inArray(needs.reviewStatus, ["pending", "changes_requested"]));
  else if (review) filters.push(eq(needs.reviewStatus, review));
  if (params.visibility === "hidden") filters.push(eq(needs.hidden, true));
  if (params.visibility === "visible") filters.push(eq(needs.hidden, false));
  const q = params.q?.trim().slice(0, 100);
  if (q) filters.push(or(ilike(needs.title, `%${q}%`), ilike(needs.location, `%${q}%`), ilike(needs.category, `%${q}%`))!);
  const rows = await getDb().select().from(needs).where(filters.length ? and(...filters) : undefined).orderBy(desc(needs.updatedAt)).limit(100);

  return <section>
    <form className="filter-form" action="/admin">
      <input type="hidden" name="tab" value="reports"/>
      <input name="q" defaultValue={q} placeholder="Search title, location, category"/>
      <select name="status" defaultValue={status ?? ""}><option value="">Any status</option>{needStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select>
      <select name="review" defaultValue={review ?? ""}><option value="">Any review state</option><option value="pending">Needs review</option><option value="approved">Approved</option><option value="changes_requested">Changes requested</option><option value="rejected">Declined</option></select>
      <select name="visibility" defaultValue={params.visibility ?? ""}><option value="">Visible &amp; hidden</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select>
      <button className="secondary-button">Filter</button>
    </form>
    {rows.length === 0 && <p className="muted">No reports match.</p>}
    <ul className="item-list">{rows.map((need) => <li key={need.id}>
      <div className="item-head"><Link href={`/needs/${need.id}`}><strong>{need.title}</strong></Link><span className="status-pill">{kindLabels[need.kind]}</span><span className="status-pill">{statusLabels[need.status]}</span><span className={`status-pill ${need.reviewStatus === "approved" ? "" : "warn"}`}>Review: {need.reviewStatus.replaceAll("_", " ")}</span>{need.hidden && <span className="status-pill warn">Hidden</span>}</div>
      <small className="muted">{need.kind === "neighbor_help" ? "Approximate area (exact location private)" : need.location}, {need.city} · updated {formatWhen(need.updatedAt)}</small>
      <details><summary>Manage</summary><StaffNeedControls needId={need.id} status={need.status} hidden={need.hidden} reviewStatus={need.reviewStatus} hasReporter={Boolean(need.reporterId)}/></details>
    </li>)}</ul>
  </section>;
}

async function HelpersTab() {
  const db = getDb();
  const [pending, approved] = await Promise.all([
    db.select({ application: helperApplications, displayName: users.displayName, email: users.email, memberSince: users.createdAt }).from(helperApplications).innerJoin(users, eq(users.id, helperApplications.userId)).where(eq(helperApplications.status, "pending")).orderBy(helperApplications.createdAt),
    db.select({ id: users.id, displayName: users.displayName, email: users.email }).from(users).where(eq(users.helperStatus, "approved")).orderBy(users.displayName).limit(200),
  ]);
  const applicantIds = pending.map((row) => row.application.userId);
  const reportCounts = applicantIds.length ? await db.select({ userId: needs.reporterId, total: count() }).from(needs).where(inArray(needs.reporterId, applicantIds)).groupBy(needs.reporterId) : [];

  return <section>
    <section className="panel">
      <h2>Pending applications ({pending.length})</h2>
      {pending.length === 0 && <p className="muted">No applications waiting for review.</p>}
      <ul className="item-list">{pending.map(({ application, displayName, email, memberSince }) => <li key={application.id}>
        <div className="item-head"><strong>{displayName}</strong><small className="muted">{email} · member since {formatWhen(memberSince)} · {reportCounts.find((row) => row.userId === application.userId)?.total ?? 0} reports · applied {formatWhen(application.createdAt)}</small></div>
        <p><strong>Why:</strong> {application.motivation}</p>
        <p><strong>Experience:</strong> {application.experience}</p>
        <ActionForm action={reviewHelperApplication} submitLabel="Record decision" className="action-form compact">
          <input type="hidden" name="applicationId" value={application.id}/>
          <label>Decision<select name="decision" required defaultValue=""><option value="" disabled>Choose…</option><option value="approved">Approve as vetted helper</option><option value="rejected">Decline</option></select></label>
          <label>Private note (admins only)<input name="note" maxLength={500} placeholder="References checked, ID verified in person…"/></label>
        </ActionForm>
      </li>)}</ul>
    </section>
    <section className="panel">
      <h2>Vetted helpers ({approved.length})</h2>
      <ul className="item-list">{approved.map((helper) => <li key={helper.id}>
        <div className="item-head"><strong>{helper.displayName}</strong><small className="muted">{helper.email}</small></div>
        <details><summary>Revoke</summary><ActionForm action={revokeHelper} submitLabel="Revoke vetted status" buttonClassName="secondary-button" className="action-form compact">
          <input type="hidden" name="userId" value={helper.id}/>
          <label>Reason (admins only)<input name="reason" required minLength={3} maxLength={500}/></label>
        </ActionForm></details>
      </li>)}</ul>
    </section>
  </section>;
}

async function UsersTab({ params, viewerId }: { params: Search; viewerId: string }) {
  const term = params.q?.trim().slice(0, 100);
  const role = roles.find((value) => value === params.role);
  const account = params.account && params.account in accountFilters ? params.account as keyof typeof accountFilters : undefined;
  const now = new Date();
  const filters: SQL[] = [];
  if (term) filters.push(or(ilike(users.email, `%${term}%`), ilike(users.displayName, `%${term}%`))!);
  if (role) filters.push(eq(users.role, role));
  if (account === "suspended") filters.push(isNotNull(users.suspendedAt));
  if (account === "locked") filters.push(gt(users.lockedUntil, now));
  if (account === "helper_pending") filters.push(eq(users.helperStatus, "pending"));
  if (account === "helpers") filters.push(eq(users.helperStatus, "approved"));
  const rows = await getDb().select().from(users).where(filters.length ? and(...filters) : undefined).orderBy(desc(users.createdAt)).limit(50);

  return <section>
    <form className="filter-form" action="/admin">
      <input type="hidden" name="tab" value="users"/>
      <input name="q" defaultValue={term} placeholder="Search by name or email"/>
      <select name="role" defaultValue={role ?? ""}><option value="">Any role</option>{roles.map((value) => <option key={value} value={value}>{roleLabels[value]}</option>)}</select>
      <select name="account" defaultValue={account ?? ""}><option value="">Any account status</option>{Object.entries(accountFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button className="secondary-button">Search</button>
    </form>
    {rows.length === 0 && <p className="muted">No accounts match.</p>}
    {rows.length === 50 && <p className="muted">Showing the 50 newest matching accounts. Narrow the search to find others.</p>}
    <ul className="item-list">{rows.map((user) => {
      const lockedNow = Boolean(user.lockedUntil && user.lockedUntil > now);
      return <li key={user.id}>
        <div className="item-head"><strong>{user.displayName}</strong><span className="status-pill">{roleLabels[user.role]}</span>{user.helperStatus !== "none" && <span className="status-pill">Helper: {user.helperStatus}</span>}{user.suspendedAt && <span className="status-pill warn">Suspended</span>}{lockedNow && <span className="status-pill warn">Locked out until {formatDateTime(user.lockedUntil!)}</span>}</div>
        <small className="muted">{user.email}{user.officialTitle ? ` · ${user.officialTitle}` : ""} · joined {formatWhen(user.createdAt)}{user.failedSignIns > 0 ? ` · ${user.failedSignIns} recent failed sign-in${user.failedSignIns === 1 ? "" : "s"}` : ""} · <Link href={adminHref({ tab: "audit", target: user.id })}>Audit history</Link></small>
        {user.id === viewerId ? <p className="muted">This is you. Another administrator must change your role or status. Change your password from <Link href="/account#password">your account page</Link>.</p> : <details><summary>Manage</summary>
          <ActionForm action={setUserRole} submitLabel="Save role" className="action-form compact">
            <input type="hidden" name="userId" value={user.id}/>
            <label>Role<select name="role" defaultValue={user.role}><option value="member">Community member</option><option value="moderator">Moderator</option><option value="city_official">City official</option><option value="admin">Administrator</option></select></label>
            <label>Official title (public; required for city officials)<input name="officialTitle" defaultValue={user.officialTitle ?? ""} maxLength={120} placeholder="Public Works, City of Texas City"/></label>
          </ActionForm>
          <ActionForm action={setUserSuspended} submitLabel={user.suspendedAt ? "Reinstate account" : "Suspend account"} buttonClassName="secondary-button" className="action-form compact">
            <input type="hidden" name="userId" value={user.id}/>
            <input type="hidden" name="suspend" value={user.suspendedAt ? "false" : "true"}/>
            <label>Reason (admins only)<input name="reason" required minLength={3} maxLength={500}/></label>
          </ActionForm>
          <details><summary>Set a new password</summary>
            <ActionForm action={setUserPassword} submitLabel="Set password" buttonClassName="secondary-button" className="action-form compact">
              <p className="muted">Use this when someone is locked out or forgot their password. It clears any sign-in lockout and signs the account out everywhere. Share the password privately; they must choose their own password when they next sign in.</p>
              <input type="hidden" name="userId" value={user.id}/>
              <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden/>
              <label>New password<input type="password" name="newPassword" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password"/></label>
              <label>Confirm new password<input type="password" name="confirmPassword" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password"/></label>
              <label>Your password (to confirm it&apos;s you)<input type="password" name="adminPassword" required maxLength={MAX_PASSWORD_LENGTH} autoComplete="current-password"/></label>
            </ActionForm>
          </details>
          {(lockedNow || user.failedSignIns > 0) && <ActionForm action={clearSignInLockout} submitLabel="Clear sign-in lockout" buttonClassName="secondary-button" className="action-form compact">
            <input type="hidden" name="userId" value={user.id}/>
          </ActionForm>}
          <ActionForm action={signOutUserEverywhere} submitLabel="Sign out of all devices" buttonClassName="secondary-button" className="action-form compact">
            <input type="hidden" name="userId" value={user.id}/>
            <label>Reason (admins only)<input name="reason" required minLength={3} maxLength={500} placeholder="Lost phone, shared computer…"/></label>
          </ActionForm>
        </details>}
      </li>;
    })}</ul>
  </section>;
}

async function AuditTab({ params }: { params: Search }) {
  const q = params.q?.trim().slice(0, 100);
  const target = z.uuid().safeParse(params.target).data;
  const page = Math.max(1, Math.min(AUDIT_MAX_PAGE, Number.parseInt(params.page ?? "1", 10) || 1));
  const filters: SQL[] = [];
  if (q) filters.push(or(ilike(auditEvents.action, `%${q}%`), ilike(auditEvents.publicSummary, `%${q}%`))!);
  if (target) filters.push(or(eq(auditEvents.targetId, target), eq(auditEvents.actorId, target), eq(auditEvents.needId, target))!);
  const rows = await getDb().select({ event: auditEvents, actorName: users.displayName }).from(auditEvents).leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(filters.length ? and(...filters) : undefined).orderBy(desc(auditEvents.createdAt)).limit(AUDIT_PAGE_SIZE + 1).offset((page - 1) * AUDIT_PAGE_SIZE);
  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const [targetUser] = target ? await getDb().select({ displayName: users.displayName }).from(users).where(eq(users.id, target)).limit(1) : [];
  const pageHref = (value: number) => adminHref({ tab: "audit", q, target, page: value > 1 ? String(value) : undefined });

  return <section className="panel">
    <h2>Full audit log</h2>
    <p className="muted">Includes private details. The public version is on the <Link href="/transparency">transparency page</Link>.</p>
    <form className="filter-form" action="/admin">
      <input type="hidden" name="tab" value="audit"/>
      {target && <input type="hidden" name="target" value={target}/>}
      <input name="q" defaultValue={q} placeholder="Search action or summary, e.g. user.suspended"/>
      <button className="secondary-button">Filter</button>
    </form>
    {target && <p className="muted">Showing events by or about {targetUser ? <strong>{targetUser.displayName}</strong> : "one record"}. <Link href={adminHref({ tab: "audit", q })}>Show all events</Link></p>}
    {rows.length === 0 && <p className="muted">No events match.</p>}
    <div className="table-wrap"><table className="audit-table">
      <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Public summary</th><th>Private details</th></tr></thead>
      <tbody>{rows.slice(0, AUDIT_PAGE_SIZE).map(({ event, actorName }) => <tr key={event.id}>
        <td>{formatDateTime(event.createdAt)}</td>
        <td>{event.actorId ? <Link href={adminHref({ tab: "audit", target: event.actorId })}>{actorName ?? "Deleted account"}</Link> : "System"} <small className="muted">({event.actorRole})</small></td>
        <td><code>{event.action}</code>{event.needId && <> · <Link href={`/needs/${event.needId}`}>report</Link></>}{event.targetType === "user" && event.targetId && <> · <Link href={adminHref({ tab: "audit", target: event.targetId })}>account history</Link></>}</td>
        <td>{event.publicSummary}{event.publicNote && <blockquote>{event.publicNote}</blockquote>}</td>
        <td>{event.privateDetails ? <code>{JSON.stringify(event.privateDetails)}</code> : "—"}</td>
      </tr>)}</tbody>
    </table></div>
    {(page > 1 || hasMore) && <nav className="button-row" aria-label="Audit log pages">
      {page > 1 && <Link className="secondary-button" href={pageHref(page - 1)}>Newer</Link>}
      <span className="muted">Page {page}</span>
      {hasMore && page < AUDIT_MAX_PAGE && <Link className="secondary-button" href={pageHref(page + 1)}>Older</Link>}
    </nav>}
    {hasMore && page === AUDIT_MAX_PAGE && <p className="muted">The audit log is limited to the 100,000 most recent matching events.</p>}
  </section>;
}
