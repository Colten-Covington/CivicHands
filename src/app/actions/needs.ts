"use server";
import { randomUUID } from "node:crypto";
import { and, count, eq, gt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { helperApplications, helperCapabilities, helpOffers, jumpStartRequests, needs, users } from "@/db/schema";
import { fail, ok, type ActionResult, type ActionState } from "@/lib/action-state";
import { auditInsert } from "@/lib/audit";
import { getViewer } from "@/lib/auth";
import { APPROXIMATE_LOCATION } from "@/lib/needs";
import { getReportCategory, isPetReportCategory, isReportCategory } from "@/lib/report-categories";

const MAX_REPORTS_PER_DAY = 10;

const reportSchema = z.object({
  title: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  category: z.string().refine(isReportCategory),
  location: z.string().trim().max(240).optional(),
  area: z.string().trim().max(160).optional(),
  locationDetails: z.string().trim().max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  city: z.string().trim().min(2).max(80).default("Texas City"),
  needsCables: z.literal("on").optional(),
  needsJumpPack: z.literal("on").optional(),
  vehicleType: z.enum(["passenger_car", "light_truck"]).optional(),
  safeLocationConfirmed: z.literal("on").optional(),
  standard12vConfirmed: z.literal("on").optional(),
  hazardFreeConfirmed: z.literal("on").optional(),
}).refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
  message: "Choose both map coordinates or leave both unset.",
});

const idSchema = z.uuid();
const messageSchema = z.string().trim().max(500).optional();

async function helperHasJumpStartGear(helperId: string, needId: string) {
  const [[request], [capability]] = await Promise.all([
    getDb().select().from(jumpStartRequests).where(eq(jumpStartRequests.needId, needId)).limit(1),
    getDb().select().from(helperCapabilities).where(eq(helperCapabilities.userId, helperId)).limit(1),
  ]);
  return Boolean(request && capability && (
    (request.needsCables && capability.jumperCables) ||
    (request.needsJumpPack && capability.jumpPack)
  ));
}

function refresh(needId?: string) {
  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/transparency");
  if (needId) revalidatePath(`/needs/${needId}`);
}

export async function createNeed(input: unknown): Promise<ActionResult & { id?: string }> {
  const viewer = await getViewer();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the report details.");
  const data = parsed.data;
  const selectedCategory = getReportCategory(data.category);
  if (selectedCategory.kind === "external_referral") return fail("CivicHands does not dispatch towing. Use the TDLR towing information link for a professional provider.");
  const kind = selectedCategory.kind;
  const requestType = data.category === "jump_start" ? "jump_start" : "general";
  if (!viewer && kind === "neighbor_help") return fail("Sign in to submit a private neighbor-support request. Your exact location and private details will only be shared with the helper you choose.");
  if (requestType === "jump_start") {
    if (!data.needsCables && !data.needsJumpPack) return fail("Choose jumper cables, a jump pack, or both.");
    if (!data.vehicleType || data.safeLocationConfirmed !== "on" || data.standard12vConfirmed !== "on" || data.hazardFreeConfirmed !== "on") {
      return fail("Jump-start matching is limited to a safe off-road location, a standard 12V vehicle, and no visible hazards. If any condition is uncertain, contact professional roadside assistance.");
    }
  }
  if (viewer) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ value: recent }] = await getDb().select({ value: count() }).from(needs).where(and(eq(needs.reporterId, viewer.id), gt(needs.createdAt, since)));
    if (recent >= MAX_REPORTS_PER_DAY) return fail("You've reached today's report limit. Please try again tomorrow.");
  }
  const isNeighbor = kind === "neighbor_help";
  const title = data.title?.trim() || selectedCategory.defaultTitle;
  const description = data.description?.trim() || selectedCategory.defaultDescription;
  const location = data.location?.trim() || (data.latitude !== undefined ? "GPS location selected" : "Approximate area; no map pin");
  const publicArea = data.area?.trim() || (data.latitude !== undefined ? APPROXIMATE_LOCATION : `${data.city} · no map pin`);
  const privateLocationDetails = isNeighbor ? data.locationDetails?.trim() || null : null;
  const needId = randomUUID();
  await getDb().batch([
    getDb().insert(needs).values({
      id: needId,
      title: requestType === "jump_start" ? "Jump start needed" : title,
      description: requestType === "jump_start" ? "A neighbor is requesting a jump start with compatible equipment. Exact location and vehicle notes are shared only with the accepted helper." : description,
      kind,
      category: selectedCategory.label,
      requestType,
      location: isNeighbor ? publicArea : location,
      privateLocation: isNeighbor ? location : null,
      privateLocationDetails,
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      reporterName: "A neighbor",
      reporterId: viewer?.id ?? null,
      detailsPrivate: isNeighbor,
      status: kind === "city_hazard" ? "referred" : "open",
      reviewStatus: "pending",
    }),
    ...(requestType === "jump_start" ? [getDb().insert(jumpStartRequests).values({
      needId,
      needsCables: Boolean(data.needsCables),
      needsJumpPack: Boolean(data.needsJumpPack),
      vehicleType: data.vehicleType!,
      safeLocationConfirmed: data.safeLocationConfirmed === "on",
      standard12vConfirmed: data.standard12vConfirmed === "on",
      hazardFreeConfirmed: data.hazardFreeConfirmed === "on",
    })] : []),
    auditInsert(viewer, {
      action: "need.created",
      targetType: "need",
      targetId: needId,
      needId,
      publicSummary: "A report was submitted for moderator review.",
    }),
  ]);
  refresh(needId);
  return { ...ok("Thanks. Your report is waiting for moderator review."), id: needId };
}

