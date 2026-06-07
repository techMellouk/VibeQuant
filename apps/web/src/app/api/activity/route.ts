import { NextResponse } from "next/server";
import { getActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: getActivity(100) });
}
