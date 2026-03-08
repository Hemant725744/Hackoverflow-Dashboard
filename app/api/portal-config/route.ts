import { NextRequest, NextResponse } from "next/server";
import {
  getPortalConfig,
  createAlert,
  updateAlert,
  toggleAlert,
  deleteAlert,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  updateMealSchedule,
} from "@/actions/portal-config";

export async function GET() {
  try {
    const config = await getPortalConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("[portal-config GET]", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body as { action: string; payload: any };

    switch (action) {
      // Alerts
      case "create_alert":
        await createAlert(payload);
        break;
      case "update_alert":
        await updateAlert(payload.alertId, payload.data);
        break;
      case "toggle_alert":
        await toggleAlert(payload.alertId, payload.isActive);
        break;
      case "delete_alert":
        await deleteAlert(payload.alertId);
        break;

      // Schedule
      case "create_event":
        await createScheduleEvent(payload);
        break;
      case "update_event":
        await updateScheduleEvent(payload.eventId, payload.data);
        break;
      case "delete_event":
        await deleteScheduleEvent(payload.eventId);
        break;

      // Meal schedule
      case "update_meal_schedule":
        await updateMealSchedule(payload.mealSchedule);
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[portal-config POST]", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}