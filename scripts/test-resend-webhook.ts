/**
 * Sends a Svix-signed email.received payload to the inbound webhook (smoke test).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Webhook } from "svix";

const ROOT = path.resolve(import.meta.dirname, "..");
const baseUrl = process.env.WEBHOOK_TEST_URL ?? "http://127.0.0.1:3000";

function readSecret(): string {
  const envPath = path.join(ROOT, ".env.local");
  const content = readFileSync(envPath, "utf8");
  const match = content.match(/^RESEND_INBOUND_WEBHOOK_SECRET=(.+)$/m);
  if (!match) throw new Error("RESEND_INBOUND_WEBHOOK_SECRET missing in .env.local");
  return match[1].trim();
}

async function main(): Promise<void> {
  const secret = readSecret();
  const payload = JSON.stringify({
    type: "email.received",
    created_at: new Date().toISOString(),
    data: {
      email_id: `test-${Date.now()}`,
      created_at: new Date().toISOString(),
      from: "webhook-test@example.com",
      to: ["support@example.com"],
      bcc: [],
      cc: [],
      message_id: `<webhook-test-${Date.now()}@example.com>`,
      subject: "Resend webhook smoke test",
      attachments: [],
    },
  });

  const msgId = `msg_${Date.now()}`;
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(msgId, timestamp, payload);

  const url = `${baseUrl.replace(/\/$/, "")}/api/webhooks/resend/inbound`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": msgId,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature,
    },
    body: payload,
  });

  const body = await response.text();
  console.log(`${response.status} ${url}`);
  console.log(body);
  if (!response.ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
