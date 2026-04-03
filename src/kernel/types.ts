import type { Command } from "@commander-js/extra-typings";
import type { WslConfigService } from "../wsl/wslconfig.types";

export interface DevcliModule {
	name: string;
	description: string;
	register(program: Command, services: ServiceContainer): void;
}

export interface ServiceContainer {
	getProcessRunner(): ProcessRunner;
	getConfigLoader(): ConfigLoader;
	getPrompter(): Prompter;
	getFileSystem(): FileSystem;
	getPlatformDetector(): PlatformDetector;
	getFormatter(): Formatter;
	getWslConfigService(): WslConfigService;
}

export type Platform = "windows" | "wsl1" | "wsl2" | "macos" | "linux";

export interface PlatformInfo {
	platform: Platform;
	shell: string;
	packageManager: string;
	isWSL: boolean;
}

export interface CheckResult {
	toolName: string;
	installed: boolean;
	configured: boolean;
	version?: string;
	message?: string;
}

export interface InstallResult {
	toolName: string;
	success: boolean;
	message: string;
}

export interface ProcessRunner {
	run(
		command: string,
		args?: string[],
		options?: RunOptions,
	): Promise<RunResult>;
	spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess;
}

export interface RunOptions {
	cwd?: string;
	timeout?: number;
	capture?: "stdout" | "stderr" | "all";
	env?: Record<string, string>;
}

export interface RunResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
}

export interface SpawnOptions {
	cwd?: string;
	env?: Record<string, string>;
	stdio?: "pipe" | "inherit";
}

export interface ChildProcess {
	pid: number;
	kill(): void;
	on(event: "exit", callback: (code: number) => void): void;
	on(event: "error", callback: (err: Error) => void): void;
}

export interface ConfigLoader {
	load(): Promise<RemoteConfig>;
}

export interface RemoteConfig {
	version: string;
	tools: ToolDefinition[];
}

export interface ToolDefinition {
	name: string;
	displayName: string;
	minVersion?: string;
	installMethod?: string;
}

export interface Prompter {
	confirm(message: string): Promise<boolean>;
	select(message: string, choices: string[]): Promise<string>;
}

export interface FileSystem {
	exists(path: string): Promise<boolean>;
	readFile(path: string): Promise<string>;
	writeFile(path: string, content: string): Promise<void>;
	mkdirp(path: string): Promise<void>;
}

export interface PlatformDetector {
	detect(): Promise<PlatformInfo>;
}

export interface Formatter {
	success(message: string): void;
	error(message: string): void;
	warn(message: string): void;
	info(message: string): void;
	table(headers: string[], rows: string[][]): void;
	json(data: unknown): void;
	section(title: string): void;
}
