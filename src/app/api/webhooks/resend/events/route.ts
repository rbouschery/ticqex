import { NextRequest, NextResponse } from "next/server";
import {
  handleResendDeliveryEvent,
  verifyResendEventsWebhook,
} from "@server/services/email-delivery";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyResendEventsWebhook(rawBody, request.headers)) {
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

  const result = await handleResendDeliveryEvent(payload);
  return NextResponse.json({ accepted: true, ...result });
}
