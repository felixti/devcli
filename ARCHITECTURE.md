# DevCLI Architecture Documentation

> **Last Updated**: April 3, 2026  
> **Total Lines of Code**: ~7,121 lines (56 source files)  
> **Architecture Pattern**: Micro-Kernel with Dependency Injection  
> **Platform Support**: Windows, WSL1, WSL2, macOS, Linux

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Core Kernel](#core-kernel)
4. [Service Layer](#service-layer)
5. [Module System](#module-system)
6. [Tool Pattern](#tool-pattern)
7. [Configuration System](#configuration-system)
8. [Platform Detection](#platform-detection)
9. [Test Architecture](#test-architecture)
10. [Design Decisions](#design-decisions)
11. [Potential Issues & Recommendations](#potential-issues--recommendations)

---

## Executive Summary

DevCLI is a cross-platform developer environment setup tool built with TypeScript using a **micro-kernel architecture**. The design prioritizes:

- **Extensibility**: New tools and modules can be added without modifying core code
- **Testability**: Dependency injection enables comprehensive mocking
- **Portability**: Node.js-compatible (no Bun-specific APIs in production)
- **Maintainability**: Clean separation of concerns via service interfaces

### Key Statistics

| Metric | Value |
|--------|-------|
| Source Files | 56 `.ts` files |
| Test Files | 22 (co-located) |
| Total Lines | ~7,121 |
| Interfaces | 17 (centralized in `kernel/types.ts`) |
| Services | 7 core services |
| Tools | 5 setup tools |
| Modules | 1 setup module (extensible) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Entry                            │
│                    bin/devcli.ts (34 LOC)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     Kernel Layer                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ ServiceContainer│  │ ModuleLoader   │  │   Types      │  │
│  │ (Lazy DI)       │  │ (Auto-discovery)│  │ (Interfaces) │  │
│  └────────┬───────┘  └────────┬───────┘  └──────────────┘  │
└───────────┼───────────────────┼────────────────────────────┘
            │                   │
┌───────────▼───────────────────▼────────────────────────────┐
│                    Service Layer                             │
│  ProcessRunner │ FileSystem │ ConfigLoader │ Prompter │ Platform │
│   (spawn)      │ (fs ops)   │ (fetch/cache)│ (prompts)│ Detector │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│                    Module Layer                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Setup Module                                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │   │
│  │  │ Doctor Cmd   │  │ Install Cmd  │  │ Tool Reg  │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Interface Segregation**: All interfaces defined in `kernel/types.ts`
2. **Dependency Inversion**: Services depend on abstractions, not implementations
3. **Single Responsibility**: Each service has one clear purpose
4. **Open/Closed**: New tools added via registration, not modification

---

## Core Kernel

### 1. ServiceContainer - Dependency Injection Hub

**File**: `src/kernel/service-container.ts` (86 LOC)

The `ServiceContainerImpl` implements lazy initialization with factory pattern:

```typescript
// Lines 12-85
export class ServiceContainerImpl implements ServiceContainer {
  private instances: Partial<ServiceInstances> = {};
  private factories: ServiceFactories;

  constructor(factories?: Partial<ServiceFactories>) {
    this.factories = {
      getProcessRunner: () => new RealProcessRunner(),
      getFileSystem: () => new RealFileSystem(),
      // ... 5 more factories
      ...factories, // Allow injection for testing
    };
  }

  // Lazy initialization pattern (line 38-85)
  getProcessRunner(): ProcessRunner {
    if (!this.instances.processRunner) {
      this.instances.processRunner = this.factories.getProcessRunner();
    }
    return this.instances.processRunner;
  }
}
```

**Key Design**: 
- Factories can be overridden for testing (lines 24-35)
- Singleton instances cached after first access
- Type-safe via TypeScript interfaces

### 2. ModuleLoader - Auto-Discovery System

**File**: `src/kernel/module-loader.ts` (21 LOC)

```typescript
// Lines 1-21
import { setupModule } from "@/modules/setup/index";

const modules = [setupModule]; // Static list (no dynamic import)

export class ModuleLoader {
  constructor(private program: Command, private services: ServiceContainer) {}

  registerAll(): void {
    for (const module of modules) {
      module.register(this.program, this.services);
    }
  }
}
```

**Important Note**: Auto-discovery uses static imports (line 3), NOT dynamic `import()` as originally planned. This is due to Node.js compatibility requirements (Task 6 constraint).

### 3. Types - Interface Centralization

**File**: `src/kernel/types.ts` (119 LOC)

**17 interfaces defined** (lines 4-119):

| Interface | Purpose | Lines |
|-----------|---------|-------|
| `DevcliModule` | Module contract | 4-8 |
| `ServiceContainer` | DI container | 10-21 |
| `PlatformInfo` | Platform metadata | 22-28 |
| `CheckResult` | Tool check output | 29-36 |
| `InstallResult` | Tool install output | 37-42 |
| `ProcessRunner` | Process execution | 43-51 |
| `ConfigLoader` | Remote config | 79-82 |
| `FileSystem` | File operations | 100-106 |
| `Prompter` | User interaction | 95-99 |

**Centralization Rationale**: 
- Single source of truth for contracts
- Prevents circular dependencies
- Enables IDE auto-completion
- Simplifies refactoring

---

## Service Layer

### Pattern: Interface + Impl + Mock + Test

Each service follows a 4-file structure:

```
services/
├── {name}.ts              # Interface re-export
├── {name}.impl.ts         # Real implementation
├── {name}.mock.ts         # Test double
└── {name}.test.ts         # Unit tests
```

### 1. ProcessRunner

**File**: `src/services/process-runner.impl.ts` (117 LOC)

**Key Features**:
- Promise-based spawn with timeout (line 23-49)
- Signal forwarding for proper cleanup (line 76-87)
- Exit code normalization (line 62-74)

```typescript
// Critical pattern: signal forwarding (lines 76-87)
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
```

**Why**: Prevents zombie processes when parent receives termination signal.

### 2. FileSystem

**File**: `src/services/file-system.impl.ts` (73 LOC)

**Methods**:
- `exists(path)` - Check file existence (line 8-15)
- `readFile(path)` - UTF-8 text read (line 17-26)
- `writeFile(path, content)` - Atomic write (line 28-42)
- `mkdirp(path)` - Recursive directory creation (line 44-61)

**Design Decision**: Abstracts `node:fs/promises` to enable mocking in tests.

### 3. ConfigLoader - Fallback Chain

**File**: `src/services/config-loader.impl.ts` (104 LOC)

**3-Tier Fallback Strategy** (lines 35-48):

```
1. Fetch remote config (GitHub raw JSON)
   ↓ (fails or invalid)
2. Read cached config (if not expired)
   ↓ (miss or expired)
3. Return bundled defaults
```

**Caching Strategy**:
- TTL: 60 minutes (line 11)
- Cache format: `{ config, timestamp }` (line 72)
- Zod validation on all tiers (lines 40, 55, 93)

### 4. Prompter

**File**: `src/services/prompter.impl.ts` (55 LOC)

**Methods**:
- `confirm(message)` - Y/N prompt (line 13-33)
- `input(message)` - Free text input (line 35-54)

**Test Double**: `prompter.mock.ts` allows pre-configured responses.

### 5. PlatformDetector

**File**: `src/platform/detector.ts` (100 LOC)

**Detection Priority** (lines 8-42):

1. **WSL2**: `WSL_DISTRO_NAME` env var present
2. **WSL1**: `/proc/version` contains "microsoft" (case-insensitive)
3. **Windows**: `process.platform === 'win32'`
4. **macOS**: `process.platform === 'darwin'`
5. **Linux**: Default fallback

**Shell Detection** (lines 44-68):
- `$SHELL` environment variable parsing
- Parent process inspection as fallback

**Package Manager Detection** (lines 70-95):
- Platform-based default (brew/macOS, winget/Windows, apt/Linux)
- File existence checks for validation

---

## Module System

### Module Interface

```typescript
// src/kernel/types.ts:4-8
export interface DevcliModule {
  name: string;
  description: string;
  register(program: Command, services: ServiceContainer): void;
}
```

### Setup Module Structure

```
src/modules/setup/
├── index.ts                 # Module registration
├── index.test.ts            # Module tests
├── commands/
│   ├── doctor.ts            # Check command (213 LOC)
│   ├── doctor.test.ts       # Doctor tests (369 LOC)
│   ├── install.ts           # Install command (215 LOC)
│   └── install.test.ts      # Install tests (305 LOC)
└── tools/
    ├── registry.ts          # Tool registry (62 LOC)
    ├── registry.test.ts     # Registry tests (81 LOC)
    ├── nvm/
    │   ├── nvm.ts           # NVM tool (244 LOC)
    │   └── nvm.test.ts      # NVM tests (280 LOC)
    ├── azure/
    │   ├── azure.ts         # Azure CLI tool (153 LOC)
    │   └── azure.test.ts    # Azure tests (301 LOC)
    ├── copilot/
    │   ├── copilot.ts       # Copilot tool (191 LOC)
    │   └── copilot.test.ts  # Copilot tests (229 LOC)
    ├── opencode/
    │   ├── opencode.ts      # Opencode tool (98 LOC)
    │   └── opencode.test.ts # Opencode tests (151 LOC)
    └── vscode-extensions/
        ├── vscode-extensions.ts       # VSCode ext tool (135 LOC)
        └── vscode-extensions.test.ts  # VSCode ext tests (483 LOC)
```

---

## Tool Pattern

### ToolModule Interface

```typescript
// src/modules/setup/tools/registry.ts:13-26
export interface ToolModule {
  name: string;                    // Unique identifier
  displayName: string;             // Human-readable name
  
  check(
    runner: ProcessRunner,
    platform: Platform,
    fileSystem: FileSystem
  ): Promise<CheckResult>;
  
  install(
    runner: ProcessRunner,
    prompter: Prompter,
    platform: Platform,
    yes?: boolean                  // Skip confirmations if true
  ): Promise<InstallResult>;
}
```

### CheckResult Contract

```typescript
// src/kernel/types.ts:29-36
export interface CheckResult {
  toolName: string;
  installed: boolean;
  configured: boolean;            // Distinguishes install vs setup
  version?: string;
  message?: string;
}
```

**Critical Distinction**: 
- `installed`: Binary present and executable
- `configured`: Tool properly set up for use (e.g., auth, env vars)

### Implementation Pattern

Tools can be implemented as:

**A. Class-based** (stateful, complex logic):
```typescript
export class CopilotTool implements ToolModule {
  name = "copilot";
  displayName = "GitHub Copilot";
  
  async check(runner, platform, fileSystem) { /* ... */ }
  async install(runner, prompter, platform, yes) { /* ... */ }
}
```

**B. Object literal** (simple, stateless):
```typescript
export const nvmTool: ToolModule = {
  name: "nvm",
  displayName: "Node Version Manager",
  async check(runner, platform, fileSystem) { /* ... */ },
  async install(runner, prompter, platform, yes) { /* ... */ },
};
```

---

## Configuration System

### Schema (Zod)

**File**: `src/config/schema.ts` (24 LOC)

```typescript
export const RemoteConfigSchema = z.object({
  version: z.string(),
  tools: z.array(z.object({
    name: z.string(),
    displayName: z.string(),
    minVersion: z.string().optional(),
  })),
});
```

### Defaults

**File**: `src/config/defaults.ts` (32 LOC)

Bundled fallback configuration when remote and cache both fail.

### Validation

All config sources validated with Zod:
- Remote: `RemoteConfigSchema.parse(await response.json())`
- Cache: Same schema after JSON.parse
- Defaults: Statically typed, assumed valid

---

## Platform Detection

### Strategy Pattern

**File**: `src/platform/detector.ts` (100 LOC)

Multi-tier detection with environment variable priority:

```typescript
// WSL Detection (lines 8-20)
if (process.env.WSL_DISTRO_NAME) return "wsl2";
if (await fileContains("/proc/version", "microsoft")) return "wsl1";

// Native Platform (lines 22-35)
switch (process.platform) {
  case "win32": return "windows";
  case "darwin": return "macos";
  default: return "linux";
}
```

### Package Manager Mapping

| Platform | Primary | Fallback |
|----------|---------|----------|
| macOS | brew | - |
| Windows | winget | - |
| Linux | apt | dnf/yum |
| WSL1/2 | apt | - |

---

## Test Architecture

### Testing Patterns

**1. Co-location**: Tests in same directory as source (`*.test.ts`)

**2. Mock-based**: DI enables complete mocking
```typescript
// Example from doctor.test.ts
const mockRunner = new MockProcessRunner();
mockRunner.setResponse("nvm", { exitCode: 0, stdout: "0.39.0" });
```

**3. Service Container Override**:
```typescript
const container = new ServiceContainerImpl({
  getProcessRunner: () => mockRunner,
  getFileSystem: () => mockFileSystem,
});
```

### Test Statistics

| Category | Count |
|----------|-------|
| Total Tests | 168 |
| Passing | 168 (100%) |
| Failing | 0 |
| Test Files | 22 |
| Mock Files | 7 |

### Coverage Highlights

- **Kernel**: 100% (service container, module loader)
- **Services**: ~90% (process runner, file system, config loader)
- **Commands**: ~95% (doctor, install)
- **Tools**: ~85% (varies by complexity)

---

## Design Decisions

### 1. Why Centralize Interfaces in `kernel/types.ts`?

**Pros**:
- Single source of truth
- No circular import issues
- IDE navigation works better
- Changes visible in one diff

**Cons**:
- Large file (119 LOC)
- Violates "one class per file" slightly

**Verdict**: Worth it for small-to-medium projects.

### 2. Why Impl/Mock Pattern?

**Alternative Considered**: jest.mock() or Bun's mock.module()

**Decision**: DI pattern chosen for:
- Framework agnostic (works with any test runner)
- Type-safe mocking
- No magic/module patching
- Works in Node.js (no Bun APIs)

### 3. Why Static Module List?

**Original Plan**: Dynamic `import()` of `src/modules/*/index.ts`

**Constraint**: Node.js ES modules don't support dynamic imports without file extensions, and TypeScript complicates this.

**Solution**: Static array in `module-loader.ts` (line 3-5):
```typescript
import { setupModule } from "@/modules/setup/index";
const modules = [setupModule];
```

**Trade-off**: Slightly less "auto-discovery" but much more reliable.

### 4. Why Shebang `#!/usr/bin/env -S bun run`?

**Problem**: `npm install -g .` failed with Node.js (TypeScript not native)

**Solution**: Changed from `#!/usr/bin/env node` to `#!/usr/bin/env -S bun run`

**Rationale**: Bun executes TypeScript natively without compilation step.

---

## Potential Issues & Recommendations

### 🔴 Critical Issues

**1. Bun APIs in Test Code**
- **File**: `src/services/config-loader.test.ts` (fixed)
- **Issue**: Used `Bun.write()` and `Bun.file()` directly
- **Impact**: Tests not portable to Node.js
- **Status**: ✅ Fixed (replaced with `node:fs/promises`)

**2. Copilot Auth Check**
- **File**: `src/modules/setup/tools/copilot/copilot.ts` (fixed)
- **Issue**: Checked `gh copilot --version` output for "Logged in"
- **Impact**: `configured` always false
- **Fix**: Now calls `gh auth status` separately (lines 26-27)

**3. `--yes` Flag Not Propagated**
- **Files**: All tool `install()` methods (fixed)
- **Issue**: Tools prompted even with `--yes` flag
- **Fix**: Added `yes?: boolean` parameter to `ToolModule.install()`

### 🟡 Warnings

**4. Import Path Inconsistencies**
- **Files**: `azure.ts`, `copilot.ts`, `opencode.ts` use relative imports
- **Pattern**: `"../../../../kernel/types"` instead of `"@/kernel/types"`
- **Impact**: Refactoring breaks imports
- **Recommendation**: Standardize on `@/` aliases

**5. WSL Module Not in Original Plan**
- **Files**: `src/wsl/` directory
- **Issue**: WslConfigService added after plan approval
- **Impact**: Unreviewed code (though functional)
- **Recommendation**: Document in architecture, add tests

**6. VSCode Extensions Tool Not in Plan**
- **File**: `src/modules/setup/tools/vscode-extensions/`
- **Issue**: 5th tool not in original 4-tool spec
- **Impact**: Extra maintenance burden
- **Verdict**: Acceptable (adds value)

### 🟢 Recommendations

**7. Add Integration Tests**
- **Current**: Unit tests only
- **Gap**: No end-to-end CLI testing
- **Recommendation**: Add test that actually runs `bun run bin/devcli.ts`

**8. Node.js Compatibility Verification**
- **Current**: Manual review
- **Gap**: No automated check for Bun APIs
- **Recommendation**: Add CI job that greps for `Bun.` in src/ (excluding tests)

**9. Error Handling Consistency**
- **Observation**: Some tools return `success: true` with skip message, others `success: false`
- **Recommendation**: Document convention in AGENTS.md

**10. Config Schema Versioning**
- **Current**: No version check in schema
- **Risk**: Breaking changes in remote config
- **Recommendation**: Add `configVersion` field and migration logic

---

## Appendix: File Reference

### Entry Points
- `bin/devcli.ts` - CLI entry (shebang, version reading)
- `src/cli.ts` - Main CLI orchestration

### Kernel (4 files, 557 LOC)
- `src/kernel/types.ts` - All interfaces (119 LOC)
- `src/kernel/service-container.ts` - DI implementation (86 LOC)
- `src/kernel/module-loader.ts` - Module discovery (21 LOC)
- `*.test.ts` - Tests (331 LOC)

### Services (24 files, ~1,800 LOC)
- ProcessRunner: Interface + Impl + Mock + Test
- FileSystem: Interface + Impl + Mock + Test
- ConfigLoader: Interface + Impl + Mock + Test
- Prompter: Interface + Impl + Mock + Test
- PlatformDetector: Types + Detector + Test

### Modules (19 files, ~3,200 LOC)
- Setup Module: Index + Commands + Tools + Tests
- 5 Tools: nvm, azure, copilot, opencode, vscode-extensions

### Platform (5 files, 315 LOC)
- `src/platform/detector.ts` - Detection logic (100 LOC)
- `src/platform/types.ts` - Platform types (13 LOC)

### Config (3 files, 127 LOC)
- `src/config/schema.ts` - Zod schemas (24 LOC)
- `src/config/defaults.ts` - Fallback config (32 LOC)

### Output (2 files, 239 LOC)
- `src/output/formatter.ts` - TTY formatting (98 LOC)

### WSL (3 files, 612 LOC)
- `src/wsl/wslconfig.service.ts` - WSL config (209 LOC)
- `src/wsl/wslconfig.types.ts` - Types (69 LOC)

---

**End of Architecture Documentation**

*Generated by Atlas Orchestrator with deep code analysis*  
*Total Analysis Time: ~15 minutes*  
*Files Analyzed: 56 TypeScript files*
