import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { changePassword } from "@/app/actions/auth";
import { applyAsHelper, resubmitNeedWording } from "@/app/actions/needs";
import { ActionForm } from "@/components/action-form";
import { OfferResponse } from "@/components/offer-response";
import { SiteHeader } from "@/components/site-header";
import { getDb } from "@/db";
import { helperApplications, helpOffers, needs, users } from "@/db/schema";
import { isStaff, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, requireViewer } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { kindLabels, statusLabels } from "@/lib/needs";

export const metadata = { title: "Your account — CivicHands" };
export const dynamic = "force-dynamic";

const roleLabels = { member: "Community member", moderator: "Moderator", city_official: "City official", admin: "Administrator" } as const;
const helperCopy = {
  none: "Vetted helpers can offer neighbor support, where privacy and safety matter most.",
  pending: "Your helper application is being reviewed by an administrator.",
  approved: "You're a vetted helper. You can offer neighbor support on the map.",
  rejected: "Your last helper application wasn't approved. You're welcome to apply again with more detail.",
  revoked: "Your vetted helper status was revoked. Please contact the administrators if you have questions.",
} as const;

export default async function AccountPage() {
  const viewer = await requireViewer("/account");
  const db = getDb();
  const [myReports, myOffers, [lastApplication]] = await Promise.all([
    db.select().from(needs).where(eq(needs.reporterId, viewer.id)).orderBy(desc(needs.createdAt)).limit(100),
    db.select({ offer: helpOffers, need: { id: needs.id, title: needs.title, status: needs.status, kind: needs.kind, hidden: needs.hidden } }).from(helpOffers).innerJoin(needs, eq(needs.id, helpOffers.needId)).where(eq(helpOffers.helperId, viewer.id)).orderBy(desc(helpOffers.createdAt)).limit(100),
    db.select({ status: helperApplications.status, createdAt: helperApplications.createdAt }).from(helperApplications).where(eq(helperApplications.userId, viewer.id)).orderBy(desc(helperApplications.createdAt)).limit(1),
  ]);

  const reportIds = myReports.map((need) => need.id);
  const incoming = reportIds.length
    ? await db.select({ offer: helpOffers, helperName: users.displayName, helperSince: users.createdAt, helperStatus: users.helperStatus }).from(helpOffers).innerJoin(users, eq(users.id, helpOffers.helperId)).where(and(inArray(helpOffers.needId, reportIds), inArray(helpOffers.status, ["pending", "accepted", "completed"]))).orderBy(desc(helpOffers.createdAt))
    : [];
  const helperIds = [...new Set(incoming.map((row) => row.offer.helperId))];
  const history = helperIds.length
    ? await db.select({ helperId: helpOffers.helperId, completed: count() }).from(helpOffers).where(and(inArray(helpOffers.helperId, helperIds), eq(helpOffers.status, "completed"))).groupBy(helpOffers.helperId)
    : [];
  const completedBy = new Map(history.map((row) => [row.helperId, row.completed]));

  return <main>
    <SiteHeader/>
    <section className="page">
      <p className="eyebrow">Your account</p>
      <h1 className="page-title">Hello, {viewer.displayName}</h1>
      <div className="pill-row"><span className="status-pill">{roleLabels[viewer.role]}</span>{viewer.officialTitle && <span className="status-pill">{viewer.officialTitle}</span>}{viewer.helperStatus === "approved" && <span className="status-pill verified">Vetted helper</span>}</div>
      {isStaff(viewer) && <p><Link className="text-link" href="/admin">{viewer.role === "admin" ? "Open administration" : "Manage reports"}</Link></p>}

      <section className="panel" id="helper">
        <h2>Neighbor support helper</h2>
        <p>{helperCopy[viewer.helperStatus]}</p>
        {lastApplication && <p className="muted">Last application: {formatWhen(lastApplication.createdAt)} · {lastApplication.status}</p>}
        {(viewer.helperStatus === "none" || viewer.helperStatus === "rejected") && <ActionForm action={applyAsHelper} submitLabel="Submit application" pendingLabel="Submitting…">
          <label>Why would you like to help neighbors?<textarea name="motivation" required minLength={20} maxLength={1000}/></label>
          <label>Relevant experience, references, or affiliations<textarea name="experience" required minLength={10} maxLength={1000} placeholder="Church or nonprofit volunteering, trade skills, references administrators can contact…"/></label>
          <label className="checkbox"><input type="checkbox" name="agree" required/>I&apos;ll keep requesters&apos; locations and details private, follow safety guidelines, and understand administrators may revoke access.</label>
          <p className="muted">Your application is visible only to administrators. The public audit log records only that an application was submitted and decided.</p>
        </ActionForm>}
      </section>

      <section className="panel" id="password">
        <h2>Password</h2>
        {viewer.mustChangePassword
          ? <p className="form-error" role="status">You&apos;re signed in with a temporary password. Choose your own password to continue{viewer.role === "member" ? "" : "; administration tools are paused until you do"}.</p>
          : <p className="muted">Changing your password signs you out on your other devices.</p>}
        <ActionForm action={changePassword} submitLabel="Change password" pendingLabel="Changing…">
          <label>Current password<input type="password" name="currentPassword" required maxLength={MAX_PASSWORD_LENGTH} autoComplete="current-password"/></label>
          <label>New password<input type="password" name="newPassword" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password"/></label>
          <label>Confirm new password<input type="password" name="confirmPassword" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password"/></label>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Your reports</h2>
        {myReports.length === 0 && <p className="muted">You haven&apos;t pinned any reports yet. <Link href="/#explore">Open the map</Link>.</p>}
        <ul className="item-list">{myReports.map((need) => {
          const offers = incoming.filter((row) => row.offer.needId === need.id);
          return <li key={need.id}>
            <div className="item-head"><Link href={`/needs/${need.id}`}><strong>{need.title}</strong></Link><span className="status-pill">{statusLabels[need.status]}</span>{need.hidden && <span className="status-pill warn">Hidden by moderators</span>}</div>
            <small className="muted">{kindLabels[need.kind]} · {formatWhen(need.createdAt)}</small>
            {need.reviewStatus === "pending" && <p className="muted">Awaiting moderator review before publication.</p>}
            {need.reviewStatus === "rejected" && <p className="muted">This report was not approved for publication.</p>}
            {need.reviewStatus === "changes_requested" && <details open>
              <summary>Moderator requested wording changes</summary>
              {need.moderationFeedback && <p className="muted">{need.moderationFeedback}</p>}
              <ActionForm action={resubmitNeedWording} submitLabel="Resubmit for review" className="action-form compact">
                <input type="hidden" name="needId" value={need.id}/>
                <label>Revised title<input name="title" required minLength={5} maxLength={100} defaultValue={need.title}/></label>
                <label>Revised description<textarea name="description" required minLength={10} maxLength={1000} defaultValue={need.description}/></label>
              </ActionForm>
            </details>}
            {offers.map(({ offer, helperName, helperSince, helperStatus }) => <div className="offer-card" key={offer.id}>
              <div><strong>{helperName}</strong>{helperStatus === "approved" && <span className="status-pill verified">Vetted helper</span>}</div>
              <small className="muted">Member since {formatWhen(helperSince)} · {completedBy.get(offer.helperId) ?? 0} completed {completedBy.get(offer.helperId) === 1 ? "task" : "tasks"}</small>
              {offer.message && <p>“{offer.message}”</p>}
              {offer.status === "pending" && need.status === "open" ? <OfferResponse offerId={offer.id}/> : <small className="muted">Offer {offer.status}</small>}
            </div>)}
          </li>;
        })}</ul>
      </section>

      <section className="panel">
        <h2>Where you&apos;re helping</h2>
        {myOffers.length === 0 && <p className="muted">No offers yet.</p>}
        <ul className="item-list">{myOffers.map(({ offer, need }) => <li key={offer.id}>
          <div className="item-head">{need.hidden ? <strong>{need.title}</strong> : <Link href={`/needs/${need.id}`}><strong>{need.title}</strong></Link>}<span className="status-pill">Offer {offer.status}</span><span className="status-pill">{statusLabels[need.status]}</span></div>
          <small className="muted">{kindLabels[need.kind]} · offered {formatWhen(offer.createdAt)}</small>
        </li>)}</ul>
      </section>
    </section>
  </main>;
}
