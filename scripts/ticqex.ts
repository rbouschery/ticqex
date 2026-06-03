import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import {
  assignCloudSupabaseEnv,
  bootstrapCloudDatabase,
  fetchCloudSupabaseKeyEntries,
  resolveCloudSupabaseKeys,
  seedCloudAdmin,
  type CloudSupabaseKeys,
} from "./lib/cloud-supabase";
import { promptHidden } from "./lib/prompt-hidden";
import {
  closeReadline,
  createReadline,
  runPnpm,
  runSupabase,
} from "./lib/run-command";
import {
  createVercelProject,
  defaultVercelProjectName,
  isVercelCliAvailable,
  isVercelLinked,
  linkVercelProject,
  listVercelTeams,
  provisionVercelProductionUrl,
  pushEnvToVercel,
  finalizeVercelCloudDeployment,
  readLinkedVercelProjectName,
  resolveVercelTeamSelection,
  type VercelTeam,
} from "./lib/vercel-setup";
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
import {
  isUsableSupabasePublishableKey,
  isUsableSupabaseSecretKey,
} from "./lib/supabase-env";

type DbSetupMode = "skip" | "start" | "reset";
type SupabaseTarget = "local" | "cloud" | "skip";

type InitContext = {
  rl: ReadlineInterface;
  usedCloudSupabase: boolean;
  cloudDeployEnv?: Record<string, string>;
};

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

function readEnvContent(options: { createIfMissing?: boolean } = {}): string {
  const createIfMissing = options.createIfMissing ?? true;
  if (!createIfMissing && !fs.existsSync(ENV_FILE)) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      return fs.readFileSync(ENV_EXAMPLE, "utf8");
    }
    return "";
  }
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

function setTrackedEnvLine(
  envContent: string,
  key: string,
  value: string,
  cloudDeployEnv?: Record<string, string>,
): string {
  if (cloudDeployEnv) {
    cloudDeployEnv[key] = value;
  }
  return setEnvLine(envContent, key, value);
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
    cloudDeployEnv?: Record<string, string>;
  } = {},
): Promise<string> {
  const cloudValue = options.cloudDeployEnv?.[key]?.trim();
  const existing =
    cloudValue && !isPlaceholderEnvValue(cloudValue)
      ? cloudValue
      : getEnvValue(content, key);
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
): Promise<InitContext> {
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
    return { rl, usedCloudSupabase: false };
  }

  if (target === "cloud") {
    const cloudDeployEnv: Record<string, string> = {};
    return {
      rl: await setupCloudSupabase(rl, cloudDeployEnv),
      usedCloudSupabase: true,
      cloudDeployEnv,
    };
  }

  const envContent = readEnvContent();
  const defaultMode: DbSetupMode = hasSupabaseEnv(envContent) ? "skip" : "start";
  const mode = await promptChoice(
    rl,
    "\nLocal Supabase setup",
    ["skip", "start", "reset"] as const,
    defaultMode,
  );

  if (mode === "skip") return { rl, usedCloudSupabase: false };

  if (mode === "reset") {
    const confirmed = await promptYesNo(
      rl,
      "Reset wipes the local Supabase database. Continue?",
      true,
    );
    if (!confirmed) return { rl, usedCloudSupabase: false };
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
    true,
  );
  if (seedAdmin) {
    runPnpm(["db:seed-admin"]);
  }

  return { rl, usedCloudSupabase: false };
}

