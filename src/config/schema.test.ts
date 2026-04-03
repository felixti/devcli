import { test, expect } from "bun:test";
import { RemoteConfigSchema } from "./schema";
import { defaults } from "./defaults";

test("valid config parses successfully", () => {
  const validConfig = {
    version: "1.0.0",
    tools: [
      { name: "nvm", displayName: "Node Version Manager" },
    ],
  };

  const result = RemoteConfigSchema.parse(validConfig);
  expect(result.version).toBe("1.0.0");
  expect(result.tools).toHaveLength(1);
  expect(result.tools[0]!.name).toBe("nvm");
});

test("valid config with optional fields parses successfully", () => {
  const validConfig = {
    version: "2.0.0",
    tools: [
      {
        name: "azure-cli",
        displayName: "Azure CLI",
        minVersion: "2.50.0",
        installMethod: "brew install azure-cli",
      },
    ],
  };

  const result = RemoteConfigSchema.parse(validConfig);
  expect(result.tools[0]!.minVersion).toBe("2.50.0");
  expect(result.tools[0]!.installMethod).toBe("brew install azure-cli");
});

test("invalid config rejects missing version", () => {
  const invalidConfig = {
    tools: [{ name: "nvm", displayName: "nvm" }],
  };

  expect(() => RemoteConfigSchema.parse(invalidConfig)).toThrow();
});

test("invalid config rejects empty tools array", () => {
  const invalidConfig = {
    version: "1.0.0",
    tools: [],
  };

  expect(() => RemoteConfigSchema.parse(invalidConfig)).toThrow();
});

test("invalid config rejects missing tool name", () => {
  const invalidConfig = {
    version: "1.0.0",
    tools: [{ displayName: "nvm" }],
  };

  expect(() => RemoteConfigSchema.parse(invalidConfig)).toThrow();
});

test("bundled defaults pass schema validation", () => {
  const result = RemoteConfigSchema.parse(defaults);
  expect(result.version).toBe("1.0.0");
  expect(result.tools).toHaveLength(4);
  expect(result.tools.map((t) => t.name)).toEqual([
    "nvm",
    "azure-cli",
    "copilot",
    "opencode",
  ]);
});