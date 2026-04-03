import { describe, test, expect, beforeEach } from "bun:test";
import { InstallCommand } from "./install";
import { MockProcessRunner } from "@/services/process-runner.mock";
import { MockPrompter } from "@/services/prompter.mock";
import { MockFileSystem } from "@/services/file-system.mock";
import { ToolRegistry, type ToolModule } from "../tools/registry";
import type { CheckResult, InstallResult, Platform } from "@/kernel/types";

/**
 * Custom mock process runner that supports command + args keying
 * Needed because nvm uses same command with different args
 */
class InstallMockProcessRunner extends MockProcessRunner {
  private responsesWithArgs: Map<string, { stdout: string; stderr: string; exitCode: number }> = new Map();

  setResponseWithArgs(command: string, args: string[], response: { stdout: string; stderr: string; exitCode: number }): void {
    const key = args.length > 0 ? `${command} ${args.join(" ")}` : command;
    this.responsesWithArgs.set(key, response);
  }

  override setResponse(command: string, response: { stdout: string; stderr: string; exitCode: number; delay?: number }): void {
    this.responsesWithArgs.set(command, response);
  }

  override async run(command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
    const key = args.length > 0 ? `${command} ${args.join(" ")}` : command;
    const response = this.responsesWithArgs.get(key);

    if (!response) {
      return {
        stdout: "",
        stderr: `MockProcessRunner: no response programmed for "${key}"`,
        exitCode: 127,
        timedOut: false,
      };
    }

    return {
      stdout: response.stdout,
      stderr: response.stderr,
      exitCode: response.exitCode,
      timedOut: false,
    };
  }
}

// Mock tool for testing
class MockTool implements ToolModule {
  name: string;
  displayName: string;
  private installed: boolean;
  private installShouldSucceed: boolean;

  constructor(name: string, displayName: string, installed: boolean, installShouldSucceed: boolean = true) {
    this.name = name;
    this.displayName = displayName;
    this.installed = installed;
    this.installShouldSucceed = installShouldSucceed;
  }

  async check(): Promise<CheckResult> {
    return {
      toolName: this.name,
      installed: this.installed,
      configured: this.installed,
      version: this.installed ? "1.0.0" : undefined,
      message: this.installed ? `${this.name} is installed` : `${this.name} is not installed`,
    };
  }

  async install(): Promise<InstallResult> {
    if (this.installShouldSucceed) {
      this.installed = true;
      return {
        toolName: this.name,
        success: true,
        message: `${this.name} installed successfully`,
      };
    }
    return {
      toolName: this.name,
      success: false,
      message: `${this.name} installation failed`,
    };
  }
}

describe("InstallCommand", () => {
  let runner: InstallMockProcessRunner;
  let prompter: MockPrompter;
  let fileSystem: MockFileSystem;
  let registry: ToolRegistry;
  let command: InstallCommand;

  beforeEach(() => {
    runner = new InstallMockProcessRunner();
    prompter = new MockPrompter();
    fileSystem = new MockFileSystem();
    registry = new ToolRegistry();
    command = new InstallCommand(registry);
  });

  test("should install specific tool (nvm) when tool name provided", async () => {
    // given: nvm is not installed
    const nvmTool = new MockTool("nvm", "Node Version Manager", false);
    registry.register(nvmTool);

    // and: platform detection returns linux
    runner.setResponseWithArgs("uname", ["-r"], { stdout: "5.0.0", stderr: "", exitCode: 0 });
    runner.setResponseWithArgs("uname", ["-s"], { stdout: "Linux", stderr: "", exitCode: 0 });

    // and: user confirms installation
    prompter.setConfirmResponse(true);

    // when: install command is executed with "nvm" argument
    const result = await command.execute({
      toolName: "nvm",
      yes: false,
      force: false,
      runner,
      prompter,
      fileSystem,
      platform: "linux",
    });

    // then: installation succeeds
    expect(result.success).toBe(true);
    expect(result.message).toContain("Node Version Manager installed successfully");
  });

  test("should install all missing tools when no tool name provided", async () => {
    // given: nvm is not installed, but azure and copilot are already installed
    const nvmTool = new MockTool("nvm", "Node Version Manager", false);
    const azureTool = new MockTool("azure", "Azure CLI", true);
    const copilotTool = new MockTool("copilot", "GitHub Copilot", true);

    registry.register(nvmTool);
    registry.register(azureTool);
    registry.register(copilotTool);

    // and: platform detection returns linux
    runner.setResponseWithArgs("uname", ["-r"], { stdout: "5.0.0", stderr: "", exitCode: 0 });
    runner.setResponseWithArgs("uname", ["-s"], { stdout: "Linux", stderr: "", exitCode: 0 });

    // and: user confirms installation
    prompter.setConfirmResponse(true);

    // when: install command is executed with no tool name
    const result = await command.execute({
      toolName: undefined,
      yes: false,
      force: false,
      runner,
      prompter,
      fileSystem,
      platform: "linux",
    });

    // then: installation succeeds and only nvm was installed
    expect(result.success).toBe(true);
    expect(result.message).toContain("Installed 1 tool");
    expect(result.message).toContain("nvm");
  });

  test("should skip already-installed tool unless --force flag is used", async () => {
    // given: nvm is already installed
    const nvmTool = new MockTool("nvm", "Node Version Manager", true);
    registry.register(nvmTool);

    // when: install command is executed without --force
    const result = await command.execute({
      toolName: "nvm",
      yes: false,
      force: false,
      runner,
      prompter,
      fileSystem,
      platform: "linux",
    });

    // then: tool is skipped
    expect(result.success).toBe(true);
    expect(result.message).toContain("already installed");
    expect(result.message).toContain("skipped");
  });

  test("should reinstall already-installed tool when --force flag is used", async () => {
    // given: nvm is already installed but we want to reinstall
    const nvmTool = new MockTool("nvm", "Node Version Manager", true);
    registry.register(nvmTool);

    // and: user confirms installation
    prompter.setConfirmResponse(true);

    // when: install command is executed with --force
    const result = await command.execute({
      toolName: "nvm",
      yes: false,
      force: true,
      runner,
      prompter,
      fileSystem,
      platform: "linux",
    });

    // then: tool is reinstalled
    expect(result.success).toBe(true);
    expect(result.message).toContain("Node Version Manager installed successfully");
    expect(result.message).not.toContain("skipped");
  });

  test("should skip confirmation when --yes flag is used", async () => {
    // given: nvm is not installed
    const nvmTool = new MockTool("nvm", "Node Version Manager", false);
    registry.register(nvmTool);

    // when: install command is executed with --yes (no confirmation needed)
    const result = await command.execute({
      toolName: "nvm",
      yes: true,
      force: false,
      runner,
      prompter,
      fileSystem,
      platform: "linux",
    });

    // then: installation succeeds without prompting
    expect(result.success).toBe(true);
    expect(result.message).toContain("Node Version Manager installed successfully");

    // and: no confirm calls were made
    expect(prompter.getConfirmCalls().length).toBe(0);
  });

  test("should throw error for unknown tool name", async () => {
    // given: registry is empty (no tools registered)

    // when: install command is executed with unknown tool name
    // then: it should throw an error
    await expect(
      command.execute({
        toolName: "unknown-tool",
        yes: false,
        force: false,
        runner,
        prompter,
        fileSystem,
        platform: "linux",
      })
    ).rejects.toThrow("Tool not found: unknown-tool");
  });
});
