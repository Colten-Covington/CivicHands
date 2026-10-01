"use client";
import { useState, useTransition } from "react";
import { respondToOffer } from "@/app/actions/needs";
import type { ActionResult } from "@/lib/action-state";

export function OfferResponse({ offerId }: { offerId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const respond = (accept: boolean) => startTransition(async () => setResult(await respondToOffer(offerId, accept)));
  return <div className="button-row">
    <button className="action-button" disabled={pending} onClick={() => respond(true)}>Accept helper</button>
    <button className="secondary-button" disabled={pending} onClick={() => respond(false)}>Decline</button>
    {result && <p className={result.ok ? "form-success" : "form-error"} role="status">{result.message}</p>}
  </div>;
}