/** Reporters can revise wording requested by a moderator and resubmit it for review. */
export async function resubmitNeedWording(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in to update your report.");
  const parsed = z.object({
    needId: z.uuid(),
    title: z.string().trim().min(5).max(100),
    description: z.string().trim().min(10).max(1000),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the revised title and description.");
  const { needId, title, description } = parsed.data;

  const [need] = await getDb().select({ reporterId: needs.reporterId, reviewStatus: needs.reviewStatus }).from(needs).where(eq(needs.id, needId)).limit(1);
  if (!need || need.reporterId !== viewer.id || need.reviewStatus !== "changes_requested") return fail("That report can't be revised.");

  await getDb().batch([
    getDb().update(needs).set({ title, description, reviewStatus: "pending", moderationFeedback: null, updatedAt: new Date() }).where(eq(needs.id, needId)),
    auditInsert(viewer, {
      action: "need.wording_resubmitted",
      targetType: "need",
      targetId: needId,
      needId,
      publicSummary: "A revised report was submitted for moderator review.",
    }),
  ]);
  refresh(needId);
  return ok("Your revised report is waiting for moderator review.");
}

export async function offerHelp(needId: string, message?: string, jumpSafetyConfirmation = false): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in to offer help.");
  if (!idSchema.safeParse(needId).success) return fail("That report wasn't found.");
  const note = messageSchema.safeParse(message);
  if (!note.success) return fail("Keep your message under 500 characters.");

  const [need] = await getDb().select().from(needs).where(eq(needs.id, needId)).limit(1);
  if (!need || need.hidden || need.reviewStatus !== "approved") return fail("That report wasn't found.");
  if (need.kind === "city_hazard") return fail("City hazards are handled by trained crews. Please don't attempt this yourself.");
  if (need.reporterId === viewer.id) return fail("You can't offer help on your own report.");
  if (need.status !== "open") return fail("Someone is already helping with this one.");
  const petReport = isPetReportCategory(need.category);
  if (need.kind === "neighbor_help" && viewer.helperStatus !== "approved" && !petReport) return fail("Neighbor support is limited to vetted helpers. Apply from your account page.");
  if (need.requestType === "jump_start" && !jumpSafetyConfirmation) return fail("Confirm that you will help only from a safe off-road location and follow the vehicle maker’s guidance.");
  if (need.requestType === "jump_start" && !await helperHasJumpStartGear(viewer.id, needId)) {
    return fail("Your equipment profile does not match this request. Confirm your cables or jump pack on your account page.");
  }

  const [existing] = await getDb().select().from(helpOffers).where(and(eq(helpOffers.needId, needId), eq(helpOffers.helperId, viewer.id))).limit(1);
  if (existing && existing.status !== "withdrawn") return fail("You've already offered to help with this report.");

  if (need.kind === "public_cleanup") {
    // Claim atomically: only succeeds while the report is still open.
    const [claimed] = await getDb().update(needs).set({ status: "claimed", updatedAt: new Date() }).where(and(eq(needs.id, needId), eq(needs.status, "open"))).returning({ id: needs.id });
    if (!claimed) return fail("Someone is already helping with this one.");
    const now = new Date();
    await getDb().batch([
      existing
        ? getDb().update(helpOffers).set({ status: "accepted", message: note.data || null, respondedAt: now }).where(eq(helpOffers.id, existing.id))
        : getDb().insert(helpOffers).values({ needId, helperId: viewer.id, message: note.data || null, status: "accepted", respondedAt: now }),
      auditInsert(viewer, { action: "need.claimed", targetType: "need", targetId: needId, needId, publicSummary: "A volunteer claimed this report and is on it." }),
    ]);
    refresh(needId);
    return ok("Thank you! It's yours. Mark it complete when you're done, or release it if plans change.");
  }

  await getDb().batch([
    existing
      ? getDb().update(helpOffers).set({ status: "pending", message: note.data || null, respondedAt: null, createdAt: new Date() }).where(eq(helpOffers.id, existing.id))
      : getDb().insert(helpOffers).values({ needId, helperId: viewer.id, message: note.data || null }),
    auditInsert(viewer, { action: "offer.created", targetType: "need", targetId: needId, needId, publicSummary: petReport ? "A neighbor offered help with a pet report." : "A vetted helper offered to help." }),
  ]);
  refresh(needId);
  return ok(petReport ? "Your note was sent privately. The requester will see it and can accept if it helps." : "Offer sent. The requester will review it; the exact location is shared only if they accept.");
}

/** Withdraws a pending offer or releases an accepted one back to the community. */
export async function withdrawOffer(offerId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in.");
  if (!idSchema.safeParse(offerId).success) return fail("That offer wasn't found.");
  const [offer] = await getDb().select().from(helpOffers).where(and(eq(helpOffers.id, offerId), eq(helpOffers.helperId, viewer.id))).limit(1);
  if (!offer || (offer.status !== "pending" && offer.status !== "accepted")) return fail("That offer can't be changed.");

  const now = new Date();
  if (offer.status === "accepted") {
    await getDb().batch([
      getDb().update(helpOffers).set({ status: "withdrawn", respondedAt: now }).where(eq(helpOffers.id, offer.id)),
      getDb().update(needs).set({ status: "open", updatedAt: now }).where(and(eq(needs.id, offer.needId), eq(needs.status, "claimed"))),
      auditInsert(viewer, { action: "need.released", targetType: "need", targetId: offer.needId, needId: offer.needId, publicSummary: "The helper released this report; it's open again." }),
    ]);
  } else {
    await getDb().batch([
      getDb().update(helpOffers).set({ status: "withdrawn", respondedAt: now }).where(eq(helpOffers.id, offer.id)),
      auditInsert(viewer, { action: "offer.withdrawn", targetType: "need", targetId: offer.needId, needId: offer.needId, publicSummary: "A helper withdrew their offer." }),
    ]);
  }
  refresh(offer.needId);
  return ok(offer.status === "accepted" ? "Released. Thanks for letting neighbors know." : "Offer withdrawn.");
}

/** The requester accepts or declines a helper's offer on their own report. */
export async function respondToOffer(offerId: string, accept: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in.");
  if (!idSchema.safeParse(offerId).success) return fail("That offer wasn't found.");
  const [row] = await getDb().select({ offer: helpOffers, need: needs }).from(helpOffers).innerJoin(needs, eq(needs.id, helpOffers.needId)).where(eq(helpOffers.id, offerId)).limit(1);
  if (!row || row.need.reporterId !== viewer.id || row.need.reviewStatus !== "approved") return fail("That offer wasn't found.");
  if (row.offer.status !== "pending") return fail("That offer has already been answered.");

  const now = new Date();
  const needId = row.need.id;
  if (!accept) {
    await getDb().batch([
      getDb().update(helpOffers).set({ status: "declined", respondedAt: now }).where(eq(helpOffers.id, offerId)),
      auditInsert(viewer, { action: "offer.declined", targetType: "need", targetId: needId, needId, publicSummary: "The requester declined an offer of help." }),
    ]);
    refresh(needId);
    return ok("Offer declined.");
  }

  if (row.need.kind === "neighbor_help" && !isPetReportCategory(row.need.category)) {
    const [helper] = await getDb().select({ helperStatus: users.helperStatus, suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, row.offer.helperId)).limit(1);
    if (!helper || helper.helperStatus !== "approved" || helper.suspendedAt) return fail("This helper is no longer vetted, so their offer can't be accepted.");
  }
  if (row.need.requestType === "jump_start" && !await helperHasJumpStartGear(row.offer.helperId, needId)) {
    return fail("This helper's equipment is no longer available for this request.");
  }

  // Accept only if the offer is still pending (the helper may have just withdrawn), then claim the report.
  const [accepted] = await getDb().update(helpOffers).set({ status: "accepted", respondedAt: now }).where(and(eq(helpOffers.id, offerId), eq(helpOffers.status, "pending"))).returning({ id: helpOffers.id });
  if (!accepted) return fail("That offer is no longer available.");
  const [claimed] = await getDb().update(needs).set({ status: "claimed", updatedAt: now }).where(and(eq(needs.id, needId), eq(needs.status, "open"))).returning({ id: needs.id });
  if (!claimed) {
    await getDb().update(helpOffers).set({ status: "pending", respondedAt: null }).where(eq(helpOffers.id, offerId));
    return fail("This report is no longer open.");
  }
  await getDb().batch([
    getDb().update(helpOffers).set({ status: "declined", respondedAt: now }).where(and(eq(helpOffers.needId, needId), eq(helpOffers.status, "pending"), ne(helpOffers.id, offerId))),
    auditInsert(viewer, { action: "offer.accepted", targetType: "need", targetId: needId, needId, publicSummary: "The requester accepted a vetted helper." }),
  ]);
  refresh(needId);
  return ok("Helper accepted. They can now see the exact location.");
}

/** The accepted helper or the original reporter can mark claimed work complete. */
export async function completeNeed(needId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in.");
  if (!idSchema.safeParse(needId).success) return fail("That report wasn't found.");
  const [need] = await getDb().select().from(needs).where(eq(needs.id, needId)).limit(1);
  if (!need || need.reviewStatus !== "approved" || need.status !== "claimed") return fail("Only approved reports in progress can be completed.");
  const [assigned] = await getDb().select({ id: helpOffers.id }).from(helpOffers).where(and(eq(helpOffers.needId, needId), eq(helpOffers.helperId, viewer.id), eq(helpOffers.status, "accepted"))).limit(1);
  if (!assigned && need.reporterId !== viewer.id) return fail("Only the helper or the requester can mark this complete.");

  const now = new Date();
  await getDb().batch([
    getDb().update(needs).set({ status: "completed", completedAt: now, updatedAt: now }).where(eq(needs.id, needId)),
    getDb().update(helpOffers).set({ status: "completed" }).where(and(eq(helpOffers.needId, needId), eq(helpOffers.status, "accepted"))),
    auditInsert(viewer, { action: "need.completed", targetType: "need", targetId: needId, needId, publicSummary: assigned ? "The helper marked this report complete." : "The requester marked this report complete." }),
  ]);
  refresh(needId);
  return ok("Marked complete. Thank you for taking care of home.");
}

export async function applyAsHelper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in.");
  const parsed = z.object({
    motivation: z.string().trim().min(20, "Tell us a little more about why you'd like to help (20+ characters).").max(1000),
    experience: z.string().trim().min(10, "Describe any relevant experience (10+ characters).").max(1000),
    agree: z.literal("on", { message: "Please agree to the safety guidelines." }),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  if (viewer.helperStatus === "approved") return fail("You're already a vetted helper.");
  if (viewer.helperStatus === "pending") return fail("Your application is already under review.");
  if (viewer.helperStatus === "revoked") return fail("Your helper access was revoked. Please contact the administrators.");

  const [application] = await getDb().insert(helperApplications).values({ userId: viewer.id, motivation: parsed.data.motivation, experience: parsed.data.experience }).returning({ id: helperApplications.id });
  await getDb().batch([
    getDb().update(users).set({ helperStatus: "pending" }).where(eq(users.id, viewer.id)),
    auditInsert(viewer, { action: "helper.applied", targetType: "helper_application", targetId: application.id, publicSummary: "A member applied to become a vetted helper." }),
  ]);
  refresh();
  return ok("Application submitted. An administrator will review it.");
}


/** Helpers can update and re-confirm the equipment they are willing to bring. */
export async function updateHelperCapabilities(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Please sign in.");
  if (viewer.helperStatus !== "approved") return fail("Only vetted helpers can list equipment.");
  const parsed = z.object({
    jumperCables: z.literal("on").optional(),
    jumpPack: z.literal("on").optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the equipment selections.");
  const now = new Date();
  await getDb().batch([
    getDb().insert(helperCapabilities).values({
      userId: viewer.id,
      jumperCables: parsed.data.jumperCables === "on",
      jumpPack: parsed.data.jumpPack === "on",
      confirmedAt: now,
    }).onConflictDoUpdate({
      target: helperCapabilities.userId,
      set: {
        jumperCables: parsed.data.jumperCables === "on",
        jumpPack: parsed.data.jumpPack === "on",
        confirmedAt: now,
      },
    }),
    auditInsert(viewer, {
      action: "helper.capabilities_updated",
      targetType: "helper_capability",
      targetId: viewer.id,
      publicSummary: "A vetted helper updated their equipment availability.",
    }),
  ]);
  refresh();
  return ok("Equipment availability saved and confirmed.");
}
