import process from "node:process";
import {
  resendEventsWebhookEndpoint,
  resendInboundWebhookEndpoint,
} from "@shared/integrations/resend/webhook-endpoints";
import { provisionResendWebhooks } from "./lib/resend-webhooks";
import { readOrCreateEnvFile, setEnvLine, writeEnvFile } from "./lib/env-file";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT, process.env.TICQEX_ENV_FILE ?? ".env.local");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");

function optionValue(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function printUsage(): void {
  console.log(`Usage: pnpm resend:setup-webhooks [options]

Creates (or reuses) Resend inbound and delivery webhooks for this app and writes
signing secrets to .env.local.

Options:
  --app-url <url>   Public app URL (default: NEXT_PUBLIC_APP_URL)
  --api-key <key>   Resend API key (default: RESEND_API_KEY)
  --dry-run         Print endpoints only; do not call Resend or write .env.local
  --help            Show this help
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printUsage();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const appUrl =
    optionValue(args, "--app-url") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const apiKey = optionValue(args, "--api-key") ?? process.env.RESEND_API_KEY ?? "";

  if (!appUrl) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL or pass --app-url (your public tunnel or deployment URL).",
    );
  }

  if (dryRun) {
    console.log("Webhook endpoints:");
    console.log(`  inbound: ${resendInboundWebhookEndpoint(appUrl)}`);
    console.log(`  events:  ${resendEventsWebhookEndpoint(appUrl)}`);
    return;
  }

  if (!apiKey) {
    throw new Error("Set RESEND_API_KEY or pass --api-key.");
  }

  const result = await provisionResendWebhooks({ apiKey, appUrl });

  let envContent = readOrCreateEnvFile(ENV_FILE, ENV_EXAMPLE);
  envContent = setEnvLine(
    envContent,
    "RESEND_API_KEY",
    apiKey,
  );
  envContent = setEnvLine(envContent, "NEXT_PUBLIC_APP_URL", appUrl);
  envContent = setEnvLine(
    envContent,
    "RESEND_INBOUND_WEBHOOK_SECRET",
    result.inboundSigningSecret,
  );
  envContent = setEnvLine(
    envContent,
    "RESEND_EVENTS_WEBHOOK_SECRET",
    result.eventsSigningSecret,
  );
  writeEnvFile(ENV_FILE, envContent);

  console.log("Resend webhooks ready:");
  console.log(
    `  inbound (${result.inboundCreated ? "created" : "reused"}): ${result.inboundEndpoint}`,
  );
  console.log(
    `  events (${result.eventsCreated ? "created" : "reused"}): ${result.eventsEndpoint}`,
  );
  console.log(`\nUpdated ${path.relative(ROOT, ENV_FILE)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
