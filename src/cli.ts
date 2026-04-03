import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "@commander-js/extra-typings";
import { generateCompletion } from "@/commands/completion";
import { ModuleLoader } from "@/kernel/module-loader";
import { ServiceContainerImpl } from "@/kernel/service-container";
import type { DevcliModule, ServiceContainer } from "@/kernel/types";
import { Formatter } from "@/output/formatter";
import { RealConfigLoader } from "@/services/config-loader.impl";
import { RealFileSystem } from "@/services/file-system.impl";
import { RealPlatformDetector } from "@/services/platform-detector";
import { RealProcessRunner } from "@/services/process-runner.impl";
import { RealPrompter } from "@/services/prompter.impl";
import { WslConfigServiceImpl } from "@/wsl/wslconfig.service";

export interface CLIDeps {
	version: string;
	argv: string[];
	exitOverride?: boolean;
	configureOutput?: {
		writeOut?: (str: string) => void;
		writeErr?: (str: string) => void;
		getOutHelpWidth?: () => number;
		getErrHelpWidth?: () => number;
	};
}

function createServiceContainer(): ServiceContainer {
	const cachePath = join(homedir(), ".cache", "devcli", "config.json");

	return new ServiceContainerImpl({
		getProcessRunner: () => new RealProcessRunner(),
		getConfigLoader: () =>
			new RealConfigLoader({
				fetch: globalThis.fetch.bind(globalThis),
				cachePath,
				ttlMs: 60 * 60 * 1000,
			}),
		getPrompter: () => new RealPrompter(),
		getFileSystem: () => new RealFileSystem(),
		getPlatformDetector: () => new RealPlatformDetector(),
		getFormatter: () => new Formatter(),
		getWslConfigService: () =>
			new WslConfigServiceImpl(
				new RealProcessRunner(),
				new RealFileSystem(),
				new RealPrompter(),
			),
	});
}

function registerCompletionCommand(
	program: Command,
	writeOut: (str: string) => void,
	writeErr: (str: string) => void,
): void {
	program
		.command("completion")
		.description("Generate shell completion scripts")
		.argument("<shell>", "Shell type (bash, zsh, fish, powershell)")
		.action((shell: string) => {
			try {
				const script = generateCompletion(shell);
				writeOut(script + "\n");
			} catch (error) {
				if (error instanceof Error) {
					writeErr(`Error: ${error.message}\n`);
				} else {
					writeErr("Error: Unknown error occurred\n");
				}
				process.exit(1);
			}
		});
}

export function createProgram(deps: CLIDeps): Command {
	const program = new Command();

	program
		.name("devcli")
		.description("Developer environment CLI")
		.version(deps.version, "-v, --version", "Display version number");

	if (deps.exitOverride) {
		program.exitOverride();
	}

	if (deps.configureOutput) {
		program.configureOutput(deps.configureOutput);
	}

	const services = createServiceContainer();

	const writeOut =
		deps.configureOutput?.writeOut ?? ((str: string) => console.log(str));
	const writeErr =
		deps.configureOutput?.writeErr ?? ((str: string) => console.error(str));

	registerCompletionCommand(program, writeOut, writeErr);

	const moduleLoader = new ModuleLoader();
	moduleLoader.registerAll(program, services);

	return program;
}

export async function runCLI(deps: CLIDeps): Promise<void> {
	const program = createProgram(deps);
	await program.parseAsync(deps.argv);
}
// shift-left test