async function setupCloudSupabase(
  rl: ReadlineInterface,
  cloudDeployEnv: Record<string, string>,
): Promise<ReadlineInterface> {
  console.log("\nCloud Supabase setup");
  console.log(
    "You only need the project ref up front. After link/migrations/bootstrap, init fetches API keys via the Supabase CLI and stores them for Vercel sync only (not .env.local).",
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
    true,
  );
  if (pushMigrations) {
    const confirmed = await promptYesNo(
      activeRl,
      "This writes schema changes to the linked cloud database. Continue?",
      true,
    );
    if (confirmed) {
      closeReadline(activeRl);
      // Init already confirmed; --yes plus closed readline so the CLI owns stdin.
      runSupabase(["db", "push", "--linked", "--yes"], { input: "y\n" });
      activeRl = createReadline();
    }
  }

  const bootstrapDb = await promptYesNo(
    activeRl,
    "Bootstrap cloud database (statuses + settings)?",
    true,
  );
  if (bootstrapDb) {
    closeReadline(activeRl);
    bootstrapCloudDatabase();
    activeRl = createReadline();
  }

  closeReadline(activeRl);
  console.log("\nFetching Supabase API keys (via Supabase CLI)...");
  let keys: CloudSupabaseKeys = {
    url: `https://${projectRef}.supabase.co`,
    publishableKey: "",
    secretKey: "",
  };
  try {
    const entries = fetchCloudSupabaseKeyEntries(projectRef);
    keys = resolveCloudSupabaseKeys(projectRef, entries);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\n${message}`);
  }

  activeRl = createReadline();
  if (!isUsableSupabasePublishableKey(keys.publishableKey)) {
    console.log(
      "\nCould not auto-fetch a publishable key. Paste it from Supabase → Project Settings → API Keys.",
    );
    const publishableKey = await promptEnvValue(
      activeRl,
      readEnvContent(),
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      {
        label: "Supabase publishable key (Project Settings → API Keys)",
        required: true,
      },
    );
    keys.publishableKey = publishableKey;
  }
  if (!isUsableSupabaseSecretKey(keys.secretKey)) {
    console.log(
      "\nCould not auto-fetch a usable secret key (new sb_secret_ keys are often redacted by the CLI). Paste the full service_role JWT or revealed sb_secret_ key from Supabase → Project Settings → API Keys.",
    );
    const secretKey = await promptEnvValue(
      activeRl,
      readEnvContent(),
      "SUPABASE_SECRET_KEY",
      {
        label: "Supabase secret key (full service_role or sb_secret_ key)",
        required: true,
      },
    );
    keys.secretKey = secretKey;
  }

  assignCloudSupabaseEnv(keys, cloudDeployEnv);
  console.log("\nCollected cloud Supabase keys for Vercel sync (not written to .env.local).");

  const seedAdmin = await promptYesNo(
    activeRl,
    "Create an admin user in cloud Supabase?",
    true,
  );
  if (seedAdmin) {
    const email = await prompt(activeRl, "Admin email");
    if (!email) {
      throw new Error("Admin email is required to seed a cloud admin user.");
    }

    closeReadline(activeRl);
    const password = await promptHidden("Admin password");
    if (!password) {
      throw new Error("Admin password is required to seed a cloud admin user.");
    }

    seedCloudAdmin(keys, email, password, cloudDeployEnv);
    activeRl = createReadline();
    console.log(`\nAdmin user ready: ${email}`);
    console.log("Admin credentials were stored for Vercel sync only (not written to .env.local).");
  }

  return activeRl;
}

async function promptVercelTeam(
  rl: ReadlineInterface,
): Promise<{ scope: string; rl: ReadlineInterface }> {
  closeReadline(rl);
  let teams: VercelTeam[];
  try {
    teams = listVercelTeams();
  } catch (error) {
    rl = createReadline();
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not list Vercel teams: ${message}`);
  }
  rl = createReadline();

  if (teams.length === 0) {
    throw new Error("No Vercel teams found for the current account.");
  }

  console.log("\nVercel teams:");
  for (const [index, team] of teams.entries()) {
    const current = team.current ? " [current]" : "";
    console.log(`  ${index + 1}. ${team.name} (${team.slug})${current}`);
  }

  const defaultTeam = teams.find((team) => team.current) ?? teams[0]!;
  const defaultLabel = String(teams.indexOf(defaultTeam) + 1);

  while (true) {
    const answer = await prompt(
      rl,
      "Vercel team (number, slug, or Enter for current)",
      defaultLabel,
    );
    const selected = resolveVercelTeamSelection(answer, teams);
    if (selected) {
      console.log(`Using Vercel team: ${selected.name} (${selected.slug})`);
      return { scope: selected.slug, rl };
    }
    console.log("Please enter a valid team number or slug.");
  }
}

