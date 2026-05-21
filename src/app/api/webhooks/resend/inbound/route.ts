import { NextRequest, NextResponse } from "next/server";
import { resendAdapter } from "@server/adapters/email/resend";
import { processInboundEmail } from "@server/services/email-inbound";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!resendAdapter.verifyWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid webhook signature" } },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON" } },
      { status: 400 },
    );
  }

  const queueViaTrigger =
    process.env.TRIGGER_SECRET_KEY &&
    process.env.TRIGGER_INLINE_INBOUND !== "true";

  if (queueViaTrigger) {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    await tasks.trigger("process-inbound-email", { raw: payload });
    return NextResponse.json({ accepted: true, queued: true });
  }

  const parsed = await resendAdapter.resolveInbound(payload);
  const result = await processInboundEmail(parsed);
  return NextResponse.json({ accepted: true, ...result });
}
