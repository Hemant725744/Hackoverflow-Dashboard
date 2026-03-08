import { NextRequest, NextResponse } from "next/server";
import {
  getParticipantLocations,
  getLabList,
  getActiveVolunteerSessions,
  getRecentCheckInLogs,
} from "@/actions/lab-monitoring";

export async function GET(req: NextRequest) {
  try {
    const lab = req.nextUrl.searchParams.get("lab") ?? undefined;

    const [{ snapshots, summary }, labs, activeSessions, recentLogs] =
      await Promise.all([
        getParticipantLocations(lab),
        getLabList(),
        getActiveVolunteerSessions(),
        getRecentCheckInLogs(30),
      ]);

    return NextResponse.json({ snapshots, summary, labs, activeSessions, recentLogs });
  } catch (err) {
    console.error("[lab-monitoring] Error:", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}