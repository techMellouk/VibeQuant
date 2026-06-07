import { NextResponse } from "next/server";
import { generateStrategy } from "@/lib/strategy";
import type { DiscoveredMarket, Strategy } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      thesis?: string;
      markets?: DiscoveredMarket[];
      instructions?: string;
      prior?: Strategy;
      budget?: number;
    };
    const thesis = body.thesis?.trim();
    if (!thesis) {
      return NextResponse.json({ error: "Missing `thesis`." }, { status: 400 });
    }
    if (!body.markets || body.markets.length === 0) {
      return NextResponse.json({ error: "No markets provided." }, { status: 400 });
    }
    const strategy = await generateStrategy({
      thesis,
      markets: body.markets,
      instructions: body.instructions,
      prior: body.prior,
      budget: body.budget,
    });
    return NextResponse.json(strategy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strategy generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