async function linkVercelForCloudInit(
  rl: ReadlineInterface,
  cloudDeployEnv: Record<string, string>,
): Promise<{
  rl: ReadlineInterface;
  vercelScope?: string;
  linked: boolean;
  projectName?: string;
}> {
  if (!isVercelCliAvailable()) {
    console.log(
      "\nVercel CLI not found. Install it globally, then re-run init to link and sync env vars.",
    );
    return { rl, linked: false };
  }

  const linkVercel = await promptYesNo(
    rl,
    "\nLink this repo to a Vercel project and sync env vars?",
    true,
  );
  if (!linkVercel) return { rl, linked: false };

  let vercelScope: string | undefined;
  let projectName = readLinkedVercelProjectName() ?? defaultVercelProjectName();
  if (!isVercelLinked()) {
    const teamSelection = await promptVercelTeam(rl);
    vercelScope = teamSelection.scope;
    rl = teamSelection.rl;
  }

  if (!isVercelLinked()) {
    const projectExists = await promptYesNo(
      rl,
      "Does a Vercel project already exist for this app?",
      true,
    );

    const defaultName = defaultVercelProjectName();
    projectName = await prompt(
      rl,
      projectExists ? "Existing Vercel project name" : "New Vercel project name",
      defaultName,
    );
    if (!projectName) {
      throw new Error("Vercel project name is required.");
    }

    closeReadline(rl);
    if (projectExists) {
      linkVercelProject(projectName, vercelScope);
    } else {
      createVercelProject(projectName, vercelScope);
      linkVercelProject(projectName, vercelScope);
    }
    rl = createReadline();
  } else {
    console.log("\nAlready linked to a Vercel project (.vercel/project.json).");
    projectName = readLinkedVercelProjectName() ?? projectName;
  }

  closeReadline(rl);
  const productionUrl = await provisionVercelProductionUrl(vercelScope, projectName);
  rl = createReadline();
  if (productionUrl) {
    cloudDeployEnv.NEXT_PUBLIC_APP_URL = productionUrl;
    console.log(`\nUsing Vercel production URL: ${productionUrl}`);
  } else {
    console.log(
      "\nCould not resolve a production URL from Vercel yet. Deploy once, then re-run init or set NEXT_PUBLIC_APP_URL during channel setup.",
    );
  }

  return { rl, vercelScope, linked: true, projectName };
}

