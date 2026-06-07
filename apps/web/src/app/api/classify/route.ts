import { NextResponse } from "next/server";
import { classifyFollowUp } from "@/lib/intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string; priorThesis?: string };
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "Missing `message`." }, { status: 400 });
    }
    const result = await classifyFollowUp(message, body.priorThesis?.trim() ?? "");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Classification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
