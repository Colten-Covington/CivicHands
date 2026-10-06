import type { HelperCapability, JumpStartRequest, Need } from "@/db/schema";
import type { Viewer } from "@/lib/auth";
import { isPetReportCategory } from "@/lib/report-categories";

export const statusLabels: Record<string, string> = {
  open: "Open",
  claimed: "In progress",
  completed: "Completed",
  referred: "Referred to city",
  closed: "Closed",
};

export const kindLabels: Record<string, string> = {
  public_cleanup: "Community-ready",
  city_hazard: "City referral",
  neighbor_help: "Neighbor support",
};

export const APPROXIMATE_LOCATION = "Approximate area · exact location shared only with the accepted helper";

export type NeedAction =
  | "demo"
  | "sign_in"
  | "offer"
  | "apply_helper"
  | "capability_required"
  | "pending"
  | "assigned"
  | "reporter"
  | "follow"
  | "unavailable";

export type MapNeed = {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: string;
  requestType: string;
  requiredEquipment: string[];
  vehicleType: string | null;
  location: string;
  privateLocation: string | null;
  privateLocationDetails?: string | null;
  city: string;
  status: string;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  approximate: boolean;
  action: NeedAction;
  offerId: string | null;
};

export type ViewerOffer = { id: string; needId: string; status: string };

/** Rounds to a ~1 km grid so a neighbor's home can't be located from the public map. */
function generalize(value: number | null) {
  return value === null ? null : Math.round(value * 100) / 100;
}

/**
 * Converts a stored report into the shape sent to the browser. Exact neighbor-support
 * locations and jump-start vehicle details are only included for the requester and accepted helper.
 */
export function toMapNeed(
  need: Need,
  viewer: Viewer | null,
  offer: ViewerOffer | null,
  jumpRequest: JumpStartRequest | null = null,
  capability: HelperCapability | null = null,
): MapNeed {
  const isReporter = Boolean(viewer && need.reporterId === viewer.id);
  const petReport = isPetReportCategory(need.category);
  const isAssigned = (offer?.status === "accepted" || offer?.status === "completed") && (need.kind !== "neighbor_help" || petReport || viewer?.helperStatus === "approved");
  const sensitive = need.kind === "neighbor_help" || need.detailsPrivate;
  const exact = !sensitive || isReporter || (isAssigned && !petReport);
  const requiredEquipment = jumpRequest
    ? [
        ...(jumpRequest.needsCables ? ["Jumper cables"] : []),
        ...(jumpRequest.needsJumpPack ? ["Portable jump pack"] : []),
      ]
    : [];
  const hasMatchingEquipment = Boolean(capability && jumpRequest && (
    (jumpRequest.needsCables && capability.jumperCables) ||
    (jumpRequest.needsJumpPack && capability.jumpPack)
  ));

  let action: NeedAction;
  if (need.kind === "city_hazard") action = "follow";
  else if (!viewer) action = need.status === "open" ? "sign_in" : "unavailable";
  else if (isReporter) action = "reporter";
  else if (offer?.status === "accepted") action = "assigned";
  else if (offer?.status === "pending") action = "pending";
  else if (need.status !== "open") action = "unavailable";
  else if (need.kind === "neighbor_help" && viewer.helperStatus !== "approved" && !petReport) action = "apply_helper";
  else if (need.requestType === "jump_start" && !hasMatchingEquipment) action = "capability_required";
  else action = "offer";

  return {
    id: need.id,
    title: need.title,
    description: need.description,
    category: need.category,
    kind: need.kind,
    requestType: need.requestType,
    requiredEquipment,
    vehicleType: exact ? jumpRequest?.vehicleType ?? null : null,
    location: exact ? need.privateLocation ?? need.location : need.location || APPROXIMATE_LOCATION,
    privateLocation: exact ? need.privateLocation : null,
    privateLocationDetails: exact ? need.privateLocationDetails : null,
    city: need.city,
    status: need.status,
    createdAt: need.createdAt.toISOString(),
    latitude: exact ? need.latitude : generalize(need.latitude),
    longitude: exact ? need.longitude : generalize(need.longitude),
    approximate: !exact,
    action,
    offerId: offer?.id ?? null,
  };
}

/** Fields safe for anyone, used by the public JSON API. */
export function toPublicNeed(need: Need) {
  const mapNeed = toMapNeed(need, null, null);
  return {
    id: mapNeed.id,
    title: mapNeed.title,
    description: mapNeed.description,
    category: mapNeed.category,
    kind: mapNeed.kind,
    requestType: mapNeed.requestType,
    requiredEquipment: mapNeed.requiredEquipment,
    location: mapNeed.location,
    city: mapNeed.city,
    status: mapNeed.status,
    createdAt: mapNeed.createdAt,
    latitude: mapNeed.latitude,
    longitude: mapNeed.longitude,
    approximate: mapNeed.approximate,
  };
}
