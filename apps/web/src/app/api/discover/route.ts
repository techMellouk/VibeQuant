import { NextResponse } from "next/server";
import { discoverMarkets } from "@/lib/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { thesis?: string };
    const thesis = body.thesis?.trim();
    if (!thesis) {
      return NextResponse.json({ error: "Missing `thesis`." }, { status: 400 });
    }
    const result = await discoverMarkets(thesis);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
