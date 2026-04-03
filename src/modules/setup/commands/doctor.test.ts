import { beforeEach, describe, expect, test } from "bun:test";
import type {
	CheckResult,
	InstallResult,
	PlatformInfo,
	RemoteConfig,
	ServiceContainer,
} from "@/kernel/types";
import type { ToolModule } from "@/modules/setup/tools/registry";
import { ToolRegistry } from "@/modules/setup/tools/registry";
import { Formatter } from "@/output/formatter";
import { MockConfigLoader } from "@/services/config-loader.mock";
import { MockFileSystem } from "@/services/file-system.mock";
import { MockProcessRunner } from "@/services/process-runner.mock";
import { MockPrompter } from "@/services/prompter.mock";
import { DoctorCommand } from "./doctor";

class MockPlatformDetector {
	private platformInfo: PlatformInfo = {
		platform: "linux",
		shell: "bash",
		packageManager: "apt",
		isWSL: false,
	};

	setPlatform(info: PlatformInfo): void {
		this.platformInfo = info;
	}

	async detect(): Promise<PlatformInfo> {
		return this.platformInfo;
	}
}

function createMockTool(
	name: string,
	displayName: string,
	checkResult: CheckResult,
	installResult: InstallResult,
): ToolModule {
	return {
		name,
		displayName,
		async check(): Promise<CheckResult> {
			return checkResult;
		},
		async install(): Promise<InstallResult> {
			return installResult;
		},
	};
}

