"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { completeNeed, offerHelp, withdrawOffer } from "@/app/actions/needs";
import type { ActionResult } from "@/lib/action-state";
import type { MapNeed } from "@/lib/needs";

/** The primary call to action for a report, based on who is viewing it. */
export function NeedActions({ need, showDetailsLink = true }: { need: MapNeed; showDetailsLink?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [message, setMessage] = useState("");
  const [jumpSafetyConfirmed, setJumpSafetyConfirmed] = useState(false);
  const details = `/needs/${need.id}`;

  function run(task: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => setResult(await task()));
  }

  let body: React.ReactNode;
  switch (need.action) {
    case "demo":
      body = <p className="action-note">This is sample data. Connect a database to accept real offers of help.</p>;
      break;
    case "follow":
      body = <Link className="action-button" href={details}>Follow city response</Link>;
      break;
    case "sign_in":
      body = <Link className="action-button" href={`/signin?next=${encodeURIComponent(details)}`}>Sign in to offer help</Link>;
      break;
    case "apply_helper":
      body = <><p className="action-note">Neighbor support is limited to vetted helpers to keep residents safe.</p><Link className="action-button" href="/account#helper">Apply to become a vetted helper</Link></>;
      break;
    case "offer":
      body = <>
        {need.kind === "neighbor_help" && <label className="offer-message">Message to the requester (optional, private)<textarea value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} placeholder="When you're available and what you can bring."/></label>}
        {need.requestType === "jump_start" && <label className="checkbox safety-confirm"><input type="checkbox" checked={jumpSafetyConfirmed} onChange={(e) => setJumpSafetyConfirmed(e.target.checked)}/>I will help only if the vehicle is fully off the roadway, and I will follow the vehicle maker’s guidance.</label>}
        <button className="action-button" disabled={pending || (need.requestType === "jump_start" && !jumpSafetyConfirmed)} onClick={() => run(() => offerHelp(need.id, message, jumpSafetyConfirmed))}>{pending ? "Sending…" : "Offer to help"}</button>
      </>;
      break;
    case "capability_required":
      body = <><p className="action-note">This request needs {need.requiredEquipment?.join(" or ") || "matching equipment"}. Only vetted helpers who have confirmed that equipment can offer.</p><Link className="action-button" href="/account#helper-equipment">Update equipment availability</Link></>;
      break;
    case "pending":
      body = <><p className="action-note">Your offer is waiting for the requester&apos;s response.</p><button className="secondary-button" disabled={pending || !need.offerId} onClick={() => need.offerId && run(() => withdrawOffer(need.offerId!))}>Withdraw offer</button></>;
      break;
    case "assigned":
      body = <div className="button-row">
        <button className="action-button" disabled={pending} onClick={() => run(() => completeNeed(need.id))}>Mark complete</button>
        <button className="secondary-button" disabled={pending || !need.offerId} onClick={() => need.offerId && run(() => withdrawOffer(need.offerId!))}>Release</button>
      </div>;
      break;
    case "reporter":
      body = <><p className="action-note">This is your report.</p>{need.status === "claimed" && <button className="action-button" disabled={pending} onClick={() => run(() => completeNeed(need.id))}>Mark complete</button>}<Link className="secondary-button" href="/account">Review offers on your account</Link></>;
      break;
    default:
      body = <p className="action-note">{need.status === "completed" ? "This has been taken care of. Thank you, neighbors!" : "Someone is already helping with this one."}</p>;
  }

  return <div className="need-actions">
    {body}
    {result && <p className={result.ok ? "form-success" : "form-error"} role="status">{result.message}</p>}
    {showDetailsLink && need.action !== "demo" && need.action !== "follow" && <Link className="text-link" href={details}>Details &amp; public history</Link>}
  </div>;
}
