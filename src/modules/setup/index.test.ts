import { describe, expect, test } from "bun:test";
import type { Command } from "@commander-js/extra-typings";
import type { ServiceContainer } from "@/kernel/types";

describe("SetupModule", () => {
	test("setupModule is exported and has correct name", async () => {
		const { setupModule } = await import("./index");
		expect(setupModule.name).toBe("setup");
	});

	test("setupModule has correct description", async () => {
		const { setupModule } = await import("./index");
		expect(setupModule.description).toBe(
			"Developer environment setup and verification",
		);
	});

	test("setupModule implements DevcliModule interface", async () => {
		const { setupModule } = await import("./index");
		expect(typeof setupModule.register).toBe("function");
		expect(typeof setupModule.name).toBe("string");
		expect(typeof setupModule.description).toBe("string");
	});

	test("register adds setup command group with subcommands", async () => {
		const { setupModule } = await import("./index");

		const callLog: string[] = [];

		const mockProgram = {
			command: (name: string) => {
				callLog.push(`command(${name})`);
				return mockSubCommand;
			},
			description: (desc: string) => {
				callLog.push(`description(${desc})`);
				return mockProgram;
			},
			addCommand: (cmd: Command) => {
				callLog.push(`addCommand(${cmd.name()})`);
				return mockProgram;
			},
			option: () => mockProgram,
			action: () => mockProgram,
			argument: () => mockProgram,
			name: () => "mock",
		} as unknown as Command;

		const mockSubCommand = {
			command: (name: string) => {
				callLog.push(`subCommand(${name})`);
				return mockSubCommand;
			},
			description: (desc: string) => {
				callLog.push(`subDesc(${desc})`);
				return mockSubCommand;
			},
			addCommand: () => {
				callLog.push("subAddCommand");
				return mockSubCommand;
			},
			option: () => mockSubCommand,
			action: () => mockSubCommand,
			argument: () => mockSubCommand,
			name: () => "mock-sub",
		} as unknown as Command;

		const mockServices = {
			getProcessRunner: () => ({}),
			getConfigLoader: () => ({
				load: async () => ({ version: "1.0.0", tools: [] }),
			}),
			getPrompter: () => ({}),
			getFileSystem: () => ({}),
			getPlatformDetector: () => ({}),
			getFormatter: () => ({}),
		} as unknown as ServiceContainer;

		setupModule.register(mockProgram, mockServices);

		expect(callLog).toContain("command(setup)");
		expect(callLog).toContain(
			"subDesc(Developer environment setup and verification)",
		);
		expect(callLog).toContain("subCommand(doctor)");
		expect(callLog).toContain("subCommand(install)");
	});

	test("register does not throw with valid arguments", async () => {
		const { setupModule } = await import("./index");

		const mockProgram = {
			command: () => mockProgram,
			description: () => mockProgram,
			addCommand: () => mockProgram,
			option: () => mockProgram,
			action: () => mockProgram,
			argument: () => mockProgram,
		} as unknown as Command;

		const mockServices = {
			getProcessRunner: () => ({}),
			getConfigLoader: () => ({
				load: async () => ({ version: "1.0.0", tools: [] }),
			}),
			getPrompter: () => ({}),
			getFileSystem: () => ({}),
			getPlatformDetector: () => ({}),
			getFormatter: () => ({}),
		} as unknown as ServiceContainer;

		expect(() => setupModule.register(mockProgram, mockServices)).not.toThrow();
	});
});
