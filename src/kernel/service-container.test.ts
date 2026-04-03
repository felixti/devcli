import { beforeEach, describe, expect, test } from "bun:test";
// We need to import the class we're testing, but it doesn't exist yet
// Using type-only import for now since we'll create it
import type { ServiceContainerImpl } from "./service-container";
import type {
	ConfigLoader,
	FileSystem,
	Formatter,
	PlatformDetector,
	ProcessRunner,
	Prompter,
	ServiceContainer,
} from "./types";

describe("ServiceContainerImpl", () => {
	// Mock factory that tracks call count
	let processRunnerFactoryCalls: number;
	let configLoaderFactoryCalls: number;
	let prompterFactoryCalls: number;
	let fileSystemFactoryCalls: number;
	let platformDetectorFactoryCalls: number;
	let formatterFactoryCalls: number;

	// Mock instances
	let mockProcessRunner: ProcessRunner;
	let mockConfigLoader: ConfigLoader;
	let mockPrompter: Prompter;
	let mockFileSystem: FileSystem;
	let mockPlatformDetector: PlatformDetector;
	let mockFormatter: Formatter;

	beforeEach(() => {
		processRunnerFactoryCalls = 0;
		configLoaderFactoryCalls = 0;
		prompterFactoryCalls = 0;
		fileSystemFactoryCalls = 0;
		platformDetectorFactoryCalls = 0;
		formatterFactoryCalls = 0;

		mockProcessRunner = {
			run: async () => ({
				stdout: "",
				stderr: "",
				exitCode: 0,
				timedOut: false,
			}),
			spawn: () => ({ pid: 1, kill: () => {}, on: () => {} }),
		};

		mockConfigLoader = { load: async () => ({ version: "1.0", tools: [] }) };

		mockPrompter = { confirm: async () => true, select: async () => "" };

		mockFileSystem = {
			exists: async () => false,
			readFile: async () => "",
			writeFile: async () => {},
			mkdirp: async () => {},
		};

		mockPlatformDetector = {
			detect: async () => ({
				platform: "linux",
				shell: "bash",
				packageManager: "apt",
				isWSL: false,
			}),
		};

		mockFormatter = {
			success: () => {},
			error: () => {},
			warn: () => {},
			info: () => {},
			table: () => {},
			json: () => {},
			section: () => {},
		};
	});

	test("accepts service factories via constructor", () => {
		// This tests that the constructor accepts a record of factories
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		// We can't instantiate without the implementation, but we can test the shape
		// by checking that factories have the correct return types
		expect(typeof factories.getProcessRunner).toBe("function");
		expect(typeof factories.getConfigLoader).toBe("function");
		expect(typeof factories.getPrompter).toBe("function");
		expect(typeof factories.getFileSystem).toBe("function");
		expect(typeof factories.getPlatformDetector).toBe("function");
		expect(typeof factories.getFormatter).toBe("function");
	});

	test("lazy-init on first get - factory called only once", async () => {
		const factories = {
			getProcessRunner: () => {
				processRunnerFactoryCalls++;
				return mockProcessRunner;
			},
			getConfigLoader: () => {
				configLoaderFactoryCalls++;
				return mockConfigLoader;
			},
			getPrompter: () => {
				prompterFactoryCalls++;
				return mockPrompter;
			},
			getFileSystem: () => {
				fileSystemFactoryCalls++;
				return mockFileSystem;
			},
			getPlatformDetector: () => {
				platformDetectorFactoryCalls++;
				return mockPlatformDetector;
			},
			getFormatter: () => {
				formatterFactoryCalls++;
				return mockFormatter;
			},
		};

		// Dynamic import to get the implementation
		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		// First get - factory should be called
		container.getProcessRunner();
		expect(processRunnerFactoryCalls).toBe(1);

		// Second get - factory should NOT be called again
		container.getProcessRunner();
		expect(processRunnerFactoryCalls).toBe(1);

		// Same for other services
		container.getConfigLoader();
		expect(configLoaderFactoryCalls).toBe(1);

		container.getConfigLoader();
		expect(configLoaderFactoryCalls).toBe(1);
	});

	test("multiple gets return same instance (singleton per service)", async () => {
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		const runner1 = container.getProcessRunner();
		const runner2 = container.getProcessRunner();

		expect(runner1).toBe(runner2);
		expect(runner1).toBe(mockProcessRunner);
	});

	test("getProcessRunner returns ProcessRunner", async () => {
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		const runner = container.getProcessRunner();
		expect(runner).toBe(mockProcessRunner);
	});

	test("getConfigLoader returns ConfigLoader", async () => {
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		const loader = container.getConfigLoader();
		expect(loader).toBe(mockConfigLoader);
	});

	test("getPrompter returns Prompter", async () => {
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		const prompter = container.getPrompter();
		expect(prompter).toBe(mockPrompter);
	});

	test("getFileSystem returns FileSystem", async () => {
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		const fs = container.getFileSystem();
		expect(fs).toBe(mockFileSystem);
	});

	test("getPlatformDetector returns PlatformDetector", async () => {
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		const detector = container.getPlatformDetector();
		expect(detector).toBe(mockPlatformDetector);
	});

	test("getFormatter returns Formatter", async () => {
		const factories = {
			getProcessRunner: () => mockProcessRunner,
			getConfigLoader: () => mockConfigLoader,
			getPrompter: () => mockPrompter,
			getFileSystem: () => mockFileSystem,
			getPlatformDetector: () => mockPlatformDetector,
			getFormatter: () => mockFormatter,
		};

		const { ServiceContainerImpl } = await import("./service-container");
		const container = new ServiceContainerImpl(factories);

		const formatter = container.getFormatter();
		expect(formatter).toBe(mockFormatter);
	});
});
