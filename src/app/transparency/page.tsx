import Link from "next/link";
import { count, desc, eq, inArray, isNull, and } from "drizzle-orm";
import { SiteHeader } from "@/components/site-header";
import { Timeline } from "@/components/timeline";
import { getDb } from "@/db";
import { auditEvents, needs, users } from "@/db/schema";
import { databaseConfigured } from "@/lib/auth";
import { statusLabels } from "@/lib/needs";

export const metadata = { title: "Transparency — CivicHands" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;

export default async function TransparencyPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Math.min(1000, Number.parseInt((await searchParams).page ?? "1", 10) || 1));
  if (!databaseConfigured()) return <main><SiteHeader/><section className="page"><h1 className="page-title">Transparency</h1><p className="notice">The public audit log is available once this deployment is connected to a database.</p></section></main>;

  const db = getDb();
  const [events, statusCounts, [helpers], officials] = await Promise.all([
    db.select({
      id: auditEvents.id, createdAt: auditEvents.createdAt, actorRole: auditEvents.actorRole, actorPublicName: auditEvents.actorPublicName,
      publicSummary: auditEvents.publicSummary, publicNote: auditEvents.publicNote, needId: auditEvents.needId, needTitle: needs.title, needHidden: needs.hidden, needReviewStatus: needs.reviewStatus,
    }).from(auditEvents).leftJoin(needs, eq(needs.id, auditEvents.needId)).orderBy(desc(auditEvents.createdAt)).limit(PAGE_SIZE + 1).offset((page - 1) * PAGE_SIZE),
    db.select({ status: needs.status, total: count() }).from(needs).where(and(eq(needs.hidden, false), eq(needs.reviewStatus, "approved"))).groupBy(needs.status),
    db.select({ total: count() }).from(users).where(and(eq(users.helperStatus, "approved"), isNull(users.suspendedAt))),
    db.select({ displayName: users.displayName, role: users.role, officialTitle: users.officialTitle }).from(users).where(and(inArray(users.role, ["moderator", "city_official", "admin"]), isNull(users.suspendedAt))).orderBy(users.role, users.displayName),
  ]);
  const hasMore = events.length > PAGE_SIZE;

  return <main>
    <SiteHeader/>
    <section className="page">
      <p className="eyebrow">Open by default</p>
      <h1 className="page-title">Transparency</h1>
      <p className="lede small">Every report, offer, moderation decision, helper vetting decision, and role change is recorded here. Residents and helpers are shown by role only, and private details — emails, exact neighbor addresses, offer messages, applications, and moderation reasons — are never published. Moderators, city officials, and administrators act in a public capacity and are named.</p>

      <div className="stat-grid">
        {Object.entries(statusLabels).map(([status, label]) => <div key={status}><strong>{statusCounts.find((row) => row.status === status)?.total ?? 0}</strong><span>{label}</span></div>)}
        <div><strong>{helpers?.total ?? 0}</strong><span>Vetted helpers</span></div>
      </div>

      <section className="panel">
        <h2>Who can manage reports</h2>
        {officials.length === 0 ? <p className="muted">No moderators, city officials, or administrators have been designated yet.</p> : <ul className="item-list">{officials.map((person, index) => <li key={index}><strong>{person.displayName}</strong> <span className="status-pill">{person.role === "admin" ? "Administrator" : person.role === "moderator" ? "Moderator" : "City official"}</span>{person.officialTitle && <small className="muted"> {person.officialTitle}</small>}</li>)}</ul>}
      </section>

      <section className="panel">
        <h2>Audit log</h2>
        <Timeline events={events.slice(0, PAGE_SIZE).map((event) => ({
          ...event,
          href: event.needId && event.needTitle && !event.needHidden && event.needReviewStatus === "approved" ? `/needs/${event.needId}` : null,
          linkLabel: event.needId && event.needTitle && !event.needHidden && event.needReviewStatus === "approved" ? event.needTitle : null,
        }))}/>
        <div className="button-row">
          {page > 1 && <Link className="secondary-button" href={`/transparency?page=${page - 1}`}>Newer</Link>}
          {hasMore && <Link className="secondary-button" href={`/transparency?page=${page + 1}`}>Older</Link>}
        </div>
      </section>
    </section>
  </main>;
}
