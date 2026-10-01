import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { reviewHelperApplication, revokeHelper, setUserRole, setUserSuspended } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { SiteHeader } from "@/components/site-header";
import { StaffNeedControls } from "@/components/staff-need-controls";
import { getDb } from "@/db";
import { auditEvents, helperApplications, needs, users } from "@/db/schema";
import { isAdmin, isStaff, requireViewer } from "@/lib/auth";
import { formatDateTime, formatWhen } from "@/lib/format";
import { kindLabels, statusLabels } from "@/lib/needs";

export const metadata = { title: "Administration — CivicHands" };
export const dynamic = "force-dynamic";

type Search = { tab?: string; q?: string; status?: string; visibility?: string };
const needStatuses = ["open", "claimed", "completed", "referred", "closed"] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer("/admin");
  if (!isStaff(viewer)) notFound();
  const admin = isAdmin(viewer);
  const params = await searchParams;
  const tabs = admin ? [["reports", "Reports"], ["helpers", "Helper vetting"], ["users", "Users & roles"], ["audit", "Full audit log"]] : [["reports", "Reports"]];
  const tab = tabs.some(([key]) => key === params.tab) ? params.tab! : "reports";

  return <main>
    <SiteHeader/>
    <section className="page">
      <p className="eyebrow">{admin ? "Administrator" : `City official${viewer.officialTitle ? ` · ${viewer.officialTitle}` : ""}`}</p>
      <h1 className="page-title">{admin ? "Administration" : "Manage reports"}</h1>
      <p className="muted">Every action here is recorded in the <Link href="/transparency">public audit log</Link> under your name. Private notes and reasons are visible to administrators only.</p>
      <nav className="tab-row" aria-label="Admin sections">{tabs.map(([key, label]) => <Link key={key} className={tab === key ? "active" : ""} href={`/admin?tab=${key}`}>{label}</Link>)}</nav>
      {tab === "reports" && <ReportsTab params={params}/>}
      {tab === "helpers" && admin && <HelpersTab/>}
      {tab === "users" && admin && <UsersTab q={params.q} viewerId={viewer.id}/>}
      {tab === "audit" && admin && <AuditTab/>}
    </section>
  </main>;
}

async function ReportsTab({ params }: { params: Search }) {
  const filters: SQL[] = [];
  const status = needStatuses.find((value) => value === params.status);
  if (status) filters.push(eq(needs.status, status));
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
      <select name="visibility" defaultValue={params.visibility ?? ""}><option value="">Visible &amp; hidden</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select>
      <button className="secondary-button">Filter</button>
    </form>
    {rows.length === 0 && <p className="muted">No reports match.</p>}
    <ul className="item-list">{rows.map((need) => <li key={need.id}>
      <div className="item-head"><Link href={`/needs/${need.id}`}><strong>{need.title}</strong></Link><span className="status-pill">{kindLabels[need.kind]}</span><span className="status-pill">{statusLabels[need.status]}</span>{need.hidden && <span className="status-pill warn">Hidden</span>}</div>
      <small className="muted">{need.kind === "neighbor_help" ? "Approximate area (exact location private)" : need.location}, {need.city} · updated {formatWhen(need.updatedAt)}</small>
      <details><summary>Manage</summary><StaffNeedControls needId={need.id} status={need.status} hidden={need.hidden}/></details>
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

async function UsersTab({ q, viewerId }: { q?: string; viewerId: string }) {
  const term = q?.trim().slice(0, 100);
  const rows = await getDb().select().from(users).where(term ? or(ilike(users.email, `%${term}%`), ilike(users.displayName, `%${term}%`)) : undefined).orderBy(desc(users.createdAt)).limit(50);
  return <section>
    <form className="filter-form" action="/admin">
      <input type="hidden" name="tab" value="users"/>
      <input name="q" defaultValue={term} placeholder="Search by name or email"/>
      <button className="secondary-button">Search</button>
    </form>
    <ul className="item-list">{rows.map((user) => <li key={user.id}>
      <div className="item-head"><strong>{user.displayName}</strong><span className="status-pill">{user.role === "city_official" ? "City official" : user.role === "admin" ? "Administrator" : "Member"}</span>{user.helperStatus !== "none" && <span className="status-pill">Helper: {user.helperStatus}</span>}{user.suspendedAt && <span className="status-pill warn">Suspended</span>}</div>
      <small className="muted">{user.email}{user.officialTitle ? ` · ${user.officialTitle}` : ""} · joined {formatWhen(user.createdAt)}</small>
      {user.id === viewerId ? <p className="muted">This is you. Another administrator must change your role or status.</p> : <details><summary>Manage</summary>
        <ActionForm action={setUserRole} submitLabel="Save role" className="action-form compact">
          <input type="hidden" name="userId" value={user.id}/>
          <label>Role<select name="role" defaultValue={user.role}><option value="member">Community member</option><option value="city_official">City official</option><option value="admin">Administrator</option></select></label>
          <label>Official title (public; required for city officials)<input name="officialTitle" defaultValue={user.officialTitle ?? ""} maxLength={120} placeholder="Public Works, City of Texas City"/></label>
        </ActionForm>
        <ActionForm action={setUserSuspended} submitLabel={user.suspendedAt ? "Reinstate account" : "Suspend account"} buttonClassName="secondary-button" className="action-form compact">
          <input type="hidden" name="userId" value={user.id}/>
          <input type="hidden" name="suspend" value={user.suspendedAt ? "false" : "true"}/>
          <label>Reason (admins only)<input name="reason" required minLength={3} maxLength={500}/></label>
        </ActionForm>
      </details>}
    </li>)}</ul>
  </section>;
}

async function AuditTab() {
  const rows = await getDb().select({ event: auditEvents, actorName: users.displayName }).from(auditEvents).leftJoin(users, eq(users.id, auditEvents.actorId)).orderBy(desc(auditEvents.createdAt)).limit(200);
  return <section className="panel">
    <h2>Full audit log (latest 200)</h2>
    <p className="muted">Includes private details. The public version is on the <Link href="/transparency">transparency page</Link>.</p>
    <div className="table-wrap"><table className="audit-table">
      <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Public summary</th><th>Private details</th></tr></thead>
      <tbody>{rows.map(({ event, actorName }) => <tr key={event.id}>
        <td>{formatDateTime(event.createdAt)}</td>
        <td>{actorName ?? "System"} <small className="muted">({event.actorRole})</small></td>
        <td><code>{event.action}</code>{event.needId && <> · <Link href={`/needs/${event.needId}`}>report</Link></>}</td>
        <td>{event.publicSummary}{event.publicNote && <blockquote>{event.publicNote}</blockquote>}</td>
        <td>{event.privateDetails ? <code>{JSON.stringify(event.privateDetails)}</code> : "—"}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
