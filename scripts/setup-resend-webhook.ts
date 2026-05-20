/**
 * Registers (or reuses) the Resend inbound webhook for local/tunnel testing.
 * Writes signing_secret to .env.local as RESEND_INBOUND_WEBHOOK_SECRET.
 *
 * Requires RESEND_API_KEY in the environment (Cursor Cloud harness).
 */
import { Resend } from "resend";
import path from "node:path";
import {
  readOrCreateEnvFile,
  setEnvLine,
  writeEnvFile,
} from "./lib/env-file.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENDPOINT =
  process.env.RESEND_INBOUND_WEBHOOK_URL ??
  "https://readbetter.rbouschery.de/api/webhooks/resend/inbound";

async function main(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required");
  }

  const resend = new Resend(apiKey);
  const list = await resend.webhooks.list();
  if (list.error) throw new Error(list.error.message);

  const existing = list.data?.data.find(
    (w) => w.endpoint === ENDPOINT && w.status === "enabled",
  );

  let signingSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;

  if (existing) {
    console.log(`Webhook already exists: ${existing.id} → ${ENDPOINT}`);
    const detail = await resend.webhooks.get(existing.id);
    if (detail.error) throw new Error(detail.error.message);
    signingSecret = detail.data?.signing_secret ?? signingSecret;
  } else {
    const created = await resend.webhooks.create({
      endpoint: ENDPOINT,
      events: ["email.received"],
    });
    if (created.error) throw new Error(created.error.message);
    signingSecret = created.data?.signing_secret;
    console.log(`Created webhook ${created.data?.id} → ${ENDPOINT}`);
  }

  if (!signingSecret) {
    throw new Error(
      "No signing_secret returned; set RESEND_INBOUND_WEBHOOK_SECRET manually from Resend dashboard",
    );
  }

  const envPath = path.join(ROOT, ".env.local");
  const examplePath = path.join(ROOT, ".env.example");
  let content = readOrCreateEnvFile(envPath, examplePath);
  content = setEnvLine(content, "RESEND_INBOUND_WEBHOOK_SECRET", signingSecret);
  writeEnvFile(envPath, content);

  console.log("Updated .env.local:");
  console.log("  RESEND_INBOUND_WEBHOOK_SECRET");
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log("Events: email.received");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
