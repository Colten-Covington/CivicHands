import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { needs } from "@/db/schema";

const reportSchema = z.object({
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(1000),
  kind: z.enum(["public_cleanup", "city_hazard", "neighbor_help"]),
  category: z.string().trim().min(2).max(50),
  location: z.string().trim().min(3).max(160),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  city: z.string().trim().min(2).max(80),
  reporterName: z.string().trim().min(2).max(80),
});

export async function GET() {
  try {
    return NextResponse.json(await getDb().select().from(needs).orderBy(desc(needs.createdAt)));
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the report details." }, { status: 400 });
  const [created] = await getDb().insert(needs).values({
    ...parsed.data,
    detailsPrivate: parsed.data.kind === "neighbor_help",
    status: parsed.data.kind === "city_hazard" ? "referred" : "open",
  }).returning();
  return NextResponse.json(created, { status: 201 });
}
