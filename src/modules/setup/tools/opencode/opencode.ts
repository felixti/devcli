import { homedir } from "os";
import { join } from "path";
import type {
	CheckResult,
	FileSystem,
	InstallResult,
	Platform,
	ProcessRunner,
	Prompter,
} from "../../../../kernel/types";
import type { ToolModule } from "../registry";

export class OpencodeTool implements ToolModule {
	name = "opencode";
	displayName = "opencode";

	private getConfigPath(): string {
		return join(homedir(), ".config", "opencode", "opencode.json");
	}

	async check(
		runner: ProcessRunner,
		_platform: Platform,
		fileSystem: FileSystem,
	): Promise<CheckResult> {
		const versionResult = await runner.run("opencode", ["--version"]);

		if (versionResult.exitCode !== 0) {
			return {
				toolName: this.name,
				installed: false,
				configured: false,
				message: "opencode is not installed",
			};
		}

		const version = versionResult.stdout.trim();
		const configPath = this.getConfigPath();
		const configExists = await fileSystem.exists(configPath);

		if (!configExists) {
			return {
				toolName: this.name,
				installed: true,
				configured: false,
				version,
				message: `opencode ${version} is installed but not configured`,
			};
		}

		return {
			toolName: this.name,
			installed: true,
			configured: true,
			version,
			message: `opencode ${version} is installed and configured`,
		};
	}

	async install(
		runner: ProcessRunner,
		prompter: Prompter,
		_platform: Platform,
	): Promise<InstallResult> {
		const confirmed = await prompter.confirm(
			"opencode is not installed. Would you like to install it via npm?",
		);

		if (!confirmed) {
			return {
				toolName: this.name,
				success: false,
				message: "User declined installation",
			};
		}

		const result = await runner.run("npm", ["install", "-g", "opencode"]);

		if (result.exitCode !== 0) {
			return {
				toolName: this.name,
				success: false,
				message: `Installation failed: ${result.stderr}`,
			};
		}

		return {
			toolName: this.name,
			success: true,
			message: "opencode installed successfully via npm",
		};
	}
}

export const opencodeTool = new OpencodeTool();
