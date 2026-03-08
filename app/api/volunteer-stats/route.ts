import { NextResponse } from "next/server";
import { getEventStats } from "@/actions/volunteers";

export async function GET() {
  try {
    const stats = await getEventStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[volunteer-stats]", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}