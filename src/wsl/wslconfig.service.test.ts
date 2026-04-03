import { describe, expect, it } from "bun:test";
import { WslConfigServiceImpl } from "./wslconfig.service";

describe("WslConfigServiceImpl", () => {
	describe("calculateRecommendation", () => {
		it("should calculate 6 cores and 4GB for 12 cores / 16GB host", () => {
			const service = new WslConfigServiceImpl(
				{
					run: async () => ({
						stdout: "",
						stderr: "",
						exitCode: 0,
						timedOut: false,
					}),
					spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
				} as any,
				{} as any,
				{} as any,
			);

			const result = service.calculateRecommendation({
				cpuCores: 12,
				memoryGB: 16,
			});
			expect(result.processors).toBe(6);
			expect(result.memoryGB).toBe(4);
		});

		it("should calculate 12 cores and 8GB for 24 cores / 32GB host", () => {
			const service = new WslConfigServiceImpl(
				{
					run: async () => ({
						stdout: "",
						stderr: "",
						exitCode: 0,
						timedOut: false,
					}),
					spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
				} as any,
				{} as any,
				{} as any,
			);

			const result = service.calculateRecommendation({
				cpuCores: 24,
				memoryGB: 32,
			});
			expect(result.processors).toBe(12);
			expect(result.memoryGB).toBe(8);
		});

		it("should round down to even number for CPU", () => {
			const service = new WslConfigServiceImpl(
				{
					run: async () => ({
						stdout: "",
						stderr: "",
						exitCode: 0,
						timedOut: false,
					}),
					spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
				} as any,
				{} as any,
				{} as any,
			);

			const result = service.calculateRecommendation({
				cpuCores: 10,
				memoryGB: 16,
			});
			expect(result.processors).toBe(4);
			expect(result.memoryGB).toBe(4);
		});
	});

	describe("getWindowsHomePath", () => {
		it("should return /mnt/c/Users/<username> path", async () => {
			const mockRunner = {
				run: async (cmd: string) => {
					if (cmd === "cmd.exe") {
						return {
							stdout: "C:\\Users\\testuser\n",
							stderr: "",
							exitCode: 0,
							timedOut: false,
						};
					}
					return { stdout: "", stderr: "", exitCode: 0, timedOut: false };
				},
				spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
			} as any;

			const service = new WslConfigServiceImpl(
				mockRunner,
				{} as any,
				{} as any,
			);
			const path = await service.getWindowsHomePath();
			expect(path).toBe("/mnt/c/Users/testuser");
		});
	});

	describe("getHostResources", () => {
		it("should detect host resources via powershell", async () => {
			const mockRunner = {
				run: async (_cmd: string, args?: string[]) => {
					if (args?.some((a) => a.includes("NumberOfCores"))) {
						return { stdout: "12\n", stderr: "", exitCode: 0, timedOut: false };
					}
					if (args?.some((a) => a.includes("TotalPhysicalMemory"))) {
						return {
							stdout: "17179869184\n",
							stderr: "",
							exitCode: 0,
							timedOut: false,
						};
					}
					return { stdout: "", stderr: "", exitCode: 0, timedOut: false };
				},
				spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
			} as any;

			const service = new WslConfigServiceImpl(
				mockRunner,
				{} as any,
				{} as any,
			);
			const resources = await service.getHostResources();

			expect(resources?.cpuCores).toBe(12);
			expect(resources?.memoryGB).toBe(16);
		});
	});

	describe("check", () => {
		it("should return recommendation when .wslconfig does not exist", async () => {
			const mockRunner = {
				run: async (_cmd: string, args?: string[]) => {
					if (args?.some((a) => a.includes("NumberOfCores"))) {
						return { stdout: "12\n", stderr: "", exitCode: 0, timedOut: false };
					}
					if (args?.some((a) => a.includes("TotalPhysicalMemory"))) {
						return {
							stdout: "17179869184\n",
							stderr: "",
							exitCode: 0,
							timedOut: false,
						};
					}
					return { stdout: "", stderr: "", exitCode: 0, timedOut: false };
				},
				spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
			} as any;

			const mockFileSystem = {
				exists: async () => false,
				readFile: async () => "",
				writeFile: async () => {},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(
				mockRunner,
				mockFileSystem,
				{} as any,
			);
			const result = await service.check();

			expect(result).not.toBeNull();
			expect(result!.suggested.processors).toBe(6);
			expect(result!.suggested.memoryGB).toBe(4);
			expect(result!.current).toBeUndefined();
		});
	});

	describe("createConfig", () => {
		it("should create .wslconfig with correct content", async () => {
			let writtenContent = "";
			const mockRunner = {
				run: async () => ({
					stdout: "",
					stderr: "",
					exitCode: 0,
					timedOut: false,
				}),
				spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
			} as any;

			const mockFileSystem = {
				exists: async () => false,
				readFile: async () => "",
				writeFile: async (_path: string, content: string) => {
					writtenContent = content;
				},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(
				mockRunner,
				mockFileSystem,
				{} as any,
			);

			await service.createConfig({ processors: 6, memoryGB: 4 });

			expect(writtenContent).toContain("[wsl2]");
			expect(writtenContent).toContain("processors=6");
			expect(writtenContent).toContain("memory=4GB");
		});
	});
});
