import type { Command } from "@commander-js/extra-typings";
import type { DevcliModule, ServiceContainer } from "@/kernel/types";
import { DoctorCommand } from "@/modules/setup/commands/doctor";
import { InstallCommand } from "@/modules/setup/commands/install";
import { AzureTool } from "@/modules/setup/tools/azure/azure";
import { CopilotTool } from "@/modules/setup/tools/copilot/copilot";
import { nvmTool } from "@/modules/setup/tools/nvm/nvm";
import { opencodeTool } from "@/modules/setup/tools/opencode/opencode";
import type { ToolModule, ToolRegistry } from "@/modules/setup/tools/registry";
import { ToolRegistry as ToolRegistryClass } from "@/modules/setup/tools/registry";

function createToolRegistry(): ToolRegistry {
	const registry = new ToolRegistryClass();
	registry.register(nvmTool);
	registry.register(AzureTool);
	registry.register(new CopilotTool());
	registry.register(opencodeTool);
	return registry;
}

function registerCommands(
	program: Command,
	services: ServiceContainer,
	registry: ToolRegistry,
): void {
	const setupCommand = program
		.command("setup")
		.description("Developer environment setup and verification");

	const doctorCommand = setupCommand
		.command("doctor")
		.description("Check installation status of development tools")
		.option("--json", "Output results as JSON")
		.option("--yes", "Automatically answer yes to prompts")
		.option("--tool <name>", "Check specific tool only");

	doctorCommand.action(async (opts) => {
		const runner = services.getProcessRunner();
		const formatter = services.getFormatter();
		const prompter = services.getPrompter();
		const fileSystem = services.getFileSystem();

		const doctor = new DoctorCommand(registry, services);

		const options = {
			json: opts.json ?? false,
			yes: opts.yes ?? false,
			tool: opts.tool,
		};

		const exitCode = await doctor.execute(options);
		process.exit(exitCode);
	});

	const installCommand = setupCommand
		.command("install")
		.description("Install development tools")
		.option("--yes", "Automatically answer yes to prompts")
		.option("--force", "Force reinstall even if already installed")
		.argument("[tool]", "Specific tool to install");

	installCommand.action(async (toolName, opts) => {
		const runner = services.getProcessRunner();
		const prompter = services.getPrompter();
		const fileSystem = services.getFileSystem();
		const platformDetector = services.getPlatformDetector();
		const formatter = services.getFormatter();

		const platformInfo = await platformDetector.detect();
		const installCmd = new InstallCommand(registry);

		const result = await installCmd.execute({
			toolName,
			yes: opts.yes ?? false,
			force: opts.force ?? false,
			runner,
			prompter,
			fileSystem,
			platform: platformInfo.platform,
		});

		if (result.success) {
			formatter.success(result.message);
		} else {
			formatter.error(result.message);
			process.exit(1);
		}
	});
}

export const setupModule: DevcliModule = {
	name: "setup",
	description: "Developer environment setup and verification",
	register(program: Command, services: ServiceContainer): void {
		const registry = createToolRegistry();
		registerCommands(program, services, registry);
	},
};
