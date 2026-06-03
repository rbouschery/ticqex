import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import {
  closeReadline,
  createReadline,
  runPnpm,
  runSupabase,
} from "./lib/run-command";
import {
  defaultTicqexConfig,
  loadTicqexConfig,
  resolveConfigPath,
  type TicqexConfig,
} from "@server/config";
import {
  readOrCreateEnvFile,
  setEnvLine,
  writeEnvFile,
} from "./lib/env-file";
import { provisionResendWebhooks } from "./lib/resend-webhooks";
import {
  promptUseTunnelAsAppUrl,
  resolveLocalWebhookHttpsUrl,
} from "./lib/local-tunnel";
import { isHttpsAppUrl } from "@shared/integrations/resend/webhook-endpoints";

type DbSetupMode = "skip" | "start" | "reset";
type SupabaseTarget = "local" | "cloud" | "skip";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const CONFIG_EXAMPLE = path.join(ROOT, "config/ticqex.config.example.json");

function rootPath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

const ENV_FILE = rootPath(process.env.TICQEX_ENV_FILE ?? ".env.local");
const CONFIG_FILE = resolveConfigPath(
  process.env.TICQEX_CONFIG_FILE ?? "config/ticqex.config.json",
);

function printRootUsage(): void {
  console.log(`Usage: pnpm ticqex <command> [options]

Commands:
  init          Interactive setup (Supabase, env, channels, config sync)

Options:
  --help        Show help for ticqex or a subcommand.
`);
}

function printInitUsage(): void {
  console.log(`Usage: pnpm ticqex init [options]

Options:
  --supabase <local|cloud|skip>
               Choose Supabase setup target. Defaults to interactive.
  --skip-db    Alias for --supabase skip.
  --help       Show this help.
`);
}

function optionValue(args: string[], name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function parseSupabaseTarget(args: string[]): SupabaseTarget | null {
  if (args.includes("--skip-db")) return "skip";

  const value = optionValue(args, "--supabase");
  if (!value) return null;
  if (value === "local" || value === "cloud" || value === "skip") return value;
  throw new Error("--supabase must be one of: local, cloud, skip");
}

function readEnvContent(): string {
  return readOrCreateEnvFile(ENV_FILE, ENV_EXAMPLE);
}

function getEnvValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  const value = match ? match[1]!.trim() : null;
  if (!value || isPlaceholderEnvValue(value)) return null;
  return value;
}

function isPlaceholderEnvValue(value: string): boolean {
  return (
    value.endsWith("...") ||
    value.startsWith("your-") ||
    value.includes("@yourdomain.")
  );
}

