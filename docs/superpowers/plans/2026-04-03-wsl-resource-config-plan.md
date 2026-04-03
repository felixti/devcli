# WSL Resource Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WSL `.wslconfig` check and interactive configuration suggestion when running on WSL2.

**Architecture:** Platform-level service that detects Windows host resources via `powershell.exe`, calculates recommended CPU/memory limits using linear formula (CPU/2, RAM/4), and suggests `.wslconfig` creation with user override capability.

**Tech Stack:** Bun + TypeScript, existing DI container, ProcessRunner/FileSystem/Prompter services

---

## File Structure

```
src/
├── wsl/
│   ├── wslconfig.types.ts       # Interfaces: HostResources, WslConfig, WslConfigRecommendation
│   ├── wslconfig.service.ts     # Main service: getHostResources(), calculateRecommendation(), check(), createConfig()
│   ├── wslconfig.service.test.ts
│   └── index.ts                 # Re-export WslConfigService
└── kernel/
    ├── types.ts                 # Add WslConfigService to ServiceContainer interface
    └── service-container.ts     # Add getWslConfigService() factory method
```

---

## Task 1: Create WSL Types

**Files:**
- Create: `src/wsl/wslconfig.types.ts`

- [ ] **Step 1: Create `src/wsl/wslconfig.types.ts`**

```typescript
/**
 * Represents the host machine's hardware resources.
 */
export interface HostResources {
	cpuCores: number;
	memoryGB: number;
}

/**
 * WSL2 configuration settings for .wslconfig file.
 */
export interface WslConfig {
	processors: number;
	memoryGB: number;
}

/**
 * Result of checking WSL configuration status.
 */
export interface WslConfigRecommendation {
	/** The suggested WSL configuration based on host resources */
	suggested: WslConfig;
	/** Current configuration if .wslconfig exists */
	current?: WslConfig;
	/** Detected host machine resources */
	hostResources: HostResources;
}

/**
 * Service for detecting host resources and managing WSL configuration.
 */
export interface WslConfigService {
	/**
	 * Detect Windows host CPU cores and memory via powershell.exe.
	 * Returns null if running outside WSL2 or detection fails.
	 */
	getHostResources(): Promise<HostResources | null>;

	/**
	 * Calculate recommended WSL config based on host resources.
	 * Uses linear formula: CPU/2 (round to even), RAM/4 (round down).
	 */
	calculateRecommendation(resources: HostResources): WslConfig;

	/**
	 * Check if .wslconfig exists in Windows user home and compare with recommendation.
	 * Returns null if not on WSL2 or check fails.
	 */
	check(): Promise<WslConfigRecommendation | null>;

	/**
	 * Get the Windows user home path from WSL.
	 * Returns something like /mnt/c/Users/username
	 */
	getWindowsHomePath(): Promise<string>;

	/**
	 * Create .wslconfig file with given configuration.
	 */
	createConfig(config: WslConfig): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/wsl/wslconfig.types.ts
git commit -m "feat(wsl): add WSL config types"
```

---

## Task 2: Create WSL Config Service Implementation

**Files:**
- Create: `src/wsl/wslconfig.service.ts`
- Create: `src/wsl/wslconfig.service.test.ts`

- [ ] **Step 1: Write failing test for resource calculation**

