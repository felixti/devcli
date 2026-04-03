import type {
	CheckResult,
	PlatformInfo,
	RemoteConfig,
	ServiceContainer,
} from "@/kernel/types";
import type { ToolModule, ToolRegistry } from "@/modules/setup/tools/registry";
import type {
	WslConfigRecommendation,
	WslConfigService,
} from "@/wsl/wslconfig.types";

export interface DoctorOptions {
	json?: boolean;
	yes?: boolean;
	tool?: string;
}

export class DoctorCommand {
	private registry: ToolRegistry;
	private services: ServiceContainer;

	constructor(registry: ToolRegistry, services: ServiceContainer) {
		this.registry = registry;
		this.services = services;
	}

	async execute(options: DoctorOptions): Promise<number> {
		const runner = this.services.getProcessRunner();
		const formatter = this.services.getFormatter();
		const prompter = this.services.getPrompter();
		const fileSystem = this.services.getFileSystem();

		let platformInfo: PlatformInfo;
		try {
			const detector = this.services.getPlatformDetector();
			platformInfo = await detector.detect();
		} catch {
			formatter.error("Failed to detect platform");
			return 1;
		}

		let _config: RemoteConfig;
		try {
			const configLoader = this.services.getConfigLoader();
			_config = await configLoader.load();
		} catch {
			_config = { version: "1.0.0", tools: [] };
		}

		if (platformInfo.isWSL) {
			const wslService = this.services.getWslConfigService();
			const wslCheck = await wslService.check();

			if (wslCheck) {
				formatter.section("WSL Resource Configuration");
				await this.displayWslConfigRecommendation(
					wslCheck,
					prompter,
					wslService,
					formatter,
				);
			}
		}

		const toolsToCheck = options.tool
			? [this.registry.get(options.tool)]
			: this.registry.getAll();

		if (toolsToCheck.length === 0) {
			formatter.info("No tools registered");
			return 0;
		}

		const results: CheckResult[] = [];
		const toolsNeedingInstall: ToolModule[] = [];

		for (const tool of toolsToCheck) {
			const result = await tool.check(
				runner,
				platformInfo.platform,
				fileSystem,
			);
			results.push(result);

			if (!result.installed || !result.configured) {
				toolsNeedingInstall.push(tool);
			}
		}

		if (options.json) {
			formatter.json(results);
			return toolsNeedingInstall.length > 0 ? 1 : 0;
		}

		this.displayResults(results, formatter);

		if (toolsNeedingInstall.length === 0) {
			formatter.success("All tools are installed and configured!");
			return 0;
		}

		const shouldInstall = options.yes
			? true
			: await prompter.confirm(
					`${toolsNeedingInstall.length} tool(s) need attention. Would you like to install them?`,
				);

		if (!shouldInstall) {
			formatter.warn("Installation skipped");
			return 1;
		}

		let allInstallsSuccessful = true;

		for (const tool of toolsNeedingInstall) {
			formatter.info(`Installing ${tool.displayName}...`);
			const installResult = await tool.install(
				runner,
				prompter,
				platformInfo.platform,
			);

			if (installResult.success) {
				formatter.success(`${tool.displayName}: ${installResult.message}`);
			} else {
				formatter.error(`${tool.displayName}: ${installResult.message}`);
				allInstallsSuccessful = false;
			}
		}

		return allInstallsSuccessful ? 0 : 1;
	}

	private displayResults(
		results: CheckResult[],
		formatter: ReturnType<ServiceContainer["getFormatter"]>,
	): void {
		const headers = ["Tool", "Installed", "Configured", "Version", "Status"];
		const rows = results.map((r) => [
			r.toolName,
			r.installed ? "Yes" : "No",
			r.configured ? "Yes" : "No",
			r.version || "-",
			r.message || "",
		]);

		formatter.table(headers, rows);
	}

	private async displayWslConfigRecommendation(
		recommendation: WslConfigRecommendation,
		prompter: ReturnType<ServiceContainer["getPrompter"]>,
		wslService: WslConfigService,
		formatter: ReturnType<ServiceContainer["getFormatter"]>,
	): Promise<void> {
		const { suggested, current, hostResources } = recommendation;

		formatter.info(
			`Host: ${hostResources.cpuCores} CPU cores, ${hostResources.memoryGB} GB RAM`,
		);

		if (current) {
			const currentCpu = current.processors ?? "not set";
			const currentMem = current.memoryGB ?? "not set";
			formatter.warn(
				`Current .wslconfig: ${currentCpu} CPUs, ${currentMem} GB RAM`,
			);
			formatter.warn(
				`Suggested: ${suggested.processors} CPUs, ${suggested.memoryGB} GB RAM`,
			);

			if (
				current.processors === suggested.processors &&
				current.memoryGB === suggested.memoryGB
			) {
				formatter.success("WSL config matches recommendation");
				return;
			}

			const apply = await prompter.confirm(
				"Update .wslconfig to recommended values?",
			);
			if (!apply) {
				formatter.info("WSL config update skipped");
				return;
			}
		} else {
			formatter.warn(".wslconfig not found");
			formatter.info(
				`Recommended: ${suggested.processors} CPUs, ${suggested.memoryGB} GB RAM`,
			);

			const create = await prompter.confirm(
				"Create .wslconfig with recommended values?",
			);
			if (!create) {
				formatter.info("WSL config creation skipped");
				return;
			}
		}

		try {
			await wslService.createConfig(suggested);
			formatter.success(
				`.wslconfig created with ${suggested.processors} CPUs, ${suggested.memoryGB} GB RAM`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			formatter.error(`Failed to create .wslconfig: ${message}`);
		}
	}
}
