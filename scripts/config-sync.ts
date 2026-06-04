import path from "node:path";
import process from "node:process";
import { getChannelDefinition } from "@server/channels";
import {
  loadTicqexConfig,
  resolveConfigPath,
  validateTicqexConfig,
} from "@server/config";
import { loadEnvLocalIfPresent } from "./lib/load-env-local";

loadEnvLocalIfPresent();

const configPath = resolveConfigPath(process.env.TICQEX_CONFIG_FILE);

function main(): void {
  console.log(`Syncing ${path.relative(process.cwd(), configPath)}\n`);

  const config = loadTicqexConfig(configPath);
  const validation = validateTicqexConfig(config, process.env);

  if (!validation.ok) {
    console.error("Config sync aborted due to validation errors:");
    for (const issue of validation.issues) {
      console.error(`  - ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  const activeChannels = Object.entries(config.channels)
    .filter(([, binding]) => binding.enabled)
    .map(([key]) => key);
  const activeIntegrations = Object.entries(config.integrations)
    .filter(([, binding]) => binding.enabled)
    .map(([key]) => key);

  console.log("Activation:");
  console.log(`  channels: ${activeChannels.join(", ") || "(none)"}`);
  console.log(`  integrations: ${activeIntegrations.join(", ") || "(none)"}`);

  const fieldPlans: Array<{
    channel: string;
    key: string;
    label: string;
    group: string;
    type: string;
  }> = [];

  for (const channelKey of activeChannels) {
    const definition = getChannelDefinition(channelKey);
    if (!definition) continue;

    for (const policy of definition.fields) {
      fieldPlans.push({
        channel: channelKey,
        key: policy.key,
        label: policy.label,
        group: policy.group ?? "ticket",
        type: policy.type ?? "text",
      });
    }
  }

  if (fieldPlans.length === 0) {
    console.log("\nField policies: nothing to sync (no active channels).");
  } else {
    console.log(
      "\nField policies (dry-run — database upsert not implemented yet):",
    );
    for (const field of fieldPlans) {
      console.log(
        `  [${field.channel}] ${field.group}.${field.key} (${field.type}) "${field.label}"`,
      );
    }
  }

  console.log("\nConfig sync complete.");
}

main();