describe("DoctorCommand", () => {
	let runner: MockProcessRunner;
	let prompter: MockPrompter;
	let configLoader: MockConfigLoader;
	let fileSystem: MockFileSystem;
	let formatter: Formatter;
	let platformDetector: MockPlatformDetector;
	let registry: ToolRegistry;
	let outputLines: string[];
	let command: DoctorCommand;

	beforeEach(() => {
		runner = new MockProcessRunner();
		prompter = new MockPrompter();
		fileSystem = new MockFileSystem();
		platformDetector = new MockPlatformDetector();
		registry = new ToolRegistry();
		outputLines = [];

		formatter = new Formatter(
			false,
			(line: string) => outputLines.push(line),
			(line: string) => outputLines.push(line),
		);

		configLoader = new MockConfigLoader({
			version: "1.0.0",
			tools: [
				{ name: "tool1", displayName: "Tool One" },
				{ name: "tool2", displayName: "Tool Two" },
			],
		});

		const services: ServiceContainer = {
			getProcessRunner: () => runner,
			getConfigLoader: () => configLoader,
			getPrompter: () => prompter,
			getFileSystem: () => fileSystem,
			getPlatformDetector: () => platformDetector,
			getFormatter: () => formatter,
		};

		command = new DoctorCommand(registry, services);
	});

	test("should return exit code 0 when all tools are OK", async () => {
		registry.register(
			createMockTool(
				"tool1",
				"Tool One",
				{
					toolName: "tool1",
					installed: true,
					configured: true,
					version: "1.0.0",
					message: "Tool One is installed and configured",
				},
				{
					toolName: "tool1",
					success: true,
					message: "Already installed",
				},
			),
		);
		registry.register(
			createMockTool(
				"tool2",
				"Tool Two",
				{
					toolName: "tool2",
					installed: true,
					configured: true,
					version: "2.0.0",
					message: "Tool Two is installed and configured",
				},
				{
					toolName: "tool2",
					success: true,
					message: "Already installed",
				},
			),
		);

		const exitCode = await command.execute({});

		expect(exitCode).toBe(0);
		expect(outputLines.some((l: string) => l.includes("Tool One"))).toBe(true);
		expect(outputLines.some((l: string) => l.includes("Tool Two"))).toBe(true);
	});

	test("should prompt to install missing tool and install when confirmed", async () => {
		let installCalled = false;
		registry.register(
			createMockTool(
				"tool1",
				"Tool One",
				{
					toolName: "tool1",
					installed: true,
					configured: true,
					version: "1.0.0",
					message: "Tool One OK",
				},
				{
					toolName: "tool1",
					success: true,
					message: "Already installed",
				},
			),
		);
		registry.register({
			name: "tool2",
			displayName: "Tool Two",
			async check(): Promise<CheckResult> {
				return {
					toolName: "tool2",
					installed: false,
					configured: false,
					message: "Tool Two is not installed",
				};
			},
			async install(): Promise<InstallResult> {
				installCalled = true;
				return {
					toolName: "tool2",
					success: true,
					message: "Tool Two installed successfully",
				};
			},
		});

		prompter.setConfirmResponse(true);

		const exitCode = await command.execute({});

		expect(installCalled).toBe(true);
		expect(exitCode).toBe(0);
		expect(prompter.getConfirmCalls().length).toBeGreaterThan(0);
	});

	test("should output JSON when --json flag is used", async () => {
		registry.register(
			createMockTool(
				"tool1",
				"Tool One",
				{
					toolName: "tool1",
					installed: true,
					configured: true,
					version: "1.0.0",
					message: "OK",
				},
				{
					toolName: "tool1",
					success: true,
					message: "OK",
				},
			),
		);

		await command.execute({ json: true });

		const jsonOutput = outputLines.join("\n");
		const parsed = JSON.parse(jsonOutput);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBe(1);
		expect(parsed[0]).toHaveProperty("toolName", "tool1");
		expect(parsed[0]).toHaveProperty("installed", true);
		expect(parsed[0]).toHaveProperty("configured", true);
	});

	test("should auto-install when --yes flag is used", async () => {
		let installCalled = false;
		registry.register({
			name: "tool1",
			displayName: "Tool One",
			async check(): Promise<CheckResult> {
				return {
					toolName: "tool1",
					installed: false,
					configured: false,
					message: "Not installed",
				};
			},
			async install(): Promise<InstallResult> {
				installCalled = true;
				return {
					toolName: "tool1",
					success: true,
					message: "Installed",
				};
			},
		});

		const exitCode = await command.execute({ yes: true });

		expect(installCalled).toBe(true);
		expect(exitCode).toBe(0);
		expect(prompter.getConfirmCalls().length).toBe(0);
	});

	test("should check single tool when --tool flag is used", async () => {
		let tool1Checked = false;
		let tool2Checked = false;
		registry.register({
			name: "tool1",
			displayName: "Tool One",
			async check(): Promise<CheckResult> {
				tool1Checked = true;
				return { toolName: "tool1", installed: true, configured: true };
			},
			async install(): Promise<InstallResult> {
				return { toolName: "tool1", success: true, message: "OK" };
			},
		});
		registry.register({
			name: "tool2",
			displayName: "Tool Two",
			async check(): Promise<CheckResult> {
				tool2Checked = true;
				return { toolName: "tool2", installed: true, configured: true };
			},
			async install(): Promise<InstallResult> {
				return { toolName: "tool2", success: true, message: "OK" };
			},
		});

		await command.execute({ tool: "tool1" });

		expect(tool1Checked).toBe(true);
		expect(tool2Checked).toBe(false);
	});

	test("should handle config load failure with fallback to defaults", async () => {
		const failingConfigLoader = {
			async load(): Promise<RemoteConfig> {
				throw new Error("Network error");
			},
		};

		const services: ServiceContainer = {
			getProcessRunner: () => runner,
			getConfigLoader: () => failingConfigLoader,
			getPrompter: () => prompter,
			getFileSystem: () => fileSystem,
			getPlatformDetector: () => platformDetector,
			getFormatter: () => formatter,
		};

		const cmd = new DoctorCommand(registry, services);

		registry.register(
			createMockTool(
				"tool1",
				"Tool One",
				{
					toolName: "tool1",
					installed: true,
					configured: true,
					message: "OK",
				},
				{
					toolName: "tool1",
					success: true,
					message: "OK",
				},
			),
		);

		const exitCode = await cmd.execute({});

		expect(exitCode).toBe(0);
		expect(outputLines.some((l: string) => l.includes("tool1"))).toBe(true);
	});

	test("should return exit code 1 when install fails", async () => {
		registry.register({
			name: "tool1",
			displayName: "Tool One",
			async check(): Promise<CheckResult> {
				return {
					toolName: "tool1",
					installed: false,
					configured: false,
					message: "Not installed",
				};
			},
			async install(): Promise<InstallResult> {
				return {
					toolName: "tool1",
					success: false,
					message: "Installation failed: network error",
				};
			},
		});

		prompter.setConfirmResponse(true);

		const exitCode = await command.execute({});

		expect(exitCode).toBe(1);
	});
});
