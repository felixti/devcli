import type { Command } from "@commander-js/extra-typings";
import { setupModule } from "@/modules/setup/index";
import type { DevcliModule, ServiceContainer } from "./types";

export class ModuleLoader {
	private readonly modules: DevcliModule[];

	constructor() {
		this.modules = [setupModule];
	}

	loadAll(): DevcliModule[] {
		return this.modules;
	}

	registerAll(program: Command, services: ServiceContainer): void {
		for (const module of this.modules) {
			module.register(program, services);
		}
	}
}
