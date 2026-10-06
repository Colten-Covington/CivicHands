import "server-only";
import { getDb } from "@/db";
import { auditEvents } from "@/db/schema";
import type { Viewer } from "@/lib/auth";

export type AuditInput = {
  action: string;
  targetType: "need" | "user" | "helper_application" | "help_offer" | "helper_capability";
  targetId?: string | null;
  needId?: string | null;
  publicSummary: string;
  publicNote?: string | null;
  privateDetails?: Record<string, unknown>;
};

/** Role recorded publicly with every event. Residents and helpers stay anonymous. */
export function actorRole(viewer: Viewer | null) {
  if (!viewer) return "system";
  if (viewer.role !== "member") return viewer.role;
  return viewer.helperStatus === "approved" ? "helper" : "member";
}

/** Only administrators and city officials act in a public capacity, so only they are named. */
export function actorPublicName(viewer: Viewer | null) {
  if (!viewer || viewer.role === "member") return null;
  return viewer.officialTitle ? `${viewer.displayName}, ${viewer.officialTitle}` : viewer.displayName;
}

/** Builds an append-only audit insert so it can be batched with the change it records. */
export function auditInsert(viewer: Viewer | null, event: AuditInput) {
  return getDb().insert(auditEvents).values({
    actorId: viewer?.id ?? null,
    actorRole: actorRole(viewer),
    actorPublicName: actorPublicName(viewer),
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    needId: event.needId ?? null,
    publicSummary: event.publicSummary,
    publicNote: event.publicNote?.trim() || null,
    privateDetails: event.privateDetails ?? null,
  });
}

const roleLabels: Record<string, string> = {
  system: "CivicHands",
  member: "A community member",
  helper: "A vetted helper",
  moderator: "Moderator",
  city_official: "City official",
  admin: "Administrator",
};

export function publicActorLabel(event: { actorRole: string; actorPublicName: string | null }) {
  const role = roleLabels[event.actorRole] ?? "A community member";
  return event.actorPublicName ? `${event.actorPublicName} (${role})` : role;
}
