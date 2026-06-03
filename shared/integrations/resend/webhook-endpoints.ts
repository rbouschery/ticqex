import type { ResendDeliveryEventType } from "@shared/integrations/resend/webhook-types";

export const RESEND_INBOUND_WEBHOOK_PATH =
  "/api/webhooks/integrations/resend/inbound";

export const RESEND_EVENTS_WEBHOOK_PATH =
  "/api/webhooks/integrations/resend/events";

export const RESEND_INBOUND_WEBHOOK_EVENTS = ["email.received"] as const;

export const RESEND_DELIVERY_WEBHOOK_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.failed",
] as const satisfies readonly ResendDeliveryEventType[];

export function normalizeAppUrl(appUrl: string): string {
  return appUrl.trim().replace(/\/+$/, "");
}

export function resendWebhookEndpoint(appUrl: string, path: string): string {
  return `${normalizeAppUrl(appUrl)}${path}`;
}

export function resendInboundWebhookEndpoint(appUrl: string): string {
  return resendWebhookEndpoint(appUrl, RESEND_INBOUND_WEBHOOK_PATH);
}

export function resendEventsWebhookEndpoint(appUrl: string): string {
  return resendWebhookEndpoint(appUrl, RESEND_EVENTS_WEBHOOK_PATH);
}
