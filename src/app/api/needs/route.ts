import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { needs } from "@/db/schema";
import { toPublicNeed } from "@/lib/needs";

/** Public, privacy-safe feed of visible reports. Reports are created through the signed-in app. */
export async function GET() {
  try {
    const rows = await getDb().select().from(needs).where(eq(needs.hidden, false)).orderBy(desc(needs.createdAt)).limit(500);
    return NextResponse.json(rows.map(toPublicNeed));
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
