import { expect, test } from "bun:test";
import type { CheckResult, InstallResult, Platform, ProcessRunner, Prompter } from "@/kernel/types";
import type { ToolModule } from "./registry";
import { ToolRegistry } from "./registry";

const mockProcessRunner: ProcessRunner = {
  run: async () => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false }),
  spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
};

const mockPrompter: Prompter = {
  confirm: async () => true,
  select: async () => "",
};

const createMockTool = (name: string, displayName: string): ToolModule => ({
  name,
  displayName,
  check: async () => ({ toolName: name, installed: true, configured: true }),
  install: async () => ({
    toolName: name,
    success: true,
    message: "installed",
  }),
});

test("register and get", () => {
  const registry = new ToolRegistry();
  const tool = createMockTool("git", "Git");

  registry.register(tool);
  const retrieved = registry.get("git");

  expect(retrieved).toBe(tool);
  expect(retrieved.name).toBe("git");
  expect(retrieved.displayName).toBe("Git");
});

test("get unknown throws descriptive error", () => {
  const registry = new ToolRegistry();

  expect(() => registry.get("nonexistent")).toThrow("Tool not found: nonexistent");
});

test("getAll returns all registered tools", () => {
  const registry = new ToolRegistry();
  const tool1 = createMockTool("git", "Git");
  const tool2 = createMockTool("docker", "Docker");
  const tool3 = createMockTool("node", "Node.js");

  registry.register(tool1);
  registry.register(tool2);
  registry.register(tool3);

  const all = registry.getAll();

  expect(all).toHaveLength(3);
  expect(all.map((t) => t.name)).toEqual(["git", "docker", "node"]);
});

test("duplicate registration overwrites previous", () => {
  const registry = new ToolRegistry();
  const tool1 = createMockTool("git", "Git");
  const tool2 = createMockTool("git", "Git Updated");

  registry.register(tool1);
  registry.register(tool2);

  const all = registry.getAll();
  expect(all).toHaveLength(1);
  expect(registry.get("git")).toBe(tool2);
  expect(registry.get("git").displayName).toBe("Git Updated");
});
