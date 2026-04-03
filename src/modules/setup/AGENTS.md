# Setup Module

**Purpose:** Developer environment setup — check and install dev tools (nvm, Azure CLI, Copilot, opencode).

## STRUCTURE

```
modules/setup/
├── index.ts              # Module entry, command registration
├── commands/
│   ├── doctor.ts         # Health check command
│   └── install.ts        # Installation command
└── tools/
    ├── registry.ts       # Tool registry (plugin system)
    ├── nvm/nvm.ts        # Node Version Manager
    ├── azure/azure.ts    # Azure CLI
    ├── copilot/copilot.ts # GitHub Copilot CLI
    └── opencode/opencode.ts # Opencode CLI
```

## COMMANDS

### `setup doctor [--json] [--yes] [--tool <name>]`
Check installation status of all tools or specific tool.
- `--json` — Output as JSON
- `--yes` — Auto-answer prompts
- `--tool <name>` — Check single tool

### `setup install [--yes] [--force] [tool]`
Install missing tools or specific tool.
- `--yes` — Skip confirmation
- `--force` — Reinstall even if present
- `[tool]` — Install specific tool only

## TOOL REGISTRY

Tools register via `ToolModule` interface:
```typescript
interface ToolModule {
  name: string;           // Unique identifier
  displayName: string;    // Human-readable
  check(runner, platform, fileSystem): Promise<CheckResult>;
  install(runner, prompter, platform): Promise<InstallResult>;
}
```

### Adding a New Tool

1. Create `tools/<name>/<name>.ts`:
```typescript
export const myTool: ToolModule = {
  name: "mytool",
  displayName: "My Tool",
  async check(runner, platform, fileSystem) {
    // Return CheckResult
  },
  async install(runner, prompter, platform) {
    // Return InstallResult
  },
};
```

2. Register in `index.ts`:
```typescript
import { myTool } from "./tools/mytool/mytool";
registry.register(myTool);
```

## CONVENTIONS

### Tool Implementation Pattern
- Use object literal or class — both work
- Platform-specific logic via `switch(platform)`
- Always verify installation after completing install
- Handle errors gracefully with descriptive messages

### CheckResult Format
```typescript
{
  toolName: string;
  installed: boolean;
  configured: boolean;
  version?: string;
  message?: string;  // Human-readable status
}
```

## ANTI-PATTERNS

**DON'T:** Skip verification after install — always re-check  
**DON'T:** Hardcode platform detection — use platformDetector service  
**DON'T:** Use console.log — use formatter service for output  
**DON'T:** Forget to handle both WSL1 and WSL2 separately if needed  

## NOTES

- Tools can be stateless (object literal) or stateful (class)
- AzureTool uses regex patterns to detect expired tokens
- NVM tool detects nvm-windows vs nvm-sh
- Copilot checks both gh extension and standalone install
