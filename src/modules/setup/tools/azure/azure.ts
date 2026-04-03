import type {
	CheckResult,
	FileSystem,
	InstallResult,
	Platform,
	ProcessRunner,
	Prompter,
} from "../../../../kernel/types";
import type { ToolModule } from "../registry";

function isExpiredTokenError(stderr: string): boolean {
	const expiredPatterns = [
		/token.*expired/i,
		/authentication.*expired/i,
		/refresh token.*expired/i,
		/AADSTS700082/i,
		/AADSTS50078/i,
		/AADSTS70043/i,
	];
	return expiredPatterns.some((pattern) => pattern.test(stderr));
}

export const AzureTool: ToolModule = {
	name: "azure",
	displayName: "Azure CLI",

	async check(
		runner: ProcessRunner,
		_platform: Platform,
		_fileSystem: FileSystem,
	): Promise<CheckResult> {
		const versionResult = await runner.run("az", ["--version"]);

		if (versionResult.exitCode !== 0) {
			return {
				toolName: this.name,
				installed: false,
				configured: false,
				message: "Azure CLI is not installed",
			};
		}

		const versionMatch = versionResult.stdout.match(
			/azure-cli\s+(\d+\.\d+\.\d+)/i,
		);
		const version = versionMatch?.[1];

		const accountResult = await runner.run("az", ["account", "show"]);

		if (accountResult.exitCode !== 0) {
			const expiredToken = isExpiredTokenError(accountResult.stderr);

			return {
				toolName: this.name,
				installed: true,
				configured: false,
				version,
				message: expiredToken
					? "Azure CLI is installed but authentication token has expired. Run 'az login' to re-authenticate."
					: "Azure CLI is installed but not configured. Run 'az login' to authenticate.",
			};
		}

		try {
			const accountData = JSON.parse(accountResult.stdout);
			if (accountData.id) {
				return {
					toolName: this.name,
					installed: true,
					configured: true,
					version,
					message: `Azure CLI ${version || ""} is installed and configured`,
				};
			}
		} catch {
			// ignore
		}

		return {
			toolName: this.name,
			installed: true,
			configured: false,
			version,
			message: "Azure CLI is installed but not properly configured",
		};
	},

	async install(
		runner: ProcessRunner,
		prompter: Prompter,
		platform: Platform,
	): Promise<InstallResult> {
		const confirmed = await prompter.confirm(
			"Azure CLI is not installed. Would you like to install it?",
		);

		if (!confirmed) {
			return {
				toolName: this.name,
				success: false,
				message: "User declined installation",
			};
		}

		let installCommand: string;
		let installArgs: string[];

		switch (platform) {
			case "macos":
				installCommand = "brew";
				installArgs = ["install", "azure-cli"];
				break;
			case "windows":
				installCommand = "winget";
				installArgs = ["install", "Microsoft.AzureCLI"];
				break;
			case "linux":
			case "wsl1":
			case "wsl2":
				installCommand = "bash";
				installArgs = [
					"-c",
					"curl -sL https://aka.ms/InstallAzureCLIDeb | bash",
				];
				break;
			default:
				return {
					toolName: this.name,
					success: false,
					message: `Unsupported platform: ${platform}`,
				};
		}

		const result = await runner.run(installCommand, installArgs);

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
			message: `Azure CLI installed successfully on ${platform}. Run 'az login' to authenticate.`,
		};
	},
};
