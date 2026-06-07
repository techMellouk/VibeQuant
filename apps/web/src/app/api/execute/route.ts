import { NextResponse } from "next/server";
import { executeStrategy } from "@/lib/execution";
import type { Strategy } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { strategy?: Strategy };
    if (!body.strategy || !Array.isArray(body.strategy.trades)) {
      return NextResponse.json({ error: "Missing or invalid `strategy`." }, { status: 400 });
    }
    const report = await executeStrategy(body.strategy);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