```typescript
// src/wsl/wslconfig.service.test.ts
import { describe, it, expect } from "bun:test";
import { WslConfigServiceImpl } from "./wslconfig.service";

describe("WslConfigServiceImpl", () => {
	describe("calculateRecommendation", () => {
		it("should calculate 6 cores and 4GB for 12 cores / 16GB host", () => {
			const service = new WslConfigServiceImpl({
				run: async () => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false }),
				spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
			} as any, {} as any, {} as any);

			const result = service.calculateRecommendation({ cpuCores: 12, memoryGB: 16 });
			expect(result.processors).toBe(6);
			expect(result.memoryGB).toBe(4);
		});

		it("should calculate 12 cores and 8GB for 24 cores / 32GB host", () => {
			const service = new WslConfigServiceImpl({
				run: async () => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false }),
				spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
			} as any, {} as any, {} as any);

			const result = service.calculateRecommendation({ cpuCores: 24, memoryGB: 32 });
			expect(result.processors).toBe(12);
			expect(result.memoryGB).toBe(8);
		});

		it("should round down to even number for CPU", () => {
			const service = new WslConfigServiceImpl({
				run: async () => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false }),
				spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
			} as any, {} as any, {} as any);

			const result = service.calculateRecommendation({ cpuCores: 10, memoryGB: 16 });
			expect(result.processors).toBe(4); // 10/2 = 5, rounded down to even = 4
			expect(result.memoryGB).toBe(4);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: FAIL with "WslConfigServiceImpl not defined"

- [ ] **Step 3: Write minimal service with calculation logic**

```typescript
// src/wsl/wslconfig.service.ts
import type { ProcessRunner, FileSystem, Prompter } from "@/kernel/types";
import type {
	HostResources,
	WslConfig,
	WslConfigRecommendation,
	WslConfigService,
} from "./wslconfig.types";

export class WslConfigServiceImpl implements WslConfigService {
	constructor(
		private readonly runner: ProcessRunner,
		private readonly fileSystem: FileSystem,
		_prompter: Prompter,
	) {}

	calculateRecommendation(resources: HostResources): WslConfig {
		const cpu = Math.floor(resources.cpuCores / 2);
		const evenCpu = cpu % 2 === 0 ? cpu : cpu - 1;
		const memory = Math.floor(resources.memoryGB / 4);

		return {
			processors: evenCpu < 2 ? 2 : evenCpu,
			memoryGB: memory < 1 ? 1 : memory,
		};
	}

	async getHostResources(): Promise<HostResources | null> {
		return null; // TODO: implement
	}

	async check(): Promise<WslConfigRecommendation | null> {
		return null; // TODO: implement
	}

	async getWindowsHomePath(): Promise<string> {
		return ""; // TODO: implement
	}

