import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, helperCapabilities, helpOffers, jumpStartRequests, needs } from "@/db/schema";
import type { Need } from "@/db/schema";
import type { Viewer } from "@/lib/auth";
import { toMapNeed, type MapNeed, type ViewerOffer } from "@/lib/needs";

export async function loadViewerOffers(viewer: Viewer | null, needIds: string[]) {
  if (!viewer || needIds.length === 0) return new Map<string, { id: string; needId: string; status: string }>();
  const rows = await getDb()
    .select({ id: helpOffers.id, needId: helpOffers.needId, status: helpOffers.status })
    .from(helpOffers)
    .where(and(eq(helpOffers.helperId, viewer.id), inArray(helpOffers.needId, needIds)));
  return new Map(rows.map((row) => [row.needId, row]));
}

async function loadCapabilities(viewer: Viewer | null) {
  if (!viewer) return null;
  const [row] = await getDb().select().from(helperCapabilities).where(eq(helperCapabilities.userId, viewer.id)).limit(1);
  return row ?? null;
}

export async function loadMapNeed(need: Need, viewer: Viewer | null, offer: ViewerOffer | null): Promise<MapNeed> {
  const [[jumpRequest], capability] = await Promise.all([
    getDb().select().from(jumpStartRequests).where(eq(jumpStartRequests.needId, need.id)).limit(1),
    loadCapabilities(viewer),
  ]);
  return toMapNeed(need, viewer, offer, jumpRequest ?? null, capability);
}

/** Visible (not moderated) reports, already filtered for what this viewer may see. */
export async function loadMapNeeds(viewer: Viewer | null): Promise<MapNeed[]> {
  const rows = await getDb().select().from(needs).where(and(eq(needs.hidden, false), eq(needs.reviewStatus, "approved"))).orderBy(desc(needs.createdAt)).limit(200);
  const ids = rows.map((row) => row.id);
  const [offers, jumpRequests, capability] = await Promise.all([
    loadViewerOffers(viewer, ids),
    ids.length ? getDb().select().from(jumpStartRequests).where(inArray(jumpStartRequests.needId, ids)) : Promise.resolve([]),
    loadCapabilities(viewer),
  ]);
  const requests = new Map(jumpRequests.map((row) => [row.needId, row]));
  return rows.map((row) => toMapNeed(row, viewer, offers.get(row.id) ?? null, requests.get(row.id) ?? null, capability));
}

/** Public, privacy-safe history for a single report. */
export async function loadNeedTimeline(needId: string) {
  return getDb()
    .select({
      id: auditEvents.id,
      createdAt: auditEvents.createdAt,
      actorRole: auditEvents.actorRole,
      actorPublicName: auditEvents.actorPublicName,
      publicSummary: auditEvents.publicSummary,
      publicNote: auditEvents.publicNote,
    })
    .from(auditEvents)
    .where(eq(auditEvents.needId, needId))
    .orderBy(asc(auditEvents.createdAt));
}