async function syncCloudDeployEnvToVercel(
  rl: ReadlineInterface,
  cloudDeployEnv: Record<string, string>,
  vercelScope?: string,
): Promise<ReadlineInterface> {
  closeReadline(rl);
  try {
    const pushed = pushEnvToVercel(cloudDeployEnv, vercelScope);
    rl = createReadline();
    if (pushed.length) {
      console.log("\nSynced env vars to Vercel (production, preview, development):");
      for (const key of pushed) {
        console.log(`  ${key}`);
      }
    } else {
      console.log(
        "\nNo env vars were synced to Vercel (missing or placeholder values in the cloud deploy env).",
      );
    }
  } catch (error) {
    rl = createReadline();
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nCould not sync env vars to Vercel: ${message}`);
  }

  return rl;
}

async function configureChannelsAndIntegrations(
  rl: ReadlineInterface,
  cloudDeployEnv?: Record<string, string>,
): Promise<void> {
  console.log("\nAvailable channels: email");
  console.log("Available integrations: resend");

  const currentConfig = readConfig();
  const enableEmail = await promptYesNo(
    rl,
    "Enable the email channel?",
    currentConfig.channels.email?.enabled ?? true,
  );

  let envContent = readEnvContent({ createIfMissing: !cloudDeployEnv });
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
        label: cloudDeployEnv
          ? "App URL (Vercel production / webhook base)"
          : "App URL (local admin UI and links)",
        required: true,
        defaultValue: cloudDeployEnv?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
    ] as const) {
      const value = await promptEnvValue(rl, envContent, entry.key, {
        ...entry,
        cloudDeployEnv,
      });
      if (value) {
        envContent = setTrackedEnvLine(
          envContent,
          entry.key,
          value,
          cloudDeployEnv,
        );
      }
    }

    const resendApiKey =
      cloudDeployEnv?.RESEND_API_KEY ?? getEnvValue(envContent, "RESEND_API_KEY");
    let appUrl =
      cloudDeployEnv?.NEXT_PUBLIC_APP_URL ??
      getEnvValue(envContent, "NEXT_PUBLIC_APP_URL");
    let webhookAppUrl = appUrl && isHttpsAppUrl(appUrl) ? appUrl : null;

    if (appUrl && !webhookAppUrl && !cloudDeployEnv) {
      const tunnelUrl = await resolveLocalWebhookHttpsUrl({
        rl,
        localAppUrl: appUrl,
      });
      if (tunnelUrl) {
        webhookAppUrl = tunnelUrl;
        if (await promptUseTunnelAsAppUrl(rl, webhookAppUrl)) {
          envContent = setTrackedEnvLine(
            envContent,
            "NEXT_PUBLIC_APP_URL",
            webhookAppUrl,
            cloudDeployEnv,
          );
          appUrl = webhookAppUrl;
        }
      }
    }

    const hasInboundSecret = Boolean(
      cloudDeployEnv?.RESEND_INBOUND_WEBHOOK_SECRET ??
        getEnvValue(envContent, "RESEND_INBOUND_WEBHOOK_SECRET"),
    );

    const envTargetLabel = cloudDeployEnv ? "Vercel" : ".env.local";
    const provisionWebhooks =
      resendApiKey &&
      webhookAppUrl &&
      (await promptYesNo(
        rl,
        `Create Resend webhooks via API (saves signing secrets to ${envTargetLabel})?`,
        true,
      ));

    if (provisionWebhooks && webhookAppUrl) {
      try {
        const result = await provisionResendWebhooks({
          apiKey: resendApiKey,
          appUrl: webhookAppUrl,
        });
        envContent = setTrackedEnvLine(
          envContent,
          "RESEND_INBOUND_WEBHOOK_SECRET",
          result.inboundSigningSecret,
          cloudDeployEnv,
        );
        envContent = setTrackedEnvLine(
          envContent,
          "RESEND_EVENTS_WEBHOOK_SECRET",
          result.eventsSigningSecret,
          cloudDeployEnv,
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

    if (
      !(
        cloudDeployEnv?.RESEND_INBOUND_WEBHOOK_SECRET ??
        getEnvValue(envContent, "RESEND_INBOUND_WEBHOOK_SECRET")
      )
    ) {
      const inboundSecret = await promptEnvValue(
        rl,
        envContent,
        "RESEND_INBOUND_WEBHOOK_SECRET",
        {
          label: "Resend inbound webhook signing secret",
          required: !webhookAppUrl,
          cloudDeployEnv,
        },
      );
      if (inboundSecret) {
        envContent = setTrackedEnvLine(
          envContent,
          "RESEND_INBOUND_WEBHOOK_SECRET",
          inboundSecret,
          cloudDeployEnv,
        );
      }
    }

    if (
      !(
        cloudDeployEnv?.RESEND_EVENTS_WEBHOOK_SECRET ??
        getEnvValue(envContent, "RESEND_EVENTS_WEBHOOK_SECRET")
      )
    ) {
      const eventsSecret = await promptEnvValue(
        rl,
        envContent,
        "RESEND_EVENTS_WEBHOOK_SECRET",
        {
          label: "Resend events webhook signing secret",
          required: false,
          cloudDeployEnv,
        },
      );
      if (eventsSecret) {
        envContent = setTrackedEnvLine(
          envContent,
          "RESEND_EVENTS_WEBHOOK_SECRET",
          eventsSecret,
          cloudDeployEnv,
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
      const value = await promptEnvValue(rl, envContent, entry.key, {
        ...entry,
        cloudDeployEnv,
      });
      if (value) {
        envContent = setTrackedEnvLine(
          envContent,
          entry.key,
          value,
          cloudDeployEnv,
        );
      }
    }
  }

  writeConfig(nextConfig);

  console.log("\nWrote:");
  if (cloudDeployEnv) {
    console.log("  Vercel env vars (not written to .env.local)");
  } else {
    writeEnvFile(ENV_FILE, envContent);
    console.log(`  ${displayPath(ENV_FILE)}`);
  }
  console.log(`  ${displayPath(CONFIG_FILE)}`);
}

async function init(args: string[]): Promise<void> {
  const supabaseTarget = parseSupabaseTarget(args);
  let rl = createReadline();
  let usedCloudSupabase = false;

  try {
    console.log("Ticqex init\n");
    const supabaseContext = await setupSupabase(rl, supabaseTarget);
    rl = supabaseContext.rl;
    usedCloudSupabase = supabaseContext.usedCloudSupabase;

    let vercelLink:
      | {
          rl: ReadlineInterface;
          vercelScope?: string;
          linked: boolean;
          projectName?: string;
        }
      | undefined;
    if (usedCloudSupabase && supabaseContext.cloudDeployEnv) {
      vercelLink = await linkVercelForCloudInit(
        rl,
        supabaseContext.cloudDeployEnv,
      );
      rl = vercelLink.rl;
    }

    await configureChannelsAndIntegrations(rl, supabaseContext.cloudDeployEnv);

    if (vercelLink?.linked && supabaseContext.cloudDeployEnv) {
      rl = await syncCloudDeployEnvToVercel(
        rl,
        supabaseContext.cloudDeployEnv,
        vercelLink.vercelScope,
      );
      closeReadline(rl);
      await finalizeVercelCloudDeployment(
        vercelLink.vercelScope,
        vercelLink.projectName,
        supabaseContext.cloudDeployEnv,
      );
      rl = createReadline();
    }
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