	async createConfig(config: WslConfig): Promise<void> {
		// TODO: implement
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: PASS

- [ ] **Step 5: Write test for getWindowsHomePath**

```typescript
it("should return /mnt/c/Users/<username> path", async () => {
	const mockRunner = {
		run: async (cmd: string) => {
			if (cmd === "cmd.exe") {
				return { stdout: "C:\\Users\\testuser\n", stderr: "", exitCode: 0, timedOut: false };
			}
			return { stdout: "", stderr: "", exitCode: 0, timedOut: false };
		},
		spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
	} as any;

	const service = new WslConfigServiceImpl(mockRunner, {} as any, {} as any);
	const path = await service.getWindowsHomePath();
	expect(path).toBe("/mnt/c/Users/testuser");
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: FAIL

- [ ] **Step 7: Implement getWindowsHomePath**

```typescript
async getWindowsHomePath(): Promise<string> {
	// Get Windows username from environment
	const username = process.env.WSL_USER || process.env.USER || "unknown";

	// Try to get actual Windows path via cmd.exe
	try {
		const result = await this.runner.run("cmd.exe", [
			"/c",
			"echo %USERPROFILE%",
		]);

		if (result.exitCode === 0) {
			const windowsPath = result.stdout.trim();
			// Convert C:\Users\username to /mnt/c/Users/username
			return windowsPath.replace(/\\+/g, "/").replace(/^([A-Z]):/, (match, letter) => `/mnt/${letter.toLowerCase()}`);
		}
	} catch {
		// Fall back to constructing path
	}

	return `/mnt/c/Users/${username}`;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: PASS

- [ ] **Step 9: Write test for getHostResources**

```typescript
it("should detect host resources via powershell", async () => {
	const mockRunner = {
		run: async (cmd: string, args: string[]) => {
			if (args?.some((a) => a.includes("NumberOfCores"))) {
				return { stdout: "12\n", stderr: "", exitCode: 0, timedOut: false };
			}
			if (args?.some((a) => a.includes("TotalPhysicalMemory"))) {
				return { stdout: "17179869184\n", stderr: "", exitCode: 0, timedOut: false }; // 16GB in bytes
			}
			return { stdout: "", stderr: "", exitCode: 0, timedOut: false };
		},
		spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
	} as any;

	const service = new WslConfigServiceImpl(mockRunner, {} as any, {} as any);
	const resources = await service.getHostResources();

	expect(resources?.cpuCores).toBe(12);
	expect(resources?.memoryGB).toBe(16);
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: FAIL

- [ ] **Step 11: Implement getHostResources**

```typescript
async getHostResources(): Promise<HostResources | null> {
	try {
		// Get CPU cores
		const cpuResult = await this.runner.run("powershell.exe", [
			"-NoProfile",
			"-Command",
			"(Get-CimInstance Win32_Processor).NumberOfCores",
		]);

		if (cpuResult.exitCode !== 0) {
			return null;
		}

		const cpuCores = parseInt(cpuResult.stdout.trim(), 10);
		if (isNaN(cpuCores)) {
			return null;
		}

		// Get total memory in bytes
		const memResult = await this.runner.run("powershell.exe", [
			"-NoProfile",
			"-Command",
			"(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
		]);

		if (memResult.exitCode !== 0) {
			return null;
		}

		const memoryBytes = parseInt(memResult.stdout.trim(), 10);
		const memoryGB = Math.round(memoryBytes / (1024 * 1024 * 1024));

		return { cpuCores, memoryGB };
	} catch {
		return null;
	}
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: PASS

- [ ] **Step 13: Write test for check() method**

```typescript
it("should return recommendation when .wslconfig does not exist", async () => {
	const mockRunner = {
		run: async (cmd: string, args: string[]) => {
			if (args?.some((a) => a.includes("NumberOfCores"))) {
				return { stdout: "12\n", stderr: "", exitCode: 0, timedOut: false };
			}
			if (args?.some((a) => a.includes("TotalPhysicalMemory"))) {
				return { stdout: "17179869184\n", stderr: "", exitCode: 0, timedOut: false };
			}
			return { stdout: "", stderr: "", exitCode: 0, timedOut: false };
		},
		spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
	} as any;

	const mockFileSystem = {
		exists: async (path: string) => false,
		readFile: async () => "",
		writeFile: async () => {},
		mkdirp: async () => {},
	} as any;

	const service = new WslConfigServiceImpl(mockRunner, mockFileSystem, {} as any);
	const result = await service.check();

	expect(result).not.toBeNull();
	expect(result!.suggested.processors).toBe(6);
	expect(result!.suggested.memoryGB).toBe(4);
	expect(result!.current).toBeUndefined();
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: FAIL

- [ ] **Step 15: Implement check() method**

```typescript
async check(): Promise<WslConfigRecommendation | null> {
	const hostResources = await this.getHostResources();
	if (!hostResources) {
		return null;
	}

	const suggested = this.calculateRecommendation(hostResources);
	const windowsHome = await this.getWindowsHomePath();
	const wslconfigPath = `${windowsHome}/.wslconfig`;

	const exists = await this.fileSystem.exists(wslconfigPath);
	if (!exists) {
		return { suggested, hostResources };
	}

	// Parse existing config
	try {
		const content = await this.fileSystem.readFile(wslconfigPath);
		const current = this.parseWslConfig(content);
		return { suggested, current, hostResources };
	} catch {
		return { suggested, hostResources };
	}
}

private parseWslConfig(content: string): WslConfig {
	const processorsMatch = content.match(/processors\s*=\s*(\d+)/i);
	const memoryMatch = content.match(/memory\s*=\s*(\d+)\s*(GB|MB)?/i);

	return {
		processors: processorsMatch ? parseInt(processorsMatch[1], 10) : 0,
		memoryGB: memoryMatch ? parseInt(memoryMatch[1], 10) : 0,
	};
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: PASS

- [ ] **Step 17: Write test for createConfig()**

```typescript
it("should create .wslconfig with correct content", async () => {
	let writtenContent = "";
	const mockRunner = {
		run: async () => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false }),
		spawn: () => ({ pid: 0, kill: () => {}, on: () => {} }),
	} as any;

	const mockFileSystem = {
		exists: async () => false,
		readFile: async () => "",
		writeFile: async (path: string, content: string) => {
			writtenContent = content;
		},
		mkdirp: async () => {},
	} as any;

	const service = new WslConfigServiceImpl(mockRunner, mockFileSystem, {} as any);

	await service.createConfig({ processors: 6, memoryGB: 4 });

	expect(writtenContent).toContain("[wsl2]");
	expect(writtenContent).toContain("processors=6");
	expect(writtenContent).toContain("memory=4GB");
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: FAIL

- [ ] **Step 19: Implement createConfig()**

```typescript
async createConfig(config: WslConfig): Promise<void> {
	const windowsHome = await this.getWindowsHomePath();
	const wslconfigPath = `${windowsHome}/.wslconfig`;

	const content = `[wsl2]
processors=${config.processors}
memory=${config.memoryGB}GB
`;

	await this.fileSystem.writeFile(wslconfigPath, content);
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `bun test src/wsl/wslconfig.service.test.ts`
Expected: PASS

- [ ] **Step 21: Create index.ts re-export**

```typescript
// src/wsl/index.ts
export type { HostResources, WslConfig, WslConfigRecommendation, WslConfigService } from "./wslconfig.types";
export { WslConfigServiceImpl } from "./wslconfig.service";
```

- [ ] **Step 22: Commit**

```bash
git add src/wsl/
git commit -m "feat(wsl): implement WSL config service for .wslconfig management"
```

---

## Task 3: Add WslConfigService to Kernel Types

**Files:**
- Modify: `src/kernel/types.ts`

- [ ] **Step 1: Add WslConfigService to ServiceContainer**

```typescript
// In types.ts, add to ServiceContainer interface:
export interface ServiceContainer {
	getProcessRunner(): ProcessRunner;
	getConfigLoader(): ConfigLoader;
	getPrompter(): Prompter;
	getFileSystem(): FileSystem;
	getPlatformDetector(): PlatformDetector;
	getFormatter(): Formatter;
	getWslConfigService(): WslConfigService;  // ADD THIS
}
```

Add new import:
```typescript
import type { WslConfigService } from "../wsl/wslconfig.types";
```

- [ ] **Step 2: Commit**

```bash
git add src/kernel/types.ts
git commit -m "feat(kernel): add WslConfigService to ServiceContainer"
```

---

## Task 4: Add WslConfigService to ServiceContainerImpl

**Files:**
- Modify: `src/kernel/service-container.ts`

- [ ] **Step 1: Add factory and instance for WslConfigService**

```typescript
// Add to type ServiceFactories in service-container.ts:
type ServiceFactories = {
	getProcessRunner: () => ProcessRunner;
	getConfigLoader: () => ConfigLoader;
	getPrompter: () => Prompter;
	getFileSystem: () => FileSystem;
	getPlatformDetector: () => PlatformDetector;
	getFormatter: () => Formatter;
	getWslConfigService: () => WslConfigService;  // ADD THIS
};

// Add to instances object:
private instances: Partial<{
	processRunner: ProcessRunner;
	configLoader: ConfigLoader;
	prompter: Prompter;
	fileSystem: FileSystem;
	platformDetector: PlatformDetector;
	formatter: Formatter;
	wslConfigService: WslConfigService;  // ADD THIS
}> = {};

// Add getter method:
getWslConfigService(): WslConfigService {
	if (!this.instances.wslConfigService) {
		this.instances.wslConfigService = this.factories.getWslConfigService();
	}
	return this.instances.wslConfigService;
}
```

Add import at top:
```typescript
import type { WslConfigService } from "../wsl/wslconfig.types";
```

- [ ] **Step 2: Commit**

```bash
git add src/kernel/service-container.ts
git commit -m "feat(kernel): implement getWslConfigService in container"
```

---

## Task 5: Integrate WSL Config Check into Doctor Command

**Files:**
- Modify: `src/modules/setup/commands/doctor.ts`

- [ ] **Step 1: Modify doctor.ts to call WslConfigService on WSL2**

Add new import:
```typescript
import type { WslConfigService, WslConfigRecommendation } from "@/wsl/wslconfig.types";
```

Modify the `execute` method, after getting `platformInfo`:

```typescript
// After platform detection and before tools check, add:
if (platformInfo.isWSL) {
	const wslService = this.services.getWslConfigService();
	const wslCheck = await wslService.check();

	if (wslCheck) {
		formatter.section("WSL Resource Configuration");
		await this.displayWslConfigRecommendation(wslCheck, prompter, wslService, formatter);
	}
}
```

Add new method to DoctorCommand class:

```typescript
private async displayWslConfigRecommendation(
	recommendation: WslConfigRecommendation,
	prompter: ReturnType<ServiceContainer["getPrompter"]>,
	wslService: WslConfigService,
	formatter: ReturnType<ServiceContainer["getFormatter"]>,
): Promise<void> {
	const { suggested, current, hostResources } = recommendation;

	formatter.info(`Host: ${hostResources.cpuCores} CPU cores, ${hostResources.memoryGB} GB RAM`);

	if (current) {
		formatter.warn(`Current .wslconfig: ${current.processors} CPUs, ${current.memoryGB} GB RAM`);
		formatter.warn(`Suggested: ${suggested.processors} CPUs, ${suggested.memoryGB} GB RAM`);

		if (current.processors === suggested.processors && current.memoryGB === suggested.memoryGB) {
			formatter.success("WSL config matches recommendation");
			return;
		}

		const apply = await prompter.confirm("Update .wslconfig to recommended values?");
		if (!apply) {
			formatter.info("WSL config update skipped");
			return;
		}
	} else {
		formatter.warn(`.wslconfig not found`);
		formatter.info(`Recommended: ${suggested.processors} CPUs, ${suggested.memoryGB} GB RAM`);

		const create = await prompter.confirm("Create .wslconfig with recommended values?");
		if (!create) {
			formatter.info("WSL config creation skipped");
			return;
		}
	}

	try {
		await wslService.createConfig(suggested);
		formatter.success(`.wslconfig created with ${suggested.processors} CPUs, ${suggested.memoryGB} GB RAM`);
	} catch (error) {
		formatter.error(`Failed to create .wslconfig: ${error}`);
	}
}
```

- [ ] **Step 2: Run type check**

Run: `bun run --bun tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/setup/commands/doctor.ts
git commit -m "feat(doctor): integrate WSL config check on WSL2 platforms"
```

---

## Task 6: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `bun run --bun tsc --noEmit`
Expected: No errors

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create WSL types | `src/wsl/wslconfig.types.ts` |
| 2 | Implement WSL config service | `src/wsl/wslconfig.service.ts`, `src/wsl/wslconfig.service.test.ts`, `src/wsl/index.ts` |
| 3 | Add to kernel types | `src/kernel/types.ts` |
| 4 | Add to service container | `src/kernel/service-container.ts` |
| 5 | Integrate into doctor command | `src/modules/setup/commands/doctor.ts` |
| 6 | Run full test suite | - |

---

## Exit Criteria

- [ ] All tests pass (`bun test`)
- [ ] TypeScript compilation succeeds (`bun run --bun tsc --noEmit`)
- [ ] WSL config service can detect host resources via powershell.exe
- [ ] `.wslconfig` content generation follows specified format
- [ ] Doctor command shows WSL config recommendation when on WSL2
- [ ] User can create or update `.wslconfig` interactively
