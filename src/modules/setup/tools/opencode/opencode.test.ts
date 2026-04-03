import { expect, test, describe } from "bun:test";
import { OpencodeTool } from "./opencode";
import { MockProcessRunner } from "../../../../services/process-runner.mock";
import { MockFileSystem } from "../../../../services/file-system.mock";
import type { Platform } from "../../../../kernel/types";
import { homedir } from "os";
import { join } from "path";

const createMockPrompter = (confirmResult: boolean = true) => ({
  confirm: async () => confirmResult,
  select: async () => "",
});

const getConfigPath = () => join(homedir(), ".config", "opencode", "opencode.json");

describe("OpencodeTool.check", () => {
  test("returns installed and configured when opencode --version succeeds and config file exists", async () => {
    const runner = new MockProcessRunner();
    const fileSystem = new MockFileSystem();

    runner.setResponse("opencode", {
      stdout: "1.2.3",
      stderr: "",
      exitCode: 0,
    });

    await fileSystem.mkdirp(join(homedir(), ".config", "opencode"));
    await fileSystem.writeFile(getConfigPath(), '{"key": "value"}');

    const tool = new OpencodeTool();
    const result = await tool.check(runner, "linux", fileSystem);

    expect(result.toolName).toBe("opencode");
    expect(result.installed).toBe(true);
    expect(result.configured).toBe(true);
    expect(result.version).toBe("1.2.3");
    expect(result.message).toContain("installed and configured");
  });

  test("returns installed but not configured when opencode --version succeeds but config file does not exist", async () => {
    const runner = new MockProcessRunner();
    const fileSystem = new MockFileSystem();

    runner.setResponse("opencode", {
      stdout: "1.2.3",
      stderr: "",
      exitCode: 0,
    });

    const tool = new OpencodeTool();
    const result = await tool.check(runner, "linux", fileSystem);

    expect(result.toolName).toBe("opencode");
    expect(result.installed).toBe(true);
    expect(result.configured).toBe(false);
    expect(result.version).toBe("1.2.3");
    expect(result.message).toContain("not configured");
  });

  test("returns not installed when opencode --version fails", async () => {
    const runner = new MockProcessRunner();
    const fileSystem = new MockFileSystem();

    runner.setResponse("opencode", {
      stdout: "",
      stderr: "command not found: opencode",
      exitCode: 127,
    });

    const tool = new OpencodeTool();
    const result = await tool.check(runner, "linux", fileSystem);

    expect(result.toolName).toBe("opencode");
    expect(result.installed).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.message).toContain("not installed");
  });
});

describe("OpencodeTool.install", () => {
  test("installs opencode via npm when user confirms", async () => {
    const runner = new MockProcessRunner();
    const fileSystem = new MockFileSystem();
    const prompter = createMockPrompter(true);

    runner.setResponse("npm", {
      stdout: "+ opencode@1.2.3",
      stderr: "",
      exitCode: 0,
    });

    const tool = new OpencodeTool();
    const result = await tool.install(runner, prompter, "linux");

    expect(result.toolName).toBe("opencode");
    expect(result.success).toBe(true);
    expect(result.message).toContain("installed successfully");
  });

  test("returns failure when user declines installation", async () => {
    const runner = new MockProcessRunner();
    const prompter = createMockPrompter(false);

    const tool = new OpencodeTool();
    const result = await tool.install(runner, prompter, "linux");

    expect(result.toolName).toBe("opencode");
    expect(result.success).toBe(false);
    expect(result.message).toContain("declined");
  });

  test("returns failure when npm install fails", async () => {
    const runner = new MockProcessRunner();
    const prompter = createMockPrompter(true);

    runner.setResponse("npm", {
      stdout: "",
      stderr: "npm ERR! permission denied",
      exitCode: 1,
    });

    const tool = new OpencodeTool();
    const result = await tool.install(runner, prompter, "macos");

    expect(result.toolName).toBe("opencode");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Installation failed");
  });

  test("installs on all platforms using npm", async () => {
    const platforms: Platform[] = ["linux", "macos", "windows", "wsl1", "wsl2"];

    for (const platform of platforms) {
      const runner = new MockProcessRunner();
      const prompter = createMockPrompter(true);

      runner.setResponse("npm", {
        stdout: "+ opencode@1.2.3",
        stderr: "",
        exitCode: 0,
      });

      const tool = new OpencodeTool();
      const result = await tool.install(runner, prompter, platform);

      expect(result.success).toBe(true);
      expect(result.message).toContain("installed successfully");
    }
  });
});
