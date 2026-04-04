import type {
  CheckResult,
  FileSystem,
  InstallResult,
  Platform,
  ProcessRunner,
  Prompter,
} from "@/kernel/types";
import type { ToolModule } from "../registry";

export class CopilotTool implements ToolModule {
  name = "copilot";
  displayName = "GitHub Copilot";

  async check(
    runner: ProcessRunner,
    _platform: Platform,
    _fileSystem: FileSystem,
  ): Promise<CheckResult> {
    const extensionCheck = await runner.run("gh", ["copilot", "--version"]);

    if (extensionCheck.exitCode === 0) {
      const version = this.extractVersion(extensionCheck.stdout);

      // Check auth status separately to determine if configured
      const authCheck = await runner.run("gh", ["auth", "status"]);
      const configured = authCheck.exitCode === 0 && authCheck.stdout.includes("Logged in");

      return {
        toolName: this.name,
        installed: true,
        configured,
        version,
        message: configured
          ? "GitHub Copilot CLI extension is installed and configured"
          : "GitHub Copilot CLI extension is installed but not configured",
      };
    }

    const standaloneCheck = await runner.run("github-copilot-cli", ["--version"]);

    if (standaloneCheck.exitCode === 0) {
      const version = this.extractVersion(standaloneCheck.stdout);

      return {
        toolName: this.name,
        installed: true,
        configured: true,
        version,
        message: "GitHub Copilot CLI (standalone) is installed",
      };
    }

    return {
      toolName: this.name,
      installed: false,
      configured: false,
      message: "GitHub Copilot CLI is not installed",
    };
  }

  private extractVersion(output: string): string | undefined {
    const match = output.match(/(\d+\.\d+(?:\.\d+)?)/);
    return match?.[1];
  }

  async install(
    runner: ProcessRunner,
    prompter: Prompter,
    platform: Platform,
    yes?: boolean,
  ): Promise<InstallResult> {
    const ghCheck = await runner.run("gh", ["--version"]);

    if (ghCheck.exitCode !== 0) {
      // gh not installed, need to install it first
      const ghInstalled = await this.installGh(runner, prompter, platform, yes);

      if (!ghInstalled) {
        return {
          toolName: this.name,
          success: false,
          message: "Failed to install gh CLI",
        };
      }
    }

    // Install Copilot extension
    const installResult = await runner.run("gh", ["extension", "install", "github/gh-copilot"]);

    if (installResult.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        message: `Failed to install Copilot extension: ${installResult.stderr}`,
      };
    }

    return {
      toolName: this.name,
      success: true,
      message: "GitHub Copilot extension installed successfully. Run 'gh auth login' to configure.",
    };
  }

  private async installGh(
    runner: ProcessRunner,
    prompter: Prompter,
    platform: Platform,
    yes?: boolean,
  ): Promise<boolean> {
    const packageManager = this.getPackageManager(platform);

    if (packageManager === "brew") {
      const result = await runner.run("brew", ["install", "gh"]);
      return result.exitCode === 0;
    }

    if (packageManager === "winget") {
      const result = await runner.run("winget", ["install", "--id", "GitHub.cli"]);
      return result.exitCode === 0;
    }

    if (packageManager === "apt") {
      // For apt, we need to handle the key and repository setup
      if (!yes) {
        const confirmed = await prompter.confirm(
          "Install gh CLI using apt? This will add GitHub's repository and install gh.",
        );

        if (!confirmed) {
          return false;
        }
      }

      // Install curl and gnupg if needed, then add gh repo
      const depsResult = await runner.run("apt-get", ["update"]);
      if (depsResult.exitCode !== 0) return false;

      const keyResult = await runner.run("sh", [
        "-c",
        "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg",
      ]);
      if (keyResult.exitCode !== 0) return false;

      const repoResult = await runner.run("sh", [
        "-c",
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
      ]);
      if (repoResult.exitCode !== 0) return false;

      const updateResult = await runner.run("apt-get", ["update"]);
      if (updateResult.exitCode !== 0) return false;

      const installResult = await runner.run("apt-get", ["install", "-y", "gh"]);
      return installResult.exitCode === 0;
    }

    return false;
  }

  private getPackageManager(platform: Platform): string {
    switch (platform) {
      case "macos":
        return "brew";
      case "windows":
        return "winget";
      case "linux":
      case "wsl1":
      case "wsl2":
        return "apt";
      default:
        return "unknown";
    }
  }
}
