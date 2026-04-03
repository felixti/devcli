import type { DetectorDeps, PlatformInfo } from "./types";

async function isWSL(
	env: Record<string, string>,
	readFile: (path: string) => Promise<string>,
): Promise<{ isWSL: boolean; wslVersion?: "wsl1" | "wsl2" }> {
	// Check WSL_DISTRO_NAME env variable first (most reliable for WSL2)
	const wslDistroName = env["WSL_DISTRO_NAME"];
	if (wslDistroName) {
		// WSL2 sets WSL_DISTRO_NAME, WSL1 may not
		return { isWSL: true, wslVersion: "wsl2" };
	}

	// Check for WSL1 via /proc/version
	// Microsoft signature appears in WSL kernel version string
	try {
		const procVersion = await readFile("/proc/version");
		if (procVersion.toLowerCase().includes("microsoft")) {
			return { isWSL: true, wslVersion: "wsl1" };
		}
	} catch {
		// /proc/version not available, not Linux
	}

	return { isWSL: false };
}

function detectShell(env: Record<string, string>, isWindows: boolean): string {
	if (isWindows) {
		// Check if PowerShell Core (pwsh) or Windows PowerShell
		const psModulePath = env["PSModulePath"];
		if (psModulePath && psModulePath.includes("PowerShell")) {
			return "powershell";
		}
		return "powershell";
	}

	// Unix-like systems - use SHELL env
	const shell = env["SHELL"];
	if (shell) {
		// Extract basename (e.g., /bin/bash -> bash)
		return shell.split("/").pop() || shell;
	}

	return "unknown";
}

function detectPackageManager(platform: string, isWSL: boolean): string {
	// If running in WSL, detect the package manager inside WSL, not Windows
	if (isWSL) {
		// WSL commonly runs Ubuntu/Debian or Alpine
		// Check for apt (Debian/Ubuntu) or apk (Alpine)
		// Default to apt for WSL
		return "apt";
	}

	switch (platform) {
		case "darwin":
			return "brew";
		case "win32":
			return "winget";
		case "linux":
			return "apt";
		default:
			return "unknown";
	}
}

export async function detectPlatform(
	deps: DetectorDeps,
): Promise<PlatformInfo> {
	const { env, readFile } = deps;

	const osPlatform =
		env["OS"] === "Windows_NT" ? "win32" : env["Platform"] || process.platform;
	const wslCheck = await isWSL(env, readFile);

	let platform: PlatformInfo["platform"];

	if (wslCheck.isWSL) {
		platform = wslCheck.wslVersion || "wsl1";
	} else if (osPlatform === "darwin") {
		platform = "macos";
	} else if (osPlatform === "win32") {
		platform = "windows";
	} else {
		platform = "linux";
	}

	const isWindows = osPlatform === "win32";
	const shell = detectShell(env, isWindows);
	const packageManager = detectPackageManager(osPlatform, wslCheck.isWSL);

	return {
		platform,
		shell,
		packageManager,
		isWSL: wslCheck.isWSL,
	};
}
