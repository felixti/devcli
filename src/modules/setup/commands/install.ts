import type { FileSystem, InstallResult, Platform, ProcessRunner, Prompter } from "@/kernel/types";
import type { ToolModule, ToolRegistry } from "../tools/registry";

export interface InstallCommandOptions {
  toolName?: string;
  yes: boolean;
  force: boolean;
  runner: ProcessRunner;
  prompter: Prompter;
  fileSystem: FileSystem;
  platform: Platform;
}

export interface InstallCommandResult {
  success: boolean;
  message: string;
}

/**
 * InstallCommand handles installation of development tools.
 *
 * Features:
 * - Install specific tool by name, or all missing tools if no name provided
 * - Check if tool is already installed (skip unless --force)
 * - Support --yes flag to skip confirmation prompts
 * - Support --force flag to reinstall even if already present
 * - Verify installation after completion
 */
export class InstallCommand {
  constructor(private registry: ToolRegistry) {}

  async execute(options: InstallCommandOptions): Promise<InstallCommandResult> {
    const { toolName, yes, force, runner, prompter, fileSystem, platform } = options;

    if (toolName) {
      return this.installSingleTool(toolName, yes, force, runner, prompter, fileSystem, platform);
    }

    return this.installAllMissingTools(yes, force, runner, prompter, fileSystem, platform);
  }

  private async installSingleTool(
    toolName: string,
    yes: boolean,
    force: boolean,
    runner: ProcessRunner,
    prompter: Prompter,
    fileSystem: FileSystem,
    platform: Platform,
  ): Promise<InstallCommandResult> {
    const tool = this.registry.get(toolName);

    const checkResult = await tool.check(runner, platform, fileSystem);

    if (checkResult.installed && !force) {
      return {
        success: true,
        message: `${tool.displayName} is already installed (${checkResult.version}) - skipped. Use --force to reinstall.`,
      };
    }

    if (checkResult.installed && force) {
      const shouldReinstall =
        yes ||
        (await prompter.confirm(
          `${tool.displayName} is already installed. Would you like to reinstall it?`,
        ));

      if (!shouldReinstall) {
        return {
          success: true,
          message: `Reinstallation of ${tool.displayName} cancelled by user`,
        };
      }
    }

    if (!checkResult.installed && !yes) {
      const shouldInstall = await prompter.confirm(
        `${tool.displayName} is not installed. Would you like to install it?`,
      );

      if (!shouldInstall) {
        return {
          success: true,
          message: `Installation of ${tool.displayName} cancelled by user`,
        };
      }
    }

    const installResult = await tool.install(runner, prompter, platform, yes);

    if (!installResult.success) {
      return {
        success: false,
        message: `Failed to install ${tool.displayName}: ${installResult.message}`,
      };
    }

    const verifyResult = await tool.check(runner, platform, fileSystem);

    if (!verifyResult.installed) {
      return {
        success: false,
        message: `${tool.displayName} was installed but verification failed. You may need to restart your terminal.`,
      };
    }

    return {
      success: true,
      message: `${tool.displayName} installed successfully (${verifyResult.version})`,
    };
  }

  private async installAllMissingTools(
    yes: boolean,
    force: boolean,
    runner: ProcessRunner,
    prompter: Prompter,
    fileSystem: FileSystem,
    platform: Platform,
  ): Promise<InstallCommandResult> {
    const allTools = this.registry.getAll();

    if (allTools.length === 0) {
      return {
        success: true,
        message: "No tools are registered for installation.",
      };
    }

    const installResults: { tool: ToolModule; result: InstallResult }[] = [];
    const skippedTools: ToolModule[] = [];
    const failedTools: { tool: ToolModule; error: string }[] = [];

    for (const tool of allTools) {
      const checkResult = await tool.check(runner, platform, fileSystem);

      if (checkResult.installed && !force) {
        skippedTools.push(tool);
        continue;
      }

      if (!yes) {
        const action = checkResult.installed ? "reinstall" : "install";
        const shouldProceed = await prompter.confirm(
          `${tool.displayName} is ${checkResult.installed ? "already installed" : "not installed"}. Would you like to ${action} it?`,
        );

        if (!shouldProceed) {
          skippedTools.push(tool);
          continue;
        }
      }

      const installResult = await tool.install(runner, prompter, platform, yes);

      if (installResult.success) {
        const verifyResult = await tool.check(runner, platform, fileSystem);
        if (verifyResult.installed) {
          installResults.push({ tool, result: installResult });
        } else {
          failedTools.push({
            tool,
            error: "Verification failed after installation",
          });
        }
      } else {
        failedTools.push({ tool, error: installResult.message });
      }
    }

    let message = "";

    if (installResults.length > 0) {
      message += `Installed ${installResults.length} tool${installResults.length === 1 ? "" : "s"}: ${installResults.map((r) => r.tool.name).join(", ")}. `;
    }

    if (skippedTools.length > 0) {
      message += `Skipped ${skippedTools.length} tool${skippedTools.length === 1 ? "" : "s"}: ${skippedTools.map((t) => t.name).join(", ")}. `;
    }

    if (failedTools.length > 0) {
      message += `Failed to install ${failedTools.length} tool${failedTools.length === 1 ? "" : "s"}: ${failedTools.map((f) => `${f.tool.name} (${f.error})`).join(", ")}.`;
    }

    const allSuccess = failedTools.length === 0;

    return {
      success: allSuccess,
      message: message.trim() || "No tools were processed.",
    };
  }
}
