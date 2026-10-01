import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, helpOffers, needs } from "@/db/schema";
import type { Viewer } from "@/lib/auth";
import { toMapNeed, type MapNeed } from "@/lib/needs";

export async function loadViewerOffers(viewer: Viewer | null, needIds: string[]) {
  if (!viewer || needIds.length === 0) return new Map<string, { id: string; needId: string; status: string }>();
  const rows = await getDb()
    .select({ id: helpOffers.id, needId: helpOffers.needId, status: helpOffers.status })
    .from(helpOffers)
    .where(and(eq(helpOffers.helperId, viewer.id), inArray(helpOffers.needId, needIds)));
  return new Map(rows.map((row) => [row.needId, row]));
}

/** Visible (not moderated) reports, already filtered for what this viewer may see. */
export async function loadMapNeeds(viewer: Viewer | null): Promise<MapNeed[]> {
  const rows = await getDb().select().from(needs).where(and(eq(needs.hidden, false), eq(needs.reviewStatus, "approved"))).orderBy(desc(needs.createdAt)).limit(200);
  const offers = await loadViewerOffers(viewer, rows.map((row) => row.id));
  return rows.map((row) => toMapNeed(row, viewer, offers.get(row.id) ?? null));
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
