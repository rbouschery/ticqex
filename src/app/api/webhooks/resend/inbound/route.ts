import { NextRequest, NextResponse } from "next/server";
import { resendAdapter } from "@server/adapters/email/resend";
import { inboundTriggerIdempotencyKey } from "@server/adapters/email/trigger-keys";

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

  if (!process.env.TRIGGER_SECRET_KEY) {
    return NextResponse.json(
      {
        error: {
          code: "service_unavailable",
          message: "Trigger.dev is not configured (TRIGGER_SECRET_KEY missing)",
        },
      },
      { status: 503 },
    );
  }

  const { tasks } = await import("@trigger.dev/sdk/v3");
  const idempotencyKey = inboundTriggerIdempotencyKey(payload);
  const handle = await tasks.trigger(
    "process-inbound-email",
    { raw: payload },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  return NextResponse.json({
    accepted: true,
    queued: true,
    run_id: handle.id,
    idempotency_key: idempotencyKey ?? null,
  });
}
