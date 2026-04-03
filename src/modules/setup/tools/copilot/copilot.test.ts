import { expect, test } from "bun:test";
import type { Platform } from "../../../../kernel/types";
import { MockFileSystem } from "../../../../services/file-system.mock";
import { MockProcessRunner } from "../../../../services/process-runner.mock";
import { CopilotTool } from "./copilot";

const createPlatform = (platform: Platform) => ({
	platform,
	shell: "bash",
	packageManager:
		platform === "macos" ? "brew" : platform === "windows" ? "winget" : "apt",
	isWSL: false,
});

test("check - gh extension path: installed and configured", async () => {
	const runner = new MockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "gh-copilot version 1.0.0\n✓ Logged in to github.com",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("linux").platform,
		fileSystem,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.installed).toBe(true);
	expect(result.configured).toBe(true);
	expect(result.version).toBe("1.0.0");
});

test("check - standalone github-copilot-cli path", async () => {
	const runner = new MockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "",
		stderr: "unknown command copilot",
		exitCode: 1,
	});
	runner.setResponse("github-copilot-cli", {
		stdout: "github-copilot-cli version 1.0.0",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("macos").platform,
		fileSystem,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.installed).toBe(true);
	expect(result.version).toBe("1.0.0");
});

test("check - copilot not installed", async () => {
	const runner = new MockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "",
		stderr: "unknown command copilot",
		exitCode: 1,
	});
	runner.setResponse("github-copilot-cli", {
		stdout: "",
		stderr: "command not found",
		exitCode: 127,
	});

	const result = await tool.check(
		runner,
		createPlatform("linux").platform,
		fileSystem,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.installed).toBe(false);
	expect(result.configured).toBe(false);
	expect(result.message).toContain("not installed");
});

test("check - installed but not configured (gh not logged in)", async () => {
	const runner = new MockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "gh-copilot version 1.0.0",
		stderr: "You are not logged into any GitHub hosts",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("macos").platform,
		fileSystem,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.installed).toBe(true);
	expect(result.configured).toBe(false);
	expect(result.version).toBe("1.0.0");
	expect(result.message).toContain("not configured");
});

test("install - gh installed, installs extension successfully", async () => {
	const runner = new MockProcessRunner();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "Installed github/gh-copilot",
		stderr: "",
		exitCode: 0,
	});

	const mockPrompter = {
		confirm: async () => true,
		select: async () => "",
	};

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("linux").platform,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.success).toBe(true);
	expect(result.message).toContain("installed");
});

test("install - gh not installed triggers gh installation", async () => {
	const runner = new MockProcessRunner();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "",
		stderr: "command not found",
		exitCode: 127,
	});
	runner.setResponse("brew", {
		stdout: "Installing gh...",
		stderr: "",
		exitCode: 0,
	});

	const mockPrompter = {
		confirm: async () => true,
		select: async () => "brew",
	};

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("macos").platform,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.success).toBe(false);
	expect(result.message).toContain("Failed to install Copilot extension");
});

test("install - gh installation failure returns error", async () => {
	const runner = new MockProcessRunner();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "",
		stderr: "command not found",
		exitCode: 127,
	});
	runner.setResponse("brew", {
		stdout: "",
		stderr: "brew install failed",
		exitCode: 1,
	});

	const mockPrompter = {
		confirm: async () => true,
		select: async () => "brew",
	};

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("macos").platform,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.success).toBe(false);
	expect(result.message).toContain("Failed to install gh CLI");
});

test("install - extension installation failure returns error", async () => {
	const runner = new MockProcessRunner();
	const tool = new CopilotTool();

	runner.setResponse("gh", {
		stdout: "gh version 2.0.0",
		stderr: "",
		exitCode: 0,
	});

	const mockPrompter = {
		confirm: async () => true,
		select: async () => "",
	};

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("linux").platform,
	);

	expect(result.toolName).toBe("copilot");
	expect(result.success).toBe(true);
	expect(result.message).toContain("installed");
});
