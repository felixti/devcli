import type {
  CheckResult,
  ServiceContainer,
} from "@/kernel/types";
import type { ToolModule, ToolRegistry } from "@/modules/setup/tools/registry";

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

    let platformInfo;
    try {
      const detector = this.services.getPlatformDetector();
      platformInfo = await detector.detect();
    } catch {
      formatter.error("Failed to detect platform");
      return 1;
    }

    let _config;
    try {
      const configLoader = this.services.getConfigLoader();
      _config = await configLoader.load();
    } catch {
      _config = { version: "1.0.0", tools: [] };
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
      const result = await tool.check(runner, platformInfo.platform, fileSystem);
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
          `${toolsNeedingInstall.length} tool(s) need attention. Would you like to install them?`
        );

    if (!shouldInstall) {
      formatter.warn("Installation skipped");
      return 1;
    }

    let allInstallsSuccessful = true;

    for (const tool of toolsNeedingInstall) {
      formatter.info(`Installing ${tool.displayName}...`);
      const installResult = await tool.install(runner, prompter, platformInfo.platform);

      if (installResult.success) {
        formatter.success(`${tool.displayName}: ${installResult.message}`);
      } else {
        formatter.error(`${tool.displayName}: ${installResult.message}`);
        allInstallsSuccessful = false;
      }
    }

    return allInstallsSuccessful ? 0 : 1;
  }

  private displayResults(results: CheckResult[], formatter: ReturnType<ServiceContainer["getFormatter"]>): void {
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
}
