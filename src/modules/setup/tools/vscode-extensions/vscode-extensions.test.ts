import { expect, test } from "bun:test";
import { homedir } from "os";
import { join } from "path";
import type {
	ChildProcess,
	Platform,
	ProcessRunner,
	RunResult,
	SpawnOptions,
} from "@/kernel/types";
import { MockFileSystem } from "@/services/file-system.mock";
import { VscodeExtensionsTool } from "./vscode-extensions";

interface MockResponse {
	stdout: string;
	stderr: string;
	exitCode: number;
	delay?: number;
}

interface MockChildProcess {
	pid: number;
	killed: boolean;
	listeners: Map<string, (arg: number | Error) => void>;
}

class ArgsAwareMockProcessRunner implements ProcessRunner {
	private responses: Map<string, MockResponse> = new Map();
	private callLog: Array<{ command: string; args: string[] }> = [];

	setResponse(command: string, response: MockResponse): void {
		this.responses.set(command, response);
	}

	setResponseWithArgs(
		command: string,
		args: string[],
		response: MockResponse,
	): void {
		const key = args.length > 0 ? `${command} ${args.join(" ")}` : command;
		this.responses.set(key, response);
	}

	clearResponses(): void {
		this.responses.clear();
	}

	getCallLog(): Array<{ command: string; args: string[] }> {
		return [...this.callLog];
	}

	clearCallLog(): void {
		this.callLog = [];
	}

	async run(
		command: string,
		args: string[] = [],
		_options?: unknown,
	): Promise<RunResult> {
		this.callLog.push({ command, args });

		const fullKey = args.length > 0 ? `${command} ${args.join(" ")}` : command;
		let response = this.responses.get(fullKey);

		if (!response) {
			response = this.responses.get(command);
		}

		if (!response) {
			return {
				stdout: "",
				stderr: `ArgsAwareMockProcessRunner: no response programmed for "${fullKey}"`,
				exitCode: 127,
				timedOut: false,
			};
		}

		const { stdout, stderr, exitCode, delay = 0 } = response;

		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		return {
			stdout,
			stderr,
			exitCode,
			timedOut: false,
		};
	}

	spawn(
		_command: string,
		_args: string[] = [],
		_options?: SpawnOptions,
	): ChildProcess {
		const mock: MockChildProcess = {
			pid: Math.floor(Math.random() * 10000) + 1000,
			killed: false,
			listeners: new Map(),
		};

		return {
			pid: mock.pid,
			kill: () => {
				mock.killed = true;
			},
			on: (
				event: "exit" | "error",
				callback: (arg: number | Error) => void,
			) => {
				mock.listeners.set(event, callback);
			},
		} as ChildProcess;
	}
}

const createPlatform = (platform: Platform) => ({
	platform,
	shell: "bash",
	packageManager:
		platform === "macos" ? "brew" : platform === "windows" ? "winget" : "apt",
	isWSL: platform === "wsl1" || platform === "wsl2",
});

test("check - VSCode installed + all extensions present → configured: true", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "1.85.0",
		stderr: "",
		exitCode: 0,
	});
	runner.setResponseWithArgs("code", ["--list-extensions"], {
		stdout: "github.copilot-chat\nsst-dev.opencode",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("linux").platform,
		fileSystem,
	);

	expect(result.installed).toBe(true);
	expect(result.configured).toBe(true);
	expect(result.version).toBe("1.85.0");
});

test("check - VSCode installed + some extensions missing → configured: false", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "1.85.0",
		stderr: "",
		exitCode: 0,
	});
	runner.setResponseWithArgs("code", ["--list-extensions"], {
		stdout: "github.copilot-chat",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("linux").platform,
		fileSystem,
	);

	expect(result.installed).toBe(true);
	expect(result.configured).toBe(false);
	expect(result.message).toContain("Some VSCode extensions are missing");
});

test("check - VSCode installed + no extensions → configured: false", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "1.85.0",
		stderr: "",
		exitCode: 0,
	});
	runner.setResponseWithArgs("code", ["--list-extensions"], {
		stdout: "",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("linux").platform,
		fileSystem,
	);

	expect(result.installed).toBe(true);
	expect(result.configured).toBe(false);
});

test("check - VSCode not installed (code --version fails) → installed: false", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "",
		stderr: "command not found",
		exitCode: 127,
	});

	const result = await tool.check(
		runner,
		createPlatform("linux").platform,
		fileSystem,
	);

	expect(result.installed).toBe(false);
	expect(result.configured).toBe(false);
	expect(result.message).toContain("not installed");
});

