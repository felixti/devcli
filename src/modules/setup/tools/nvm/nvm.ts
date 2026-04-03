import type {
	CheckResult,
	FileSystem,
	InstallResult,
	Platform,
	ProcessRunner,
	Prompter,
} from "@/kernel/types";
import type { ToolModule } from "../registry";

/**
 * nvm Tool Module - Handles checking and installing nvm (Unix/macOS) and nvm-windows (Windows)
 *
 * nvm (Unix/macOS): https://github.com/nvm-sh/nvm
 * nvm-windows: https://github.com/coreybutler/nvm-windows
 *
 * Key differences:
 * - nvm (Unix): `nvm --version`, configured via `nvm current`
 * - nvm-windows: `nvm version`, configured via `nvm list`
 */
export class NvmTool implements ToolModule {
	name = "nvm";
	displayName = "Node Version Manager (nvm)";

	private isWindowsPlatform(platform: Platform): boolean {
		return platform === "windows";
	}

	private getVersionCommand(platform: Platform): {
		command: string;
		args: string[];
	} {
		if (this.isWindowsPlatform(platform)) {
			return { command: "nvm", args: ["version"] };
		}
		return { command: "nvm", args: ["--version"] };
	}

	private getConfiguredCheckCommand(platform: Platform): {
		command: string;
		args: string[];
	} {
		if (this.isWindowsPlatform(platform)) {
			return { command: "nvm", args: ["list"] };
		}
		return { command: "nvm", args: ["current"] };
	}

	async check(
		runner: ProcessRunner,
		platform: Platform,
		_fileSystem: FileSystem,
	): Promise<CheckResult> {
		const versionCmd = this.getVersionCommand(platform);
		const versionResult = await runner.run(versionCmd.command, versionCmd.args);

		if (versionResult.exitCode !== 0) {
			return {
				toolName: this.name,
				installed: false,
				configured: false,
				message: "nvm is not installed",
			};
		}

		const version = versionResult.stdout.trim();

		const configCmd = this.getConfiguredCheckCommand(platform);
		const configResult = await runner.run(configCmd.command, configCmd.args);

		let configured = false;
		let message =
			"nvm is installed but not configured with an active Node version";

		if (configResult.exitCode === 0) {
			const configOutput = configResult.stdout.trim().toLowerCase();

			if (platform === "windows") {
				const output = configResult.stdout.trim();
				if (
					output &&
					!output.includes("No installations recognized") &&
					output.length > 0
				) {
					configured = true;
					message = `nvm v${version} installed with configured Node versions`;
				}
			} else {
				if (configOutput && configOutput !== "none" && configOutput !== "n/a") {
					configured = true;
					message = `nvm v${version} installed with active Node version: ${configResult.stdout.trim()}`;
				}
			}
		}

		return {
			toolName: this.name,
			installed: true,
			configured,
			version,
			message,
		};
	}

	async install(
		runner: ProcessRunner,
		prompter: Prompter,
		platform: Platform,
	): Promise<InstallResult> {
		const mockFs: FileSystem = {
			exists: async () => false,
			readFile: async () => "",
			writeFile: async () => {},
			mkdirp: async () => {},
		};
		const checkResult = await this.check(runner, platform, mockFs);

		if (checkResult.installed) {
			return {
				toolName: this.name,
				success: true,
				message: `nvm is already installed (${checkResult.version})`,
			};
		}

		const shouldInstall = await prompter.confirm(
			"nvm is not installed. Would you like to install it?",
		);

		if (!shouldInstall) {
			return {
				toolName: this.name,
				success: false,
				message: "Installation cancelled by user",
			};
		}

		let installSuccess = false;
		let installMessage = "";

		if (this.isWindowsPlatform(platform)) {
			const result = await runner.run("winget", [
				"install",
				"CoreyButler.NVMforWindows",
				"--silent",
			]);

			installSuccess = result.exitCode === 0;
			installMessage =
				result.exitCode === 0
					? "nvm-windows installed successfully via winget"
					: `Installation failed: ${result.stderr || "winget command failed"}`;
		} else {
			const installScript =
				"https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh";
			const result = await runner.run("bash", [
				"-c",
				`curl -o- ${installScript} | bash`,
			]);

			installSuccess = result.exitCode === 0;

			if (installSuccess) {
				installMessage =
					"nvm installed successfully via official install script";

				await this.updateShellProfile(runner, prompter, platform);
			} else {
				installMessage = `Installation failed: ${result.stderr || "install script failed"}`;
			}
		}

		if (!installSuccess) {
			return {
				toolName: this.name,
				success: false,
				message: installMessage,
			};
		}

		const verifyResult = await this.check(runner, platform, mockFs);
		if (!verifyResult.installed) {
			return {
				toolName: this.name,
				success: false,
				message: `${installMessage}, but verification failed. Please restart your shell or terminal.`,
			};
		}

		return {
			toolName: this.name,
			success: true,
			message: `${installMessage} (v${verifyResult.version})`,
		};
	}

	private async updateShellProfile(
		runner: ProcessRunner,
		prompter: Prompter,
		platform: Platform,
	): Promise<void> {
		if (platform === "windows") {
			return;
		}

		const shell = process.env.SHELL || "/bin/bash";
		const profilePath = shell.includes("zsh")
			? `${process.env.HOME}/.zshrc`
			: `${process.env.HOME}/.bashrc`;

		const guardStart = "# >>> devcli-nvm >>>";
		const guardEnd = "# <<< devcli-nvm <<<";

		const profileCheck = await runner
			.run("cat", [profilePath])
			.catch(() => ({ stdout: "", exitCode: 1 }));

		if (profileCheck.stdout.includes(guardStart)) {
			return;
		}

		const shouldUpdate = await prompter.confirm(
			`Would you like to add nvm initialization to ${profilePath}?`,
		);

		if (!shouldUpdate) {
			return;
		}

		const nvmBlock = `${guardStart}
# Added by devcli setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\ . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \\ . "$NVM_DIR/bash_completion"
${guardEnd}`;

		await runner.run("bash", ["-c", `echo "${nvmBlock}" >> ${profilePath}`]);
	}
}

export const nvmTool = new NvmTool();
