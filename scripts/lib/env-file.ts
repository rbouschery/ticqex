import fs from "node:fs";

export function setEnvLine(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const trimmed = content.replace(/\n?$/, "");
  return `${trimmed}\n${line}\n`;
}

export function readOrCreateEnvFile(
  filePath: string,
  examplePath: string,
): string {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  }

  if (!fs.existsSync(examplePath)) {
    throw new Error(`Missing ${filePath} and ${examplePath}`);
  }

  console.log(`Created ${filePath} from ${examplePath}`);
  return fs.readFileSync(examplePath, "utf8");
}

export function writeEnvFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`);
}
