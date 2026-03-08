import { NextResponse } from "next/server";
import { getOrRotateOTP } from "@/actions/lab-monitoring";

export async function GET() {
  try {
    const otp = await getOrRotateOTP();
    return NextResponse.json(otp);
  } catch (err) {
    console.error("[lab-otp] Error:", err);
    return NextResponse.json({ error: "Failed to get OTP" }, { status: 500 });
  }
}