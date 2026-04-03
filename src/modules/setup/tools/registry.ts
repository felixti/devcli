import type {
  CheckResult,
  FileSystem,
  InstallResult,
  Platform,
  ProcessRunner,
  Prompter,
} from "../../../kernel/types.ts";

/**
 * Interface for tool modules that can check installation status and install tools.
 */
export interface ToolModule {
  name: string;
  displayName: string;
  check(runner: ProcessRunner, platform: Platform, fileSystem: FileSystem): Promise<CheckResult>;
  install(
    runner: ProcessRunner,
    prompter: Prompter,
    platform: Platform,
    yes?: boolean,
  ): Promise<InstallResult>;
}

/**
 * Registry for managing tool modules.
 * Allows registration, retrieval, and listing of available tools.
 */
export class ToolRegistry {
  private tools: Map<string, ToolModule> = new Map();

  /**
   * Register a tool module.
   * If a tool with the same name already exists, it will be overwritten.
   */
  register(tool: ToolModule): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool module by name.
   * @throws Error if the tool is not found
   */
  get(name: string): ToolModule {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool;
  }

  /**
   * Get all registered tool modules.
   */
  getAll(): ToolModule[] {
    return Array.from(this.tools.values());
  }
}
