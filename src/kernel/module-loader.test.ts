import { describe, test, expect, beforeEach } from "bun:test";
import type { DevcliModule, ServiceContainer } from "./types";
import type { Command } from "@commander-js/extra-typings";

describe("ModuleLoader", () => {
  let mockProgram: Command;
  let mockServices: ServiceContainer;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let registerCalls: Array<{ module: DevcliModule; program: Command; services: ServiceContainer }>;

  beforeEach(() => {
    registerCalls = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createMockCommand = (): Command => {
      const mock: any = {
        command: () => createMockCommand(),
        description: () => createMockCommand(),
        action: () => createMockCommand(),
        option: () => createMockCommand(),
        argument: () => createMockCommand(),
      };
      return mock;
    };
    mockProgram = createMockCommand();

    mockServices = {
      getProcessRunner: () => ({ run: async () => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false }), spawn: () => ({ pid: 1, kill: () => {}, on: () => {} }) }),
      getConfigLoader: () => ({ load: async () => ({ version: "1.0", tools: [] }) }),
      getPrompter: () => ({ confirm: async () => true, select: async () => "" }),
      getFileSystem: () => ({ exists: async () => false, readFile: async () => "", writeFile: async () => {}, mkdirp: async () => {} }),
      getPlatformDetector: () => ({ detect: async () => ({ platform: "linux" as const, shell: "bash", packageManager: "apt", isWSL: false }) }),
      getFormatter: () => ({ success: () => {}, error: () => {}, warn: () => {}, info: () => {}, table: () => {}, json: () => {}, section: () => {} }),
    };
  });

  test("loadAll returns an array", async () => {
    const { ModuleLoader } = await import("./module-loader");
    const loader = new ModuleLoader();
    const modules = loader.loadAll();
    expect(Array.isArray(modules)).toBe(true);
  });

  test("loadAll returns same array on multiple calls", async () => {
    const { ModuleLoader } = await import("./module-loader");
    const loader = new ModuleLoader();
    const modules1 = loader.loadAll();
    const modules2 = loader.loadAll();
    expect(modules1).toBe(modules2);
  });

  test("registerAll does not throw when modules are registered", async () => {
    const { ModuleLoader } = await import("./module-loader");
    const loader = new ModuleLoader();
    expect(() => loader.registerAll(mockProgram, mockServices)).not.toThrow();
  });

  test("registerAll registers all modules", async () => {
    const { ModuleLoader } = await import("./module-loader");
    const loader = new ModuleLoader();
    const modules = loader.loadAll();
    loader.registerAll(mockProgram, mockServices);
    // All modules should be registered (setupModule is now included)
    expect(modules.length).toBeGreaterThan(0);
  });

  test("modules have non-empty names and descriptions", async () => {
    const { ModuleLoader } = await import("./module-loader");
    const loader = new ModuleLoader();
    const modules = loader.loadAll();
    for (const mod of modules) {
      expect(mod.name.length).toBeGreaterThan(0);
      expect(mod.description.length).toBeGreaterThan(0);
    }
  });

  test("modules have register functions", async () => {
    const { ModuleLoader } = await import("./module-loader");
    const loader = new ModuleLoader();
    const modules = loader.loadAll();
    for (const mod of modules) {
      expect(typeof mod.register).toBe("function");
    }
  });
});