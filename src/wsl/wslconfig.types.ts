/**
 * Represents the host machine's hardware resources.
 */
export interface HostResources {
	cpuCores: number;
	memoryGB: number;
}

/**
 * WSL2 configuration settings for .wslconfig file.
 */
export interface WslConfig {
	processors: number;
	memoryGB: number;
}

/**
 * Result of checking WSL configuration status.
 */
export interface WslConfigRecommendation {
	/** The suggested WSL configuration based on host resources */
	suggested: WslConfig;
	/** Current configuration if .wslconfig exists */
	current?: WslConfig;
	/** Detected host machine resources */
	hostResources: HostResources;
}

/**
 * Service for detecting host resources and managing WSL configuration.
 */
export interface WslConfigService {
	/**
	 * Detect Windows host CPU cores and memory via powershell.exe.
	 * Returns null if running outside WSL2 or detection fails.
	 */
	getHostResources(): Promise<HostResources | null>;

	/**
	 * Calculate recommended WSL config based on host resources.
	 * Uses linear formula: CPU/2 (round to even), RAM/4 (round down).
	 */
	calculateRecommendation(resources: HostResources): WslConfig;

	/**
	 * Check if .wslconfig exists in Windows user home and compare with recommendation.
	 * Returns null if not on WSL2 or check fails.
	 */
	check(): Promise<WslConfigRecommendation | null>;

	/**
	 * Get the Windows user home path from WSL.
	 * Returns something like /mnt/c/Users/username
	 */
	getWindowsHomePath(): Promise<string>;

	/**
	 * Create .wslconfig file with given configuration.
	 */
	createConfig(config: WslConfig): Promise<void>;
}
