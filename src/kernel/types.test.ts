import { describe, expect, type Mock, test } from "bun:test";
import type {
	CheckResult,
	ConfigLoader,
	DevcliModule,
	FileSystem,
	Formatter,
	InstallResult,
	Platform,
	PlatformDetector,
	PlatformInfo,
	ProcessRunner,
	Prompter,
	ServiceContainer,
} from "./types";

describe("DevcliModule interface", () => {
	test("has required properties: name, description, register", () => {
		const mockProgram = {} as any;
		const mockServices = {} as ServiceContainer;

		const module: DevcliModule = {
			name: "test-module",
			description: "A test module",
			register: (program, services) => {
				expect(program).toBe(mockProgram);
				expect(services).toBe(mockServices);
			},
		};

		expect(module.name).toBe("test-module");
		expect(module.description).toBe("A test module");
		expect(typeof module.register).toBe("function");
	});

	test("register is called with program and services", () => {
		const mockProgram = { test: "program" } as any;
		const mockServices = { test: "services" } as unknown as ServiceContainer;
		let registerCalled = false;

		const module: DevcliModule = {
			name: "test",
			description: "test",
			register: (program, services) => {
				registerCalled = true;
				expect(program).toBe(mockProgram);
				expect(services).toBe(mockServices);
			},
		};

		module.register(mockProgram, mockServices);
		expect(registerCalled).toBe(true);
	});
});

describe("ServiceContainer interface", () => {
	test("has all required getter methods", () => {
		const mockProcessRunner = {} as ProcessRunner;
		const mockConfigLoader = {} as ConfigLoader;
		const mockPrompter = {} as Prompter;
		const mockFileSystem = {} as FileSystem;
		const mockPlatformDetector = {} as PlatformDetector;
		const mockFormatter = {} as Formatter;

		const services: ServiceContainer = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		expect(services.getProcessRunner()).toBe(mockProcessRunner);
		expect(services.getConfigLoader()).toBe(mockConfigLoader);
		expect(services.getPrompter()).toBe(mockPrompter);
		expect(services.getFileSystem()).toBe(mockFileSystem);
		expect(services.getPlatformDetector()).toBe(mockPlatformDetector);
		expect(services.getFormatter()).toBe(mockFormatter);
	});
});

describe("Platform type", () => {
	test("accepts valid platform values", () => {
		const platforms: Platform[] = ["windows", "wsl1", "wsl2", "macos", "linux"];

		for (const p of platforms) {
			const platformInfo: PlatformInfo = {
				platform: p,
				shell: "/bin/bash",
				packageManager: "brew",
				isWSL: p.startsWith("wsl"),
			};
			expect(platformInfo.platform).toBe(p);
		}
	});
});

describe("PlatformInfo interface", () => {
	test("has required properties", () => {
		const info: PlatformInfo = {
			platform: "macos",
			shell: "/bin/zsh",
			packageManager: "brew",
			isWSL: false,
		};

		expect(info.platform).toBe("macos");
		expect(info.shell).toBe("/bin/zsh");
		expect(info.packageManager).toBe("brew");
		expect(info.isWSL).toBe(false);
	});

	test("isWSL is true for wsl1 and wsl2", () => {
		const wsl1Info: PlatformInfo = {
			platform: "wsl1",
			shell: "/bin/bash",
			packageManager: "apt",
			isWSL: true,
		};
		const wsl2Info: PlatformInfo = {
			platform: "wsl2",
			shell: "/bin/bash",
			packageManager: "apt",
			isWSL: true,
		};

		expect(wsl1Info.isWSL).toBe(true);
		expect(wsl2Info.isWSL).toBe(true);
	});
});

describe("CheckResult interface", () => {
	test("has required properties", () => {
		const result: CheckResult = {
			toolName: "nvm",
			installed: true,
			configured: true,
		};

		expect(result.toolName).toBe("nvm");
		expect(result.installed).toBe(true);
		expect(result.configured).toBe(true);
		expect(result.version).toBeUndefined();
		expect(result.message).toBeUndefined();
	});

	test("optional version and message are present", () => {
		const result: CheckResult = {
			toolName: "nvm",
			installed: true,
			configured: false,
			version: "0.39.7",
			message: "No active Node version",
		};

		expect(result.version).toBe("0.39.7");
		expect(result.message).toBe("No active Node version");
	});

	test("installed can be false", () => {
		const result: CheckResult = {
			toolName: "azure-cli",
			installed: false,
			configured: false,
		};

		expect(result.installed).toBe(false);
		expect(result.configured).toBe(false);
	});
});

describe("InstallResult interface", () => {
	test("has required properties", () => {
		const result: InstallResult = {
			toolName: "nvm",
			success: true,
			message: "Installed successfully",
		};

		expect(result.toolName).toBe("nvm");
		expect(result.success).toBe(true);
		expect(result.message).toBe("Installed successfully");
	});

	test("success can be false", () => {
		const result: InstallResult = {
			toolName: "copilot",
			success: false,
			message: "Installation failed: network error",
		};

		expect(result.success).toBe(false);
		expect(result.message).toBe("Installation failed: network error");
	});
});

describe("Type compatibility", () => {
	test("DevcliModule register accepts Command type", () => {
		const mockCommand = {
			name: (n: string) => mockCommand,
			description: (d: string) => mockCommand,
		} as any;

		const module: DevcliModule = {
			name: "test",
			description: "test",
			register: (program, _services) => {
				expect(program).toBeDefined();
				expect(typeof program.name).toBe("function");
			},
		};

		module.register(mockCommand, {} as ServiceContainer);
	});
});
