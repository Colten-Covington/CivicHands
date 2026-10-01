import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { EyeOff, MapPin } from "lucide-react";
import { z } from "zod";
import { NeedActions } from "@/components/need-actions";
import { SiteHeader } from "@/components/site-header";
import { StaffNeedControls } from "@/components/staff-need-controls";
import { Timeline } from "@/components/timeline";
import { getDb } from "@/db";
import { needs } from "@/db/schema";
import { databaseConfigured, getViewer, isStaff } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { kindLabels, statusLabels, toMapNeed } from "@/lib/needs";
import { loadNeedTimeline, loadViewerOffers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!databaseConfigured() || !z.uuid().safeParse(id).success) notFound();
  const viewer = await getViewer();
  const [row] = await getDb().select().from(needs).where(eq(needs.id, id)).limit(1);
  const staff = isStaff(viewer);
  const reporter = Boolean(viewer && row?.reporterId === viewer.id);
  if (!row || (row.hidden && !staff) || (row.reviewStatus !== "approved" && !staff && !reporter)) notFound();

  const offers = await loadViewerOffers(viewer, [row.id]);
  const need = toMapNeed(row, viewer, offers.get(row.id) ?? null);
  const timeline = await loadNeedTimeline(row.id);

  return <main>
    <SiteHeader/>
    <section className="page narrow">
      <Link className="text-link" href="/#explore">← Back to the map</Link>
      <div className="pill-row"><span className="status-pill">{kindLabels[need.kind]}</span><span className="status-pill">{statusLabels[need.status]}</span>{row.hidden && <span className="status-pill warn">Hidden from public map</span>}</div>
      <h1 className="page-title">{need.title}</h1>
      <p className="lede small">{need.description}</p>
      <p className="detail-location">{need.approximate ? <EyeOff size={17}/> : <MapPin size={17}/>}{need.privateLocation ?? need.location}, {need.city}</p>
      <p className="muted">{need.category} · Reported {formatWhen(need.createdAt)}</p>
      {reporter && row.reviewStatus === "changes_requested" && <section className="notice"><strong>A moderator requested wording changes before publication.</strong>{row.moderationFeedback && <p>{row.moderationFeedback}</p>}<p>Open Your account to revise the title and description.</p></section>}
      {staff && row.reviewStatus !== "approved" && <p className="notice">Review status: {row.reviewStatus.replaceAll("_", " ")}. This report is not visible publicly.</p>}
      {need.kind === "city_hazard" && <p className="notice">This is a job for trained city crews. Please stay clear and don&apos;t attempt it yourself. Updates from city officials appear below.</p>}
      <NeedActions need={need} showDetailsLink={false}/>
      {staff && <section className="panel"><h2>Manage report</h2><StaffNeedControls needId={row.id} status={row.status} hidden={row.hidden} reviewStatus={row.reviewStatus} hasReporter={Boolean(row.reporterId)}/></section>}
      <section className="panel">
        <h2>Public history</h2>
        <p className="muted">Every change is recorded. Residents and helpers appear by role only; moderators, city officials, and administrators are named.</p>
        <Timeline events={timeline}/>
      </section>
    </section>
  </main>;
}
