import { NextResponse } from "next/server";
import { loadMarkets } from "@/lib/markets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { markets, demo } = await loadMarkets();
    return NextResponse.json({ markets, demo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load markets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
