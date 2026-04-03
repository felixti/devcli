import type { RemoteConfig } from "./schema";

export const defaults: RemoteConfig = {
	version: "1.0.0",
	tools: [
		{
			name: "nvm",
			displayName: "Node Version Manager (nvm)",
			minVersion: "0.39.0",
			installMethod:
				"curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash",
		},
		{
			name: "azure-cli",
			displayName: "Azure CLI",
			minVersion: "2.50.0",
			installMethod: "brew install azure-cli",
		},
		{
			name: "copilot",
			displayName: "GitHub Copilot CLI",
			minVersion: "1.0.0",
			installMethod: "gh extension install github/gh-copilot",
		},
		{
			name: "opencode",
			displayName: "opencode CLI",
			minVersion: "2.0.0",
			installMethod: "npm install -g opencode",
		},
	],
};
