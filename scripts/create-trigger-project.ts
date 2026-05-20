/**
 * Creates a Trigger.dev cloud project (if missing) and links trigger.config.ts.
 * Requires `pnpm trigger:login` first.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_PROJECT_NAME = "ticqex";
const DEFAULT_ORG_SLUG = "sempervirens-9ab6";

type TriggerCliConfig = {
  profiles: Record<string, { accessToken: string; apiUrl: string }>;
  currentProfile?: string;
};

type Organization = {
  id: string;
  slug: string;
  title: string;
};

type Project = {
  externalRef: string;
  name: string;
  organization: { slug: string };
};

function triggerConfigPath(): string {
  if (process.env.TRIGGER_CONFIG_PATH) {
    return process.env.TRIGGER_CONFIG_PATH;
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library/Preferences/trigger/config.json");
  }

  return path.join(os.homedir(), ".config", "trigger", "config.json");
}

function readAccessToken(): { token: string; apiUrl: string } {
  const configFile = triggerConfigPath();
  if (!fs.existsSync(configFile)) {
    throw new Error(
      `Trigger CLI config not found. Run \`pnpm trigger:login\` first.`,
    );
  }

  const config = JSON.parse(
    fs.readFileSync(configFile, "utf8"),
  ) as TriggerCliConfig;
  const profileName = config.currentProfile ?? "default";
  const profile = config.profiles[profileName];

  if (!profile?.accessToken) {
    throw new Error(`No access token for profile "${profileName}".`);
  }

  return {
    token: profile.accessToken,
    apiUrl: profile.apiUrl ?? "https://api.trigger.dev",
  };
}

async function api<T>(
  apiUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function main(): Promise<void> {
  const projectName = process.env.TRIGGER_PROJECT_NAME ?? DEFAULT_PROJECT_NAME;
  const orgSlug = process.env.TRIGGER_ORG_SLUG ?? DEFAULT_ORG_SLUG;
  const { token, apiUrl } = readAccessToken();

  const projects = await api<Project[]>(apiUrl, token, "/api/v1/projects");
  const existing = projects.find(
    (project) =>
      project.name === projectName &&
      project.organization.slug === orgSlug,
  );

  let projectRef = existing?.externalRef;
  if (!projectRef) {
    const orgId = await resolveOrgId(apiUrl, token, orgSlug);
    const created = await api<Project>(
      apiUrl,
      token,
      `/api/v1/orgs/${orgId}/projects`,
      {
        method: "POST",
        body: JSON.stringify({ name: projectName }),
      },
    );
    projectRef = created.externalRef;
  }

  const triggerBin = path.join(ROOT, "node_modules", ".bin", "trigger");
  const result = spawnSync(
    triggerBin,
    [
      "init",
      "--yes",
      "--project-ref",
      projectRef,
      "--skip-package-install",
      "--override-config",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );

  const output = (result.stdout ?? "") + (result.stderr ?? "");
  if (result.status !== 0) {
    throw new Error(output.trim() || "`trigger init` failed");
  }

  restoreTriggerConfig(projectRef);

  console.log(`Trigger.dev project ready: ${projectName} (${projectRef})`);
  console.log("Run `pnpm trigger:env` to sync credentials into .env.local.");
}

async function resolveOrgId(
  apiUrl: string,
  token: string,
  orgSlug: string,
): Promise<string> {
  const orgs = await api<Organization[]>(apiUrl, token, "/api/v1/orgs");
  const org = orgs.find((item) => item.slug === orgSlug);
  if (!org) {
    throw new Error(
      `Organization "${orgSlug}" not found. Set TRIGGER_ORG_SLUG to one of: ${orgs.map((o) => o.slug).join(", ")}`,
    );
  }
  return org.id;
}

function restoreTriggerConfig(projectRef: string): void {
  const configPath = path.join(ROOT, "trigger.config.ts");
  const content = `import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "${projectRef}",
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
    },
  },
  dirs: ["./trigger"],
});
`;

  fs.writeFileSync(configPath, content);

  const examplePath = path.join(ROOT, "src", "trigger", "example.ts");
  if (fs.existsSync(examplePath)) {
    fs.unlinkSync(examplePath);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
