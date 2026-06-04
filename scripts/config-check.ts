import path from "node:path";
import process from "node:process";
import {
  loadTicqexConfig,
  resolveConfigPath,
  validateTicqexConfig,
} from "@server/config";
import { loadEnvLocalIfPresent } from "./lib/load-env-local";

loadEnvLocalIfPresent();

const configPath = resolveConfigPath(process.env.TICQEX_CONFIG_FILE);

function main(): void {
  console.log(`Checking ${path.relative(process.cwd(), configPath)}`);

  const config = loadTicqexConfig(configPath);
  const result = validateTicqexConfig(config, process.env);

  for (const issue of result.issues) {
    console.error(`error  ${issue.path}: ${issue.message}`);
  }

  if (!result.ok) {
    console.error(`\n${result.issues.length} issue(s) found.`);
    process.exit(1);
  }

  const enabledChannels = Object.entries(config.channels)
    .filter(([, binding]) => binding.enabled)
    .map(([key, binding]) => `${key} → ${binding.integration ?? "none"}`);

  console.log("\nConfig OK");
  for (const line of enabledChannels) {
    console.log(`  ${line}`);
  }
}

main();
