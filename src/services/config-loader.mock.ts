import type { RemoteConfig } from "@/config/schema";
import type { ConfigLoader } from "@/kernel/types";

export class MockConfigLoader implements ConfigLoader {
	private config: RemoteConfig;

	constructor(config: RemoteConfig) {
		this.config = config;
	}

	async load(): Promise<RemoteConfig> {
		return this.config;
	}

	setConfig(config: RemoteConfig): void {
		this.config = config;
	}
}
