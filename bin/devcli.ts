#!/usr/bin/env -S bun run

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCLI } from "../src/cli";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function getVersion(): string {
  try {
    const packageJsonPath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      version?: string;
    };
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  try {
    await runCLI({
      version: getVersion(),
      argv: process.argv,
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
