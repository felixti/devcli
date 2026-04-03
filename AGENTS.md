# devcli Project Knowledge Base

**Generated:** 2026-04-03  
**Stack:** Bun + TypeScript + Commander.js + Zod  
**Type:** CLI tool for developer environment setup

## OVERVIEW

devcli is a modular CLI tool that checks and installs development tools (nvm, Azure CLI, Copilot, opencode). Uses dependency injection with lazy-loaded service container and plugin-based tool registry.

## STRUCTURE

```
devcli/
├── bin/devcli.ts          # CLI entry point (executable)
├── src/
│   ├── cli.ts            # Main CLI orchestration
│   ├── kernel/           # Core DI container + types
│   ├── services/         # Service implementations (impl/mock pattern)
│   ├── platform/         # Platform detection (WSL/macOS/Linux/Windows)
│   ├── modules/setup/    # Main module: doctor/install commands
│   ├── commands/         # Shell completion generator
│   ├── config/           # Zod schemas + defaults
│   └── output/           # TTY-aware formatter
└── tests/                # Integration tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new CLI command | `src/modules/setup/commands/` | Follow doctor.ts/install.ts pattern |
| Add new tool | `src/modules/setup/tools/` | Implement ToolModule interface |
| Core interfaces | `src/kernel/types.ts` | All service contracts defined here |
| Service implementations | `src/services/*.impl.ts` | Real implementations |
| Service mocks | `src/services/*.mock.ts` | Test doubles |
| Platform detection | `src/platform/detector.ts` | Detects WSL1/2, shell, package manager |
| CLI entry | `bin/devcli.ts` | Shebang + version reading |
| Output formatting | `src/output/formatter.ts` | Colors, tables, JSON |

## CODE MAP

| Symbol | Type | Location | Purpose |
|--------|------|----------|---------|
| `runCLI` | function | `src/cli.ts:98` | Main entry point |
| `ServiceContainer` | interface | `src/kernel/types.ts:9` | DI container contract |
| `ServiceContainerImpl` | class | `src/kernel/service-container.ts:12` | Lazy-loading DI implementation |
| `DevcliModule` | interface | `src/kernel/types.ts:3` | Plugin module contract |
| `ModuleLoader` | class | `src/kernel/module-loader.ts:5` | Registers modules |
| `ToolModule` | interface | `src/modules/setup/tools/registry.ts:13` | Tool plugin contract |
| `ToolRegistry` | class | `src/modules/setup/tools/registry.ts:24` | Tool registration |
| `DoctorCommand` | class | `src/modules/setup/commands/doctor.ts:13` | Health check command |
| `InstallCommand` | class | `src/modules/setup/commands/install.ts:35` | Installation command |
| `Formatter` | class | `src/output/formatter.ts:1` | CLI output formatting |

## CONVENTIONS

### Import Pattern
- Use `@/*` path alias for all internal imports (maps to `src/*`)
- Type imports use `type` keyword explicitly (`verbatimModuleSyntax`)
- Example: `import type { ServiceContainer } from "@/kernel/types"`

### File Naming
- Interfaces in `kernel/types.ts` (centralized)
- Real implementations: `*.impl.ts`
- Test mocks: `*.mock.ts`
- Tests: `*.test.ts` (co-located with source)
- Interface re-exports: `services/*.ts` (just re-exports from kernel)

### Service Pattern
Services follow 3-file structure:
```
services/
├── process-runner.ts      # Re-exports interface from kernel
├── process-runner.impl.ts # RealProcessRunner implementation
└── process-runner.mock.ts # MockProcessRunner for tests
```

### Tool Pattern
Tools implement `ToolModule` interface:
```typescript
{
  name: string;
  displayName: string;
  check(runner, platform, fileSystem): Promise<CheckResult>;
  install(runner, prompter, platform): Promise<InstallResult>;
}
```

## ANTI-PATTERNS

**DON'T:** Import from relative paths like `../../kernel/types` — use `@/kernel/types`  
**DON'T:** Put interfaces in implementation files — all in `kernel/types.ts`  
**DON'T:** Use `process.exit()` in library code — only in command actions  
**DON'T:** Skip verification after tool install — always call `tool.check()` after install  

## UNIQUE STYLES

### Dependency Injection
Lazy-loaded singletons via factory functions in `ServiceContainerImpl`:
```typescript
getProcessRunner(): ProcessRunner {
  if (!this.instances.processRunner) {
    this.instances.processRunner = this.factories.getProcessRunner();
  }
  return this.instances.processRunner;
}
```

### Platform Detection
Framework-agnostic detection in `platform/detector.ts` — no dependencies, pure logic.

### TTY-Aware Output
Formatter detects terminal capability and strips colors for pipes.

## COMMANDS

```bash
# Install dependencies
bun install

# Run CLI
bun run bin/devcli.ts -- --help

# Run tests
bun test

# Run specific test
bun test src/services/process-runner.test.ts

# Install CLI globally for testing
bun link
devcli setup doctor
```

## NOTES

- **No build step** — Bun transpiles TypeScript on-the-fly (`noEmit: true`)
- **No CI/CD** — Currently no GitHub Actions or automation
- **bun.lock** — Commit this lockfile for reproducible installs
- **Path alias** — `@/*` configured in tsconfig.json, must be used for all internal imports
- **Node 18+** — Engine requirement (though Bun is the primary runtime)
