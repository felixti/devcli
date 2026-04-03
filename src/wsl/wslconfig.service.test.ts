import { describe, expect, it } from "bun:test";
import { WslConfigServiceImpl } from "./wslconfig.service";

function createMockRunner() {
	return {
		run: async () => ({
			stdout: "",
			stderr: "",
			exitCode: 0,
			timedOut: false,
		}),
		spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
	} as any;
}

describe("WslConfigServiceImpl", () => {
	describe("calculateRecommendation", () => {
		it("should calculate 6 cores and 4GB for 12 cores / 16GB host", () => {
			const service = new WslConfigServiceImpl(createMockRunner(), {} as any);

			const result = service.calculateRecommendation({
				cpuCores: 12,
				memoryGB: 16,
			});
			expect(result.processors).toBe(6);
			expect(result.memoryGB).toBe(4);
		});

		it("should calculate 12 cores and 8GB for 24 cores / 32GB host", () => {
			const service = new WslConfigServiceImpl(createMockRunner(), {} as any);

			const result = service.calculateRecommendation({
				cpuCores: 24,
				memoryGB: 32,
			});
			expect(result.processors).toBe(12);
			expect(result.memoryGB).toBe(8);
		});

		it("should round down to even number for CPU", () => {
			const service = new WslConfigServiceImpl(createMockRunner(), {} as any);

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
				run: async (cmd: string, args?: string[]) => {
					if (
						cmd === "cmd.exe" &&
						args?.includes("/c") &&
						args?.includes("echo %USERPROFILE%")
					) {
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

			const service = new WslConfigServiceImpl(mockRunner, {} as any);
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

			const service = new WslConfigServiceImpl(mockRunner, {} as any);
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

			const service = new WslConfigServiceImpl(mockRunner, mockFileSystem);
			const result = await service.check();

			expect(result).not.toBeNull();
			expect(result!.suggested.processors).toBe(6);
			expect(result!.suggested.memoryGB).toBe(4);
			expect(result!.current).toBeUndefined();
		});

		it("should parse existing config with both values set", async () => {
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
				exists: async () => true,
				readFile: async () => "[wsl2]\nprocessors=4\nmemory=8GB\n",
				writeFile: async () => {},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(mockRunner, mockFileSystem);
			const result = await service.check();

			expect(result).not.toBeNull();
			expect(result!.current?.processors).toBe(4);
			expect(result!.current?.memoryGB).toBe(8);
		});

		it("should parse existing config with only processors set", async () => {
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
				exists: async () => true,
				readFile: async () => "[wsl2]\nprocessors=4\n",
				writeFile: async () => {},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(mockRunner, mockFileSystem);
			const result = await service.check();

			expect(result).not.toBeNull();
			expect(result!.current?.processors).toBe(4);
			expect(result!.current?.memoryGB).toBeUndefined();
		});

		it("should parse existing config with only memory set", async () => {
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
				exists: async () => true,
				readFile: async () => "[wsl2]\nmemory=8GB\n",
				writeFile: async () => {},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(mockRunner, mockFileSystem);
			const result = await service.check();

			expect(result).not.toBeNull();
			expect(result!.current?.processors).toBeUndefined();
			expect(result!.current?.memoryGB).toBe(8);
		});
	});

	describe("createConfig", () => {
		it("should create .wslconfig with correct content when file does not exist", async () => {
			let writtenContent = "";
			const mockFileSystem = {
				exists: async () => false,
				readFile: async () => {
					throw new Error("File not found");
				},
				writeFile: async (_path: string, content: string) => {
					writtenContent = content;
				},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(
				createMockRunner(),
				mockFileSystem,
			);

			await service.createConfig({ processors: 6, memoryGB: 4 });

			expect(writtenContent).toContain("[wsl2]");
			expect(writtenContent).toContain("processors=6");
			expect(writtenContent).toContain("memory=4GB");
		});

		it("should update existing values while preserving other settings", async () => {
			let writtenContent = "";
			const existingContent = `[wsl2]
processors=2
memory=2GB
swap=2GB
localhostForwarding=true

[experimental]
sparseVhd=true
`;
			const mockFileSystem = {
				exists: async () => true,
				readFile: async () => existingContent,
				writeFile: async (_path: string, content: string) => {
					writtenContent = content;
				},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(
				createMockRunner(),
				mockFileSystem,
			);

			await service.createConfig({ processors: 6, memoryGB: 4 });

			expect(writtenContent).toContain("processors=6");
			expect(writtenContent).toContain("memory=4GB");
			expect(writtenContent).toContain("swap=2GB");
			expect(writtenContent).toContain("localhostForwarding=true");
			expect(writtenContent).toContain("[experimental]");
			expect(writtenContent).toContain("sparseVhd=true");
		});

		it("should add values to existing config without wsl2 section", async () => {
			let writtenContent = "";
			const existingContent = `# Some comment
swap=2GB
`;
			const mockFileSystem = {
				exists: async () => true,
				readFile: async () => existingContent,
				writeFile: async (_path: string, content: string) => {
					writtenContent = content;
				},
				mkdirp: async () => {},
			} as any;

			const service = new WslConfigServiceImpl(
				createMockRunner(),
				mockFileSystem,
			);

			await service.createConfig({ processors: 6, memoryGB: 4 });

			expect(writtenContent).toContain("[wsl2]");
			expect(writtenContent).toContain("processors=6");
			expect(writtenContent).toContain("memory=4GB");
			expect(writtenContent).toContain("swap=2GB");
		});
	});
});
