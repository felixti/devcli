import { homedir } from "os";
import { join } from "path";
import type {
	CheckResult,
	FileSystem,
	InstallResult,
	Platform,
	ProcessRunner,
	Prompter,
} from "@/kernel/types";
import type { ToolModule } from "../registry";

export class VscodeExtensionsTool implements ToolModule {
	name = "vscode-extensions";
	displayName = "VSCode Extensions";

	private getExtensionsForPlatform(platform: Platform): string[] {
		switch (platform) {
			case "windows":
				return [
					"github.copilot-chat",
					"sst-dev.opencode",
					"ms-vscode-remote.remote-wsl",
				];
			case "wsl1":
			case "wsl2":
				return ["github.copilot-chat", "sst-dev.opencode"];
			case "macos":
			case "linux":
				return ["github.copilot-chat", "sst-dev.opencode"];
			default:
				return ["github.copilot-chat", "sst-dev.opencode"];
		}
	}

	async check(
		runner: ProcessRunner,
		platform: Platform,
		fileSystem: FileSystem,
	): Promise<CheckResult> {
		if (platform === "wsl1" || platform === "wsl2") {
			const vscodeServerPath = join(homedir(), ".vscode-server");
			const serverExists = await fileSystem.exists(vscodeServerPath);

			if (!serverExists) {
				return {
					toolName: this.name,
					installed: false,
					configured: false,
					message: "VSCode Server not found in WSL",
				};
			}
		}

		const versionResult = await runner.run("code", ["--version"]);

		if (versionResult.exitCode !== 0) {
			return {
				toolName: this.name,
				installed: false,
				configured: false,
				message: "VSCode is not installed or 'code' CLI not on PATH",
			};
		}

		const extensionsResult = await runner.run("code", ["--list-extensions"]);

		if (extensionsResult.exitCode !== 0) {
			return {
				toolName: this.name,
				installed: true,
				configured: false,
				message: "VSCode installed but could not list extensions",
			};
		}

		const installedExtensions = extensionsResult.stdout
			.split("\n")
			.map((ext) => ext.trim().toLowerCase())
			.filter((ext) => ext.length > 0);

		const expectedExtensions = this.getExtensionsForPlatform(platform);

		const allInstalled = expectedExtensions.every((ext) =>
			installedExtensions.includes(ext.toLowerCase()),
		);

		const version = versionResult.stdout.split("\n")[0]?.trim();

		return {
			toolName: this.name,
			installed: true,
			configured: allInstalled,
			version,
			message: allInstalled
				? "All expected VSCode extensions are installed"
				: "Some VSCode extensions are missing",
		};
	}

	async install(
		runner: ProcessRunner,
		_prompter: Prompter,
		platform: Platform,
	): Promise<InstallResult> {
		const extensions = this.getExtensionsForPlatform(platform);
		const failures: string[] = [];

		for (const extensionId of extensions) {
			const result = await runner.run("code", [
				"--install-extension",
				extensionId,
			]);

			if (result.exitCode === 127) {
				return {
					toolName: this.name,
					success: false,
					message: "VSCode CLI not available. Install VSCode first.",
				};
			}

			if (result.exitCode !== 0) {
				failures.push(extensionId);
			}
		}

		if (failures.length > 0) {
			return {
				toolName: this.name,
				success: false,
				message: `Failed to install extensions: ${failures.join(", ")}`,
			};
		}

		return {
			toolName: this.name,
			success: true,
			message: `Successfully installed ${extensions.length} VSCode extension(s)`,
		};
	}
}
