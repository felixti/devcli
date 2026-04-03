import { describe, expect, test } from "bun:test";
import type {
	ChildProcess,
	FileSystem,
	Platform,
	ProcessRunner,
	RunOptions,
	RunResult,
	SpawnOptions,
} from "../../../../kernel/types";
import { AzureTool } from "./azure";

const createMockPrompter = (confirmResult: boolean = true) => ({
	confirm: async () => confirmResult,
	select: async () => "",
});

const mockFileSystem: FileSystem = {
	exists: async () => false,
	readFile: async () => "",
	writeFile: async () => {},
	mkdirp: async () => {},
};

class AzureMockProcessRunner implements ProcessRunner {
	private responses: Map<string, RunResult> = new Map();
	private callCount: Map<string, number> = new Map();

	setResponse(key: string, result: RunResult): void {
		this.responses.set(key, result);
	}

	async run(
		command: string,
		args: string[] = [],
		_options?: RunOptions,
	): Promise<RunResult> {
		const key = args.length > 0 ? `${command} ${args.join(" ")}` : command;
		const count = this.callCount.get(key) || 0;
		this.callCount.set(key, count + 1);

		const response = this.responses.get(key);
		if (response) {
			return response;
		}

		const fallback = this.responses.get(command);
		if (fallback) {
			return fallback;
		}

		return {
			stdout: "",
			stderr: `No mock response for ${key}`,
			exitCode: 127,
			timedOut: false,
		};
	}

	spawn(
		_command: string,
		_args?: string[],
		_options?: SpawnOptions,
	): ChildProcess {
		return {
			pid: 1234,
			kill: () => {},
			on: () => {},
		};
	}
}

describe("AzureTool.check", () => {
	test("returns installed and configured when az --version succeeds and az account show returns valid JSON with id", async () => {
		const runner = new AzureMockProcessRunner();
		runner.setResponse("az --version", {
			stdout: "azure-cli 2.50.0\n...",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});
		runner.setResponse("az account show", {
			stdout: JSON.stringify({ id: "12345", name: "test-sub" }),
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});

		const result = await AzureTool.check(runner, "linux", mockFileSystem);

		expect(result.installed).toBe(true);
		expect(result.configured).toBe(true);
		expect(result.version).toBe("2.50.0");
		expect(result.message).toContain("installed and configured");
	});

	test("returns installed but not configured when az --version succeeds but az account show fails", async () => {
		const runner = new AzureMockProcessRunner();
		runner.setResponse("az --version", {
			stdout: "azure-cli 2.50.0",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});
		runner.setResponse("az account show", {
			stdout: "",
			stderr: "Please run 'az login' to setup account.",
			exitCode: 1,
			timedOut: false,
		});

		const result = await AzureTool.check(runner, "linux", mockFileSystem);

		expect(result.installed).toBe(true);
		expect(result.configured).toBe(false);
		expect(result.version).toBe("2.50.0");
		expect(result.message).toContain("not configured");
	});

	test("returns not installed when az --version fails", async () => {
		const runner = new AzureMockProcessRunner();
		runner.setResponse("az", {
			stdout: "",
			stderr: "command not found: az",
			exitCode: 127,
			timedOut: false,
		});

		const result = await AzureTool.check(runner, "linux", mockFileSystem);

		expect(result.installed).toBe(false);
		expect(result.configured).toBe(false);
		expect(result.message).toContain("not installed");
	});

	test("detects expired token when az account show returns AADSTS error code", async () => {
		const runner = new AzureMockProcessRunner();
		runner.setResponse("az --version", {
			stdout: "azure-cli 2.50.0",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});
		runner.setResponse("az account show", {
			stdout: "",
			stderr: "AADSTS700082: The refresh token has expired due to inactivity.",
			exitCode: 1,
			timedOut: false,
		});

		const result = await AzureTool.check(runner, "linux", mockFileSystem);

		expect(result.installed).toBe(true);
		expect(result.configured).toBe(false);
		expect(result.message).toContain("token has expired");
	});

	test("detects expired token when az account show returns 'token expired' message", async () => {
		const runner = new AzureMockProcessRunner();
		runner.setResponse("az --version", {
			stdout: "azure-cli 2.50.0",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});
		runner.setResponse("az account show", {
			stdout: "",
			stderr: "Authentication token has expired. Please re-authenticate.",
			exitCode: 1,
			timedOut: false,
		});

		const result = await AzureTool.check(runner, "linux", mockFileSystem);

		expect(result.installed).toBe(true);
		expect(result.configured).toBe(false);
		expect(result.message).toContain("token has expired");
	});
});

describe("AzureTool.install", () => {
	test("uses brew install on macOS", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(true);
		runner.setResponse("brew", {
			stdout: "Installing azure-cli...",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});

		const result = await AzureTool.install(runner, prompter, "macos");

		expect(result.success).toBe(true);
		expect(result.message).toContain("installed successfully");
	});

	test("uses winget on Windows", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(true);
		runner.setResponse("winget", {
			stdout: "Installing Microsoft.AzureCLI...",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});

		const result = await AzureTool.install(runner, prompter, "windows");

		expect(result.success).toBe(true);
		expect(result.message).toContain("installed successfully");
	});

	test("uses curl script on Linux", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(true);
		runner.setResponse("bash", {
			stdout: "Installing azure-cli...",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});

		const result = await AzureTool.install(runner, prompter, "linux");

		expect(result.success).toBe(true);
		expect(result.message).toContain("installed successfully");
	});

	test("uses curl script on WSL2", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(true);
		runner.setResponse("bash", {
			stdout: "Installing azure-cli...",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});

		const result = await AzureTool.install(runner, prompter, "wsl2");

		expect(result.success).toBe(true);
		expect(result.message).toContain("installed successfully");
	});

	test("uses curl script on WSL1", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(true);
		runner.setResponse("bash", {
			stdout: "Installing azure-cli...",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		});

		const result = await AzureTool.install(runner, prompter, "wsl1");

		expect(result.success).toBe(true);
		expect(result.message).toContain("installed successfully");
	});

	test("returns failure when user declines installation", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(false);

		const result = await AzureTool.install(runner, prompter, "linux");

		expect(result.success).toBe(false);
		expect(result.message).toContain("declined");
	});

	test("returns failure when installation command fails", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(true);
		runner.setResponse("brew", {
			stdout: "",
			stderr: "brew command not found",
			exitCode: 127,
			timedOut: false,
		});

		const result = await AzureTool.install(runner, prompter, "macos");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Installation failed");
	});

	test("returns failure for unsupported platform", async () => {
		const runner = new AzureMockProcessRunner();
		const prompter = createMockPrompter(true);

		const result = await AzureTool.install(
			runner,
			prompter,
			"unknown" as Platform,
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("Unsupported platform");
	});
});
