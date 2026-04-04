import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";

describe("CLI Integration", () => {
  test("--help flag shows usage information", () => {
    const output = execSync("bun run bin/devcli.ts -- --help", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    expect(output).toContain("devcli");
    expect(output).toContain("setup");
  });

  test(
    "setup doctor --json returns valid JSON",
    () => {
      let output: string;
      try {
        output = execSync("bun run bin/devcli.ts -- setup doctor --json", {
          encoding: "utf-8",
          cwd: process.cwd(),
          timeout: 30000,
        });
      } catch (error: any) {
        // Doctor returns non-zero when some tools aren't configured
        output = error.stdout || error.message;
      }
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
    },
    { timeout: 35000 },
  );
});
