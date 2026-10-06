export const REPORT_CATEGORIES = [
  { id: "neighborhood_cleanup", label: "Neighborhood cleanup or litter pickup", kind: "public_cleanup", defaultTitle: "Neighborhood cleanup help", defaultDescription: "A neighbor reported a small, safe community cleanup task." },
  { id: "park_cleanup", label: "Park or public-space cleanup", kind: "public_cleanup", defaultTitle: "Public-space cleanup help", defaultDescription: "A neighbor reported a small, safe community cleanup task." },
  { id: "community_garden", label: "Community garden or watering help", kind: "public_cleanup", defaultTitle: "Community garden help", defaultDescription: "A neighbor is asking for help with a community garden." },
  { id: "event_setup", label: "Community event setup or cleanup", kind: "public_cleanup", defaultTitle: "Community event help", defaultDescription: "A neighbor is asking for help with a community event." },
  { id: "graffiti_cleanup", label: "Graffiti cleanup (with permission)", kind: "public_cleanup", defaultTitle: "Graffiti cleanup help", defaultDescription: "A neighbor is asking for permission-based cleanup help." },
  { id: "other_community", label: "Other safe community task", kind: "public_cleanup", defaultTitle: "Community help requested", defaultDescription: "A neighbor is asking for safe community help." },
  { id: "yard_help", label: "Yardwork or light outdoor help", kind: "neighbor_help", defaultTitle: "Neighbor help requested", defaultDescription: "A neighbor is asking for help with a small task." },
  { id: "groceries_supplies", label: "Groceries or essential supplies", kind: "neighbor_help", defaultTitle: "Essential supplies requested", defaultDescription: "A neighbor is asking for help with essential supplies." },
  { id: "carrying_items", label: "Carry or move a few items", kind: "neighbor_help", defaultTitle: "Help carrying items", defaultDescription: "A neighbor is asking for help carrying a few items." },
  { id: "small_home_task", label: "Small household task", kind: "neighbor_help", defaultTitle: "Small household help requested", defaultDescription: "A neighbor is asking for help with a small, non-specialist household task." },
  { id: "accessibility_help", label: "Temporary accessibility or entry help", kind: "neighbor_help", defaultTitle: "Accessibility help requested", defaultDescription: "A neighbor is asking for practical, non-medical accessibility help." },
  { id: "device_help", label: "Phone, computer, or technology help", kind: "neighbor_help", defaultTitle: "Technology help requested", defaultDescription: "A neighbor is asking for basic technology help." },
  { id: "translation_help", label: "Translation or form navigation", kind: "neighbor_help", defaultTitle: "Communication help requested", defaultDescription: "A neighbor is asking for language or form-navigation help, not legal or medical advice." },
  { id: "friendly_checkin", label: "Friendly call or check-in", kind: "neighbor_help", defaultTitle: "Neighbor check-in requested", defaultDescription: "A neighbor is asking for a friendly, non-medical check-in." },
  { id: "pet_care", label: "Pet care or supply help", kind: "neighbor_help", defaultTitle: "Pet help requested", defaultDescription: "A neighbor is asking for practical pet-care or supply help." },
  { id: "lost_pet", label: "Help with a lost pet", kind: "neighbor_help", defaultTitle: "Help find a lost pet", defaultDescription: "A neighbor is asking for help sharing safe sightings of a lost pet." },
  { id: "found_pet", label: "Help reunite a found pet", kind: "neighbor_help", defaultTitle: "Help reunite a found pet", defaultDescription: "A neighbor is asking for help safely reuniting a found pet with its owner." },
  { id: "jump_start", label: "Jump start (safe parking only)", kind: "neighbor_help", defaultTitle: "Jump start needed", defaultDescription: "A neighbor is requesting a jump start with compatible equipment." },
  { id: "tool_share", label: "Borrow or lend a tool", kind: "neighbor_help", defaultTitle: "Tool sharing requested", defaultDescription: "A neighbor is asking to borrow or lend a tool." },
  { id: "resource_navigation", label: "Find food, supplies, or a community resource", kind: "neighbor_help", defaultTitle: "Community resource help requested", defaultDescription: "A neighbor is asking for help finding a local resource." },
  { id: "other_neighbor", label: "Other neighbor-to-neighbor help", kind: "neighbor_help", defaultTitle: "Neighbor help requested", defaultDescription: "A neighbor is asking for practical, safe help." },
  { id: "tow_referral", label: "Tow or roadside assistance (professional service)", kind: "external_referral", defaultTitle: "Professional tow assistance", defaultDescription: "This service is handled by a licensed roadside provider, not community volunteers." },
  { id: "road_damage", label: "Pothole, sidewalk, or curb issue", kind: "city_hazard", defaultTitle: "Street or sidewalk issue reported", defaultDescription: "A community member reported a street or sidewalk issue for review." },
  { id: "streetlight_sign", label: "Streetlight, sign, or traffic signal", kind: "city_hazard", defaultTitle: "Public infrastructure issue reported", defaultDescription: "A community member reported a public infrastructure issue for review." },
  { id: "drain_flooding", label: "Blocked drain or non-emergency flooding", kind: "city_hazard", defaultTitle: "Drainage issue reported", defaultDescription: "A community member reported a drainage issue for review." },
  { id: "dumping", label: "Large dumping or public-space debris", kind: "city_hazard", defaultTitle: "Public-space debris reported", defaultDescription: "A community member reported debris for review." },
  { id: "tree_hazard", label: "Damaged tree or limb near public space", kind: "city_hazard", defaultTitle: "Tree hazard reported", defaultDescription: "A community member reported a tree issue for trained crews to review." },
  { id: "utility_hazard", label: "Utility, gas, wire, or water hazard", kind: "city_hazard", defaultTitle: "Utility hazard reported", defaultDescription: "A community member reported a utility hazard for trained crews to review." },
  { id: "other_city_issue", label: "Other city or public-space issue", kind: "city_hazard", defaultTitle: "Public-space issue reported", defaultDescription: "A community member reported a public-space issue for review." },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ReportKind = ReportCategory["kind"];
export function isReportCategory(value: string): value is ReportCategory["id"] { return REPORT_CATEGORIES.some((category) => category.id === value); }
export function getReportCategory(value: string): ReportCategory { return REPORT_CATEGORIES.find((category) => category.id === value) ?? REPORT_CATEGORIES[0]; }

export function isPetReportCategory(value: string) {
  return REPORT_CATEGORIES.some((category) =>
    (category.id === "lost_pet" || category.id === "found_pet") &&
    (value === category.id || value === category.label)
  );
}