test("check - WSL2 + vscode-server exists + extensions present → configured: true", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	await fileSystem.mkdirp(join(homedir(), ".vscode-server"));

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "1.85.0",
		stderr: "",
		exitCode: 0,
	});
	runner.setResponseWithArgs("code", ["--list-extensions"], {
		stdout: "github.copilot-chat\nsst-dev.opencode",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("wsl2").platform,
		fileSystem,
	);

	expect(result.installed).toBe(true);
	expect(result.configured).toBe(true);
});

test("check - WSL2 + vscode-server NOT found → installed: false", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "1.85.0",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("wsl2").platform,
		fileSystem,
	);

	expect(result.installed).toBe(false);
	expect(result.configured).toBe(false);
	expect(result.message).toContain("not found");
});

test("check - Windows platform → getExtensionsForPlatform returns 3 extensions", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "1.85.0",
		stderr: "",
		exitCode: 0,
	});
	runner.setResponseWithArgs("code", ["--list-extensions"], {
		stdout:
			"github.copilot-chat\nsst-dev.opencode\nms-vscode-remote.remote-wsl",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("windows").platform,
		fileSystem,
	);

	expect(result.installed).toBe(true);
	expect(result.configured).toBe(true);

	runner.clearCallLog();
});

test("check - macOS platform → getExtensionsForPlatform returns 2 extensions", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs("code", ["--version"], {
		stdout: "1.85.0",
		stderr: "",
		exitCode: 0,
	});
	runner.setResponseWithArgs("code", ["--list-extensions"], {
		stdout: "github.copilot-chat\nsst-dev.opencode",
		stderr: "",
		exitCode: 0,
	});

	const result = await tool.check(
		runner,
		createPlatform("macos").platform,
		fileSystem,
	);

	expect(result.installed).toBe(true);
	expect(result.configured).toBe(true);
});

test("install - All extensions install successfully → success: true", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs(
		"code",
		["--install-extension", "github.copilot-chat"],
		{
			stdout: "Installed extension: github.copilot-chat",
			stderr: "",
			exitCode: 0,
		},
	);
	runner.setResponseWithArgs(
		"code",
		["--install-extension", "sst-dev.opencode"],
		{
			stdout: "Installed extension: sst-dev.opencode",
			stderr: "",
			exitCode: 0,
		},
	);

	const mockPrompter = { confirm: async () => true, select: async () => "" };

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("linux").platform,
	);

	expect(result.success).toBe(true);
	expect(result.message).toContain(
		"Successfully installed 2 VSCode extension(s)",
	);
});

test("install - One extension fails → success: false", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs(
		"code",
		["--install-extension", "github.copilot-chat"],
		{
			stdout: "Installed extension: github.copilot-chat",
			stderr: "",
			exitCode: 0,
		},
	);
	runner.setResponseWithArgs(
		"code",
		["--install-extension", "sst-dev.opencode"],
		{
			stdout: "",
			stderr: "Failed to install",
			exitCode: 1,
		},
	);

	const mockPrompter = { confirm: async () => true, select: async () => "" };

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("linux").platform,
	);

	expect(result.success).toBe(false);
	expect(result.message).toContain("sst-dev.opencode");
});

test("install - VSCode CLI not found (exitCode 127) → success: false", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs(
		"code",
		["--install-extension", "github.copilot-chat"],
		{
			stdout: "",
			stderr: "command not found",
			exitCode: 127,
		},
	);

	const mockPrompter = { confirm: async () => true, select: async () => "" };

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("linux").platform,
	);

	expect(result.success).toBe(false);
	expect(result.message).toContain("not available");
});

test("install - Windows platform installs 3 extensions (verify correct count)", async () => {
	const runner = new ArgsAwareMockProcessRunner();
	const fileSystem = new MockFileSystem();
	const tool = new VscodeExtensionsTool();

	runner.setResponseWithArgs(
		"code",
		["--install-extension", "github.copilot-chat"],
		{
			stdout: "Installed extension: github.copilot-chat",
			stderr: "",
			exitCode: 0,
		},
	);
	runner.setResponseWithArgs(
		"code",
		["--install-extension", "sst-dev.opencode"],
		{
			stdout: "Installed extension: sst-dev.opencode",
			stderr: "",
			exitCode: 0,
		},
	);
	runner.setResponseWithArgs(
		"code",
		["--install-extension", "ms-vscode-remote.remote-wsl"],
		{
			stdout: "Installed extension: ms-vscode-remote.remote-wsl",
			stderr: "",
			exitCode: 0,
		},
	);

	const mockPrompter = { confirm: async () => true, select: async () => "" };

	const result = await tool.install(
		runner,
		mockPrompter,
		createPlatform("windows").platform,
	);

	expect(result.success).toBe(true);

	const callLog = runner.getCallLog();
	const installCalls = callLog.filter(
		(call) => call.command === "code" && call.args[0] === "--install-extension",
	);
	expect(installCalls.length).toBe(3);
});
