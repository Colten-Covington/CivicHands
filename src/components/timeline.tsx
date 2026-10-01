import Link from "next/link";
import { publicActorLabel } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

export type TimelineEvent = { id: string; createdAt: Date; actorRole: string; actorPublicName: string | null; publicSummary: string; publicNote: string | null; href?: string | null; linkLabel?: string | null };

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="muted">No public activity yet.</p>;
  return <ol className="timeline">{events.map((event) => <li key={event.id}>
    <time dateTime={event.createdAt.toISOString()}>{formatDateTime(event.createdAt)}</time>
    <p><strong>{publicActorLabel(event)}</strong> — {event.publicSummary}{event.href && event.linkLabel && <> <Link href={event.href}>{event.linkLabel}</Link></>}</p>
    {event.publicNote && <blockquote>{event.publicNote}</blockquote>}
  </li>)}</ol>;
}