function displayPath(filePath: string): string {
  const relative = path.relative(ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative;
}

function hasSupabaseEnv(content: string): boolean {
  return [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
  ].every((key) => Boolean(getEnvValue(content, key)));
}

function readConfig(): TicqexConfig {
  try {
    return loadTicqexConfig(CONFIG_FILE);
  } catch {
    if (fs.existsSync(CONFIG_EXAMPLE)) {
      return loadTicqexConfig(CONFIG_EXAMPLE);
    }
    return defaultTicqexConfig();
  }
}

function writeConfig(config: TicqexConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

async function prompt(
  rl: ReadlineInterface,
  label: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || defaultValue || "";
}

async function promptYesNo(
  rl: ReadlineInterface,
  label: string,
  defaultValue: boolean,
): Promise<boolean> {
  const suffix = defaultValue ? "Y/n" : "y/N";
  while (true) {
    const answer = (await rl.question(`${label} [${suffix}]: `))
      .trim()
      .toLowerCase();
    if (!answer) return defaultValue;
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
    console.log("Please answer yes or no.");
  }
}

async function promptChoice<T extends string>(
  rl: ReadlineInterface,
  label: string,
  choices: readonly T[],
  defaultValue: T,
): Promise<T> {
  while (true) {
    const answer = (await prompt(
      rl,
      `${label} (${choices.join("/")})`,
      defaultValue,
    )) as T;
    if (choices.includes(answer)) return answer;
    console.log(`Please choose one of: ${choices.join(", ")}`);
  }
}

async function promptEnvValue(
  rl: ReadlineInterface,
  content: string,
  key: string,
  options: {
    label?: string;
    required?: boolean;
    defaultValue?: string;
  } = {},
): Promise<string> {
  const existing = getEnvValue(content, key);
  const processValue = process.env[key];
  const hint = existing
    ? "leave blank to keep current"
    : processValue
      ? "leave blank to use current process env only"
      : undefined;

  while (true) {
    const suffix = hint ? ` (${hint})` : "";
    const defaultValue = existing ?? options.defaultValue;
    const answer = await prompt(
      rl,
      `${options.label ?? key}${suffix}`,
      defaultValue,
    );

    if (answer) return answer;
    if (existing || processValue || !options.required) return "";

    console.log(`${key} is required for this integration.`);
  }
}

async function setupSupabase(
  rl: ReadlineInterface,
  requestedTarget: SupabaseTarget | null,
): Promise<ReadlineInterface> {
  const target =
    requestedTarget ??
    (await promptChoice(
      rl,
      "\nSupabase setup",
      ["local", "cloud", "skip"] as const,
      "local",
    ));

  if (target === "skip") {
    console.log("\nSkipping Supabase setup.");
    return rl;
  }

  if (target === "cloud") {
    return setupCloudSupabase(rl);
  }

  const envContent = readEnvContent();
  const defaultMode: DbSetupMode = hasSupabaseEnv(envContent) ? "skip" : "start";
  const mode = await promptChoice(
    rl,
    "\nLocal Supabase setup",
    ["skip", "start", "reset"] as const,
    defaultMode,
  );

  if (mode === "skip") return rl;

  if (mode === "reset") {
    const confirmed = await promptYesNo(
      rl,
      "Reset wipes the local Supabase database. Continue?",
      false,
    );
    if (!confirmed) return rl;
    closeReadline(rl);
    runSupabase(["db", "reset", "--yes"]);
    rl = createReadline();
  } else {
    closeReadline(rl);
    runSupabase(["start"]);
    rl = createReadline();
    runPnpm(["db:bootstrap"]);
  }

  closeReadline(rl);
  runPnpm(["db:env"]);
  rl = createReadline();

  const seedAdmin = await promptYesNo(
    rl,
    "Seed the local admin user now?",
    mode !== "skip",
  );
  if (seedAdmin) {
    runPnpm(["db:seed-admin"]);
  }

  return rl;
}

async function setupCloudSupabase(rl: ReadlineInterface): Promise<ReadlineInterface> {
  console.log("\nCloud Supabase setup");
  console.log(
    "This links and optionally pushes migrations. It does not write cloud Supabase keys.",
  );

  const projectRef = await prompt(rl, "Supabase project ref");
  if (!projectRef) {
    throw new Error("Supabase project ref is required for cloud setup.");
  }

  closeReadline(rl);
  runSupabase(["link", "--project-ref", projectRef, "--yes"]);

  let activeRl = createReadline();
  const pushMigrations = await promptYesNo(
    activeRl,
    "Push local migrations to the linked cloud project?",
    false,
  );
  if (pushMigrations) {
    const confirmed = await promptYesNo(
      activeRl,
      "This writes schema changes to the linked cloud database. Continue?",
      false,
    );
    if (confirmed) {
      closeReadline(activeRl);
      // Init already confirmed; --yes plus closed readline so the CLI owns stdin.
      runSupabase(["db", "push", "--linked", "--yes"], { input: "y\n" });
      activeRl = createReadline();
    }
  }

  console.log(
    "\nSet these Supabase environment variables in your deployment or .env.local:",
  );
  console.log("  NEXT_PUBLIC_SUPABASE_URL");
  console.log("  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  console.log("  SUPABASE_SECRET_KEY");
  console.log(
    "\nFind the values in Supabase project settings. The CLI intentionally does not fetch or store cloud keys.",
  );

  return activeRl;
}

async function configureChannelsAndIntegrations(
  rl: ReadlineInterface,
): Promise<void> {
  console.log("\nAvailable channels: email");
  console.log("Available integrations: resend");

  const currentConfig = readConfig();
  const enableEmail = await promptYesNo(
    rl,
    "Enable the email channel?",
    currentConfig.channels.email?.enabled ?? true,
  );

  let envContent = readEnvContent();
  const nextConfig: TicqexConfig = {
    version: 1,
    channels: {
      email: {
        enabled: enableEmail,
        integration: enableEmail ? "resend" : null,
      },
    },
    integrations: {
      resend: {
        enabled: enableEmail,
      },
    },
  };

  if (enableEmail) {
    console.log("\nConfigure Resend email integration.");

    for (const entry of [
      {
        key: "RESEND_API_KEY",
        label: "Resend API key",
        required: true,
      },
      {
        key: "NEXT_PUBLIC_APP_URL",
        label: "App URL (local admin UI and links)",
        required: true,
        defaultValue: "http://localhost:3000",
      },
    ] as const) {
      const value = await promptEnvValue(rl, envContent, entry.key, entry);
      if (value) {
        envContent = setEnvLine(envContent, entry.key, value);
      }
    }

    const resendApiKey = getEnvValue(envContent, "RESEND_API_KEY");
    let appUrl = getEnvValue(envContent, "NEXT_PUBLIC_APP_URL");
    let webhookAppUrl = appUrl && isHttpsAppUrl(appUrl) ? appUrl : null;

    if (appUrl && !webhookAppUrl) {
      const tunnelUrl = await resolveLocalWebhookHttpsUrl({
        rl,
        localAppUrl: appUrl,
      });
      if (tunnelUrl) {
        webhookAppUrl = tunnelUrl;
        if (await promptUseTunnelAsAppUrl(rl, webhookAppUrl)) {
          envContent = setEnvLine(
            envContent,
            "NEXT_PUBLIC_APP_URL",
            webhookAppUrl,
          );
          appUrl = webhookAppUrl;
        }
      }
    }

    const hasInboundSecret = Boolean(
      getEnvValue(envContent, "RESEND_INBOUND_WEBHOOK_SECRET"),
    );

    const provisionWebhooks =
      resendApiKey &&
      webhookAppUrl &&
      (await promptYesNo(
        rl,
        "Create Resend webhooks via API (saves signing secrets to .env.local)?",
        !hasInboundSecret,
      ));

    if (provisionWebhooks && webhookAppUrl) {
      try {
        const result = await provisionResendWebhooks({
          apiKey: resendApiKey,
          appUrl: webhookAppUrl,
        });
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
        console.log("\nResend webhooks:");
        console.log(
          `  inbound (${result.inboundCreated ? "created" : "reused"}): ${result.inboundEndpoint}`,
        );
        console.log(
          `  events (${result.eventsCreated ? "created" : "reused"}): ${result.eventsEndpoint}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nCould not provision Resend webhooks: ${message}`);
        console.log(
          "Add signing secrets manually from the Resend dashboard, or run `pnpm resend:setup-webhooks --app-url https://your-host` later.",
        );
      }
    } else if (resendApiKey && !webhookAppUrl && !hasInboundSecret) {
      console.log(
        "\nSkipped Resend webhook API setup (no HTTPS tunnel). Paste signing secrets from the dashboard, or run `pnpm resend:setup-webhooks --app-url https://your-tunnel` after starting ngrok or another tunnel.",
      );
    }

    if (!getEnvValue(envContent, "RESEND_INBOUND_WEBHOOK_SECRET")) {
      const inboundSecret = await promptEnvValue(
        rl,
        envContent,
        "RESEND_INBOUND_WEBHOOK_SECRET",
        {
          label: "Resend inbound webhook signing secret",
          required: !webhookAppUrl,
        },
      );
      if (inboundSecret) {
        envContent = setEnvLine(
          envContent,
          "RESEND_INBOUND_WEBHOOK_SECRET",
          inboundSecret,
        );
      }
    }

    if (!getEnvValue(envContent, "RESEND_EVENTS_WEBHOOK_SECRET")) {
      const eventsSecret = await promptEnvValue(
        rl,
        envContent,
        "RESEND_EVENTS_WEBHOOK_SECRET",
        {
          label: "Resend events webhook signing secret",
          required: false,
        },
      );
      if (eventsSecret) {
        envContent = setEnvLine(
          envContent,
          "RESEND_EVENTS_WEBHOOK_SECRET",
          eventsSecret,
        );
      }
    }

    for (const entry of [
      {
        key: "SUPPORT_EMAIL",
        label: "Support sender email",
        required: true,
      },
      {
        key: "SUPPORT_FROM_NAME",
        label: "Support sender name",
        required: true,
        defaultValue: "Support",
      },
    ] as const) {
      const value = await promptEnvValue(rl, envContent, entry.key, entry);
      if (value) {
        envContent = setEnvLine(envContent, entry.key, value);
      }
    }
  }

  writeEnvFile(ENV_FILE, envContent);
  writeConfig(nextConfig);

  console.log("\nWrote:");
  console.log(`  ${displayPath(ENV_FILE)}`);
  console.log(`  ${displayPath(CONFIG_FILE)}`);
}

async function init(args: string[]): Promise<void> {
  const supabaseTarget = parseSupabaseTarget(args);
  let rl = createReadline();

  try {
    console.log("Ticqex init\n");
    rl = await setupSupabase(rl, supabaseTarget);
    await configureChannelsAndIntegrations(rl);
  } finally {
    rl.close();
  }

  runPnpm(["config:sync"]);
  console.log(
    "\nInit complete. Run `pnpm config:check` and `pnpm env:verify` to validate setup.",
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "help") {
    printRootUsage();
    return;
  }

  const [command, ...args] = argv;

  if (command === "init") {
    if (args.includes("--help")) {
      printInitUsage();
      return;
    }
    await init(args);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printRootUsage();
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
