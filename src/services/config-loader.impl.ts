import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { defaults } from "@/config/defaults";
import { type RemoteConfig, RemoteConfigSchema } from "@/config/schema";
import type { ConfigLoader } from "@/kernel/types";

interface CacheEntry {
	config: RemoteConfig;
	timestamp: number;
}

export interface ConfigLoaderDeps {
	fetch: (url: string) => Promise<Response>;
	cachePath: string;
	ttlMs: number;
	remoteUrl?: string;
}

export class RealConfigLoader implements ConfigLoader {
	private fetch: (url: string) => Promise<Response>;
	private cachePath: string;
	private ttlMs: number;
	private remoteUrl: string;

	constructor(deps: ConfigLoaderDeps) {
		this.fetch = deps.fetch;
		this.cachePath = deps.cachePath;
		this.ttlMs = deps.ttlMs;
		this.remoteUrl =
			deps.remoteUrl ??
			process.env.DEVCLI_CONFIG_URL ??
			"https://raw.githubusercontent.com/company/devcli-config/main/config.json";
	}

	async load(): Promise<RemoteConfig> {
		const remoteConfig = await this.tryFetchRemote();
		if (remoteConfig) {
			await this.writeCache(remoteConfig);
			return remoteConfig;
		}

		const cachedConfig = await this.tryReadCache();
		if (cachedConfig) {
			return cachedConfig;
		}

		return defaults;
	}

	private async tryFetchRemote(): Promise<RemoteConfig | null> {
		try {
			const response = await this.fetch(this.remoteUrl);
			if (!response.ok) {
				return null;
			}

			const data = await response.json();
			const result = RemoteConfigSchema.safeParse(data);

			if (result.success) {
				return result.data;
			}

			return null;
		} catch {
			return null;
		}
	}

	private async tryReadCache(): Promise<RemoteConfig | null> {
		try {
			const content = await fs.readFile(this.cachePath, "utf-8");
			const entry: CacheEntry = JSON.parse(content);

			const now = Date.now();
			const age = now - entry.timestamp;

			if (age > this.ttlMs) {
				return null;
			}

			const result = RemoteConfigSchema.safeParse(entry.config);
			if (result.success) {
				return result.data;
			}

			return null;
		} catch {
			return null;
		}
	}

	private async writeCache(config: RemoteConfig): Promise<void> {
		try {
			const entry: CacheEntry = {
				config,
				timestamp: Date.now(),
			};

			await fs.mkdir(dirname(this.cachePath), { recursive: true });
			await fs.writeFile(this.cachePath, JSON.stringify(entry, null, 2));
		} catch {}
	}
}
