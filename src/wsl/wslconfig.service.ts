import type { FileSystem, ProcessRunner, Prompter } from "@/kernel/types";
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
		try {
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

		try {
			const content = await this.fileSystem.readFile(wslconfigPath);
			const current = this.parseWslConfig(content);
			return { suggested, current, hostResources };
		} catch {
			return { suggested, hostResources };
		}
	}

	async getWindowsHomePath(): Promise<string> {
		const username = process.env.WSL_USER || process.env.USER || "unknown";

		try {
			const result = await this.runner.run("cmd.exe", [
				"/c",
				"echo %USERPROFILE%",
			]);

			if (result.exitCode === 0) {
				const windowsPath = result.stdout.trim();
				return windowsPath
					.replace(/\\+/g, "/")
					.replace(
						/^([A-Z]):/,
						(_match, letter) => `/mnt/${letter.toLowerCase()}`,
					);
			}
		} catch {
			// Fall back to constructing path
		}

		return `/mnt/c/Users/${username}`;
	}

	async createConfig(config: WslConfig): Promise<void> {
		const windowsHome = await this.getWindowsHomePath();
		const wslconfigPath = `${windowsHome}/.wslconfig`;

		const content = `[wsl2]
processors=${config.processors}
memory=${config.memoryGB}GB
`;

		await this.fileSystem.writeFile(wslconfigPath, content);
	}

	private parseWslConfig(content: string): WslConfig {
		const processorsMatch = content.match(/processors\s*=\s*(\d+)/i);
		const memoryMatch = content.match(/memory\s*=\s*(\d+)\s*(GB|MB)?/i);

		return {
			processors:
				processorsMatch && processorsMatch[1]
					? parseInt(processorsMatch[1], 10)
					: 0,
			memoryGB:
				memoryMatch && memoryMatch[1] ? parseInt(memoryMatch[1], 10) : 0,
		};
	}
}
