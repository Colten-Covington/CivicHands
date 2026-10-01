import type { Need } from "@/db/schema";
import type { Viewer } from "@/lib/auth";

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
  location: string;
  privateLocation: string | null;
  city: string;
  status: string;
  createdAt: string;
  latitude: number;
  longitude: number;
  approximate: boolean;
  action: NeedAction;
  offerId: string | null;
};

export type ViewerOffer = { id: string; needId: string; status: string };

/** Rounds to a ~1 km grid so a neighbor's home can't be located from the public map. */
function generalize(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Converts a stored report into the shape sent to the browser. Exact neighbor-support
 * locations are only included for the requester and the accepted helper.
 */
export function toMapNeed(need: Need, viewer: Viewer | null, offer: ViewerOffer | null): MapNeed {
  const isReporter = Boolean(viewer && need.reporterId === viewer.id);
  // Neighbor-support details require the helper to still be vetted.
  const isAssigned = (offer?.status === "accepted" || offer?.status === "completed") && (need.kind !== "neighbor_help" || viewer?.helperStatus === "approved");
  const sensitive = need.kind === "neighbor_help" || need.detailsPrivate;
  const exact = !sensitive || isReporter || isAssigned;

  let action: NeedAction;
  if (need.kind === "city_hazard") action = "follow";
  else if (!viewer) action = need.status === "open" ? "sign_in" : "unavailable";
  else if (isReporter) action = "reporter";
  else if (offer?.status === "accepted") action = "assigned";
  else if (offer?.status === "pending") action = "pending";
  else if (need.status !== "open") action = "unavailable";
  else if (need.kind === "neighbor_help" && viewer.helperStatus !== "approved") action = "apply_helper";
  else action = "offer";

  return {
    id: need.id,
    title: need.title,
    description: need.description,
    category: need.category,
    kind: need.kind,
    location: exact ? need.location : APPROXIMATE_LOCATION,
    privateLocation: exact ? need.privateLocation : null,
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
  const { id, title, description, category, kind, location, city, status, createdAt, latitude, longitude, approximate } = toMapNeed(need, null, null);
  return { id, title, description, category, kind, location, city, status, createdAt, latitude, longitude, approximate };
}
