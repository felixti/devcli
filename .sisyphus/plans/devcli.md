# Plan: devcli — Micro-Kernel Developer CLI

## TL;DR

> **Quick Summary**: Build `devcli`, a cross-platform CLI tool (TypeScript, Node.js-compatible) using a **micro-kernel architecture**. The kernel provides shared services (ProcessRunner, ConfigLoader, Prompter, FileSystem, PlatformDetector, Formatter), and modules auto-register commands. First module: `setup` (doctor check + auto-install for nvm, azure-cli, copilot CLI, opencode). Future modules: proxy, config, etc.
> 
> **Deliverables**:
> - `devcli` npm package with micro-kernel architecture
> - Kernel: service container + module auto-discovery + shared services
> - Module `setup`: `devcli setup doctor` + `devcli setup install`
> - `devcli completion <shell>` command
> - Company-wide remote config (GitHub raw JSON) with cache + bundled fallback
> - Full TDD test suite with bun test
> 
> **Estimated Effort**: Medium-Large
> **Parallel Execution**: YES - 4 waves + final verification
> **Critical Path**: Task 1 → 2 → 6 → 11 → 16 → 19 → 20 → F1-F4

---

## Context

### Original Request
Build a CLI tool to help the dev team set up their environments. The CLI acts as a doctor/checker that verifies tools like nvm, opencode, copilot CLI, and azure CLI are installed and properly configured. Supports Windows (PowerShell/CMD), WSL (Linux), and macOS.

### Interview Summary
**Key Discussions**:
- **Architecture**: Micro-kernel pattern — minimal kernel with shared services, modules auto-discover and register commands
- **Module structure**: `devcli setup doctor`, `devcli setup install`, `devcli completion bash` — modules are sub-command groups
- **Auto-discovery**: Modules export from `modules/<name>/index.ts`; kernel discovers and registers them automatically
- **Stack**: TypeScript, Node.js-compatible (no Bun-specific APIs), Bun-optimized for dev
- **Framework**: commander.js + `@commander-js/extra-typings`
- **Kernel services**: ProcessRunner, ConfigLoader, Prompter, FileSystem, PlatformDetector, Formatter
- **Scope**: Setup module first, extensible for future modules (proxy, config management)
- **Behavior**: Report + auto-install with confirmation; `--yes` for CI; `--json` for machines
- **Config**: GitHub raw JSON, Zod validation, cache + bundled fallback
- **Testing**: TDD with bun test
- **Platforms**: Windows (PowerShell/CMD), WSL1/WSL2, macOS
- **Distribution**: npm package

**Research Findings**:
- **gh CLI**: Factory pattern for DI, command groups, extension system — our kernel adapts this pattern
- **nvm-windows vs nvm**: Fundamentally different tools — separate platform strategies required
- **WSL detection**: Must check `WSL_DISTRO_NAME` + `/proc/version`, not just `process.platform`
- **Commander.js completions**: No native support — custom generation (simple for small CLI)
- **Signal forwarding**: Critical for child process management — explicit SIGINT/SIGTERM forwarding
- **Bun.spawn mocking**: Use DI pattern, not `mock.module("bun")`

### Metis Review
**Identified Gaps** (all addressed):
- **Distribution paradox**: Node.js-compatible npm package (no Bun APIs)
- **nvm-windows divergence**: Separate checker/installer per platform
- **WSL detection**: `WSL_DISTRO_NAME` + `/proc/version` fallback
- **Test isolation**: All tests use DI mocks via service container
- **Config resilience**: Cache + bundled defaults for offline/corporate firewall

---

## Work Objectives

### Core Objective
Build a production-quality micro-kernel CLI where `npm install -g devcli` gives every developer a standardized environment check and setup tool, with a module architecture that supports future growth.

### Concrete Deliverables
```
src/
  kernel/
    types.ts              # Module, Command, Service interfaces
    service-container.ts  # DI container for shared services
    module-loader.ts      # Auto-discovers and registers modules
  services/               # Shared kernel services (interfaces + impls)
    process-runner.ts     # Interface
    process-runner.impl.ts
    process-runner.mock.ts
    config-loader.ts      # Interface
    config-loader.impl.ts
    config-loader.mock.ts
    prompter.ts           # Interface
    prompter.impl.ts
    prompter.mock.ts
    file-system.ts        # Interface
    file-system.impl.ts
    file-system.mock.ts
  platform/
    detector.ts           # Platform detection
  output/
    formatter.ts          # TTY-aware output
  modules/
    setup/                # Setup module (v1)
      index.ts            # Module registration (auto-discovered)
      commands/
        doctor.ts         # devcli setup doctor
        install.ts        # devcli setup install [tool]
      tools/
        registry.ts       # Tool registry
        nvm.ts            # nvm checker + installer
        azure.ts          # azure-cli checker + installer
        copilot.ts        # copilot checker + installer
        opencode.ts       # opencode checker + installer
  config/
    schema.ts             # Zod schema
    defaults.ts           # Bundled defaults
bin/
  devcli.ts               # CLI entry point
```

### Definition of Done
- [ ] `npm install -g .` succeeds and `devcli --version` prints version
- [ ] `devcli setup doctor` checks all 4 tools with platform-appropriate methods
- [ ] `devcli setup install` offers to install missing tools with confirmation
- [ ] `devcli setup install nvm` installs a specific tool
- [ ] `devcli setup doctor --json` outputs valid JSON
- [ ] `devcli setup doctor --yes` auto-installs without prompts
- [ ] `devcli completion bash|zsh|fish|powershell` generates valid scripts
- [ ] `bun test` passes all tests with 0 failures
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Kernel auto-discovers the setup module without manual registration

### Must Have
- **Micro-kernel architecture**: `ServiceContainer` (DI) + `ModuleLoader` (auto-discovery) + `Module` interface
- **Module interface**: `{ name, description, register(program, services): void }` — each module registers its own commands
- **ServiceContainer**: lazy-inits services, injects into modules on registration
- **Auto-discovery**: kernel scans `src/modules/*/index.ts`, imports each, calls `register()`
- Node.js-compatible (no Bun APIs: no `Bun.spawn`, `Bun.file`, `Bun.$`)
- Commander.js with `@commander-js/extra-typings` for typed commands
- `program.exitOverride()` + `program.configureOutput()` for testable commands
- Platform detection: Windows, WSL1, WSL2, macOS, Linux
- Per-tool "configured" checks:
  - **nvm**: `nvm --version` + `nvm current`/`nvm list` shows active Node version
  - **azure-cli**: `az --version` + `az account show` returns JSON with `id`
  - **copilot**: `gh copilot --version` (or standalone) + `gh auth status` shows "Logged in"
  - **opencode**: `opencode --version` + config file exists
- Remote config (GitHub raw JSON) + Zod + local cache + bundled fallback
- Shell completions: bash, zsh, fish, PowerShell
- TDD: failing test first for every feature
- Idempotent installers

### Must NOT Have (Guardrails)
- ❌ NO Bun-specific APIs (`Bun.spawn`, `Bun.file`, `Bun.$`, etc.)
- ❌ NO proxy module in v1 — only setup module
- ❌ NO version pinning/management — check presence + config only
- ❌ NO auto-configuration of tools — check status, never modify tool config
- ❌ NO plugin/extension system beyond the module pattern (no dynamic loading of external modules)
- ❌ NO self-update mechanism
- ❌ NO rollback/undo for installations
- ❌ NO `mock.module("bun")` — use DI pattern
- ❌ NO direct `child_process.spawn`/`fetch`/`fs.*` from business logic — always through service container
- ❌ NO logging/telemetry, rich UI (spinners/progress bars), or `eval "$(devcli init)"`
- ❌ NO elevated permissions without warning
- ❌ NO hardcoded Unix paths for Windows or vice versa
- ❌ NO AI slop: excessive comments, over-abstraction, generic names

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: YES (TDD)
- **Framework**: bun test
- **TDD workflow**: RED → GREEN → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + interfaces, 5 tasks):
├── Task 1: Project scaffolding + test infrastructure [quick]
├── Task 2: Kernel types + ServiceContainer interface [quick]
├── Task 3: Platform detector [quick]
├── Task 4: Output/formatter module [quick]
└── Task 5: Remote config schema + bundled defaults [quick]

Wave 2 (After Wave 1 — kernel core + services, 5 tasks MAX PARALLEL):
├── Task 6: Kernel Core: ServiceContainer impl + ModuleLoader (depends: 2) [quick]
├── Task 7: ProcessRunner interface + impl + mock (depends: 2) [quick]
├── Task 8: ConfigLoader impl (depends: 2, 5) [unspecified-high]
├── Task 9: Prompter impl (depends: 2) [quick]
└── Task 10: FileSystem impl (depends: 2) [quick]

Wave 3 (After Wave 2 — tool modules, 5 tasks MAX PARALLEL):
├── Task 11: Tool registry pattern (depends: 2) [quick]
├── Task 12: nvm checker + installer (depends: 3, 7, 11) [deep]
├── Task 13: azure-cli checker + installer (depends: 3, 7, 11) [deep]
├── Task 14: copilot checker + installer (depends: 3, 7, 11, 9) [deep]
└── Task 15: opencode checker + installer (depends: 3, 7, 10, 11) [deep]

Wave 4 (After Wave 3 — commands + integration, 5 tasks):
├── Task 16: `setup doctor` command (depends: 12-15, 4, 8, 9) [deep]
├── Task 17: `setup install` command (depends: 12-15, 7, 9) [deep]
├── Task 18: Setup module registration (depends: 16, 17) [quick]
├── Task 19: Shell completion command (depends: 2) [quick]
└── Task 20: CLI entry point + integration tests (depends: 18, 19) [unspecified-high]

Wave FINAL (After ALL — 4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T2 → T6 → T11 → T12 → T16 → T18 → T20 → F1-F4
Max Concurrent: 5 (Waves 2 & 3)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2-5 | 1 |
| 2 | 1 | 6-9, 19 | 1 |
| 3 | 1 | 12-15 | 1 |
| 4 | 1 | 16 | 1 |
| 5 | 1 | 8 | 1 |
| 6 | 2 | 11, 18 | 2 |
| 7 | 2 | 12-15, 17 | 2 |
| 8 | 2, 5 | 16 | 2 |
| 9 | 2 | 14, 16, 17 | 2 |
| 10 | 2 | 15 | 2 |
| 11 | 2 | 12-15 | 3 |
| 12 | 3, 7, 11 | 16, 17 | 3 |
| 13 | 3, 7, 11 | 16, 17 | 3 |
| 14 | 3, 7, 9, 11 | 16, 17 | 3 |
| 15 | 3, 7, 10, 11 | 16, 17 | 3 |
| 16 | 12-15, 4, 8, 9 | 18 | 4 |
| 17 | 12-15, 7, 9 | 18 | 4 |
| 18 | 16, 17 | 20 | 4 |
| 19 | 2 | 20 | 4 |
| 20 | 18, 19 | F1-F4 | 4 |

### Agent Dispatch Summary

- **Wave 1**: **5** — T1-T5 → `quick`
- **Wave 2**: **5** — T6 → `quick`, T7 → `quick`, T8 → `unspecified-high`, T9-T10 → `quick`
- **Wave 3**: **5** — T11 → `quick`, T12-T15 → `deep`
- **Wave 4**: **5** — T16-T17 → `deep`, T18-T19 → `quick`, T20 → `unspecified-high`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Project Scaffolding + Test Infrastructure

  **What to do**:
  - Run `bun init` to scaffold the project
  - Configure `package.json`: name `devcli`, version `0.1.0`, bin `bin/devcli.ts`, type `module`, engines `node >=18`
  - Configure `tsconfig.json`: strict, ES2022, moduleResolution `bundler`, paths `@/*` → `src/*`
  - Dependencies: `commander`, `@commander-js/extra-typings`, `zod`
  - DevDependencies: `typescript`, `@types/node`
  - Create directory structure:
    ```
    src/
      kernel/          # Micro-kernel core
      services/        # Shared service interfaces + implementations
      platform/        # Platform detection
      output/          # TTY-aware formatting
      modules/         # Auto-discovered modules
        setup/         # First module
          commands/    # setup sub-commands
          tools/       # Tool checkers + installers
      config/          # Remote config schema + defaults
    bin/
      devcli.ts        # Entry point
    ```
  - Create `.gitignore`
  - Create `bin/devcli.ts` placeholder with `#!/usr/bin/env node` shebang
  - Verify `bun test` and `npx tsc --noEmit` pass

  **Must NOT do**:
  - Do NOT use Bun-specific APIs anywhere

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundation)
  - **Parallel Group**: Wave 1 (first task)
  - **Blocks**: 2, 3, 4, 5, 6
  - **Blocked By**: None

  **References**:
  - Research: `bin` field in package.json must point to file with `#!/usr/bin/env node` shebang
  - Research: `@commander-js/extra-typings` provides typed `Command` class for Commander.js

  **Acceptance Criteria**:
  - [ ] `package.json` has name, bin, commander + zod deps
  - [ ] `tsconfig.json` has strict mode
  - [ ] Directory structure created (kernel, services, platform, output, modules/setup, config)
  - [ ] `bun test` runs (0 tests, 0 failures)
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios:**
  ```
  Scenario: Project scaffolding complete
    Tool: Bash
    Steps:
      1. Run `npx tsc --noEmit` → exit code 0
      2. Run `ls src/kernel src/services src/platform src/output src/modules/setup src/config`
      3. Assert all directories exist
      4. Run `grep '"devcli"' package.json` → found
    Expected Result: Full directory structure, tsc passes
    Evidence: .sisyphus/evidence/task-1-scaffold.txt
  ```

  **Commit**: YES (Wave 1)
  - Message: `chore: scaffold devcli project with micro-kernel directory structure`
  - Files: `package.json, tsconfig.json, .gitignore, bin/devcli.ts`

- [x] 2. Kernel Types: Module, Command, ServiceContainer Interfaces

  **What to do**:
  - Create `src/kernel/types.ts`:
    - `DevcliModule` interface: `{ name, description, register(program: Command, services: ServiceContainer): void }`
    - `ServiceContainer` interface with method signatures: `getProcessRunner()`, `getConfigLoader()`, `getPrompter()`, `getFileSystem()`, `getPlatformDetector()`, `getFormatter()`
    - `Platform` type: `'windows' | 'wsl1' | 'wsl2' | 'macos' | 'linux'`
    - `PlatformInfo` interface: `{ platform, shell, packageManager, isWSL }`
    - `CheckResult` interface: `{ toolName, installed, configured, version?, message }`
    - `InstallResult` interface: `{ toolName, success, message }`
  - Create `src/kernel/types.test.ts` with TDD:
    - Test: DevcliModule shape is valid (has name, description, register)
    - Test: ServiceContainer interface has all required methods
    - Test: CheckResult and InstallResult have required fields

  **Must NOT do**:
  - Do NOT create `src/kernel/service-container.ts` — that's Task 6
  - Do NOT create `src/kernel/module-loader.ts` — that's Task 6
  - Do NOT implement any services — only interfaces and type definitions

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with 3, 4, 5)
  - **Blocks**: 6, 7, 8, 9, 10
  - **Blocked By**: 1

  **References**:
  - Research (gh CLI): `cmdutil.Factory` — central DI container with lazy initialization
  - Research (Metis): DI pattern with injected interfaces for all subprocess/fs/network operations

  **Acceptance Criteria**:
  **TDD**:
  - [ ] `src/kernel/types.test.ts` created
  - [ ] `bun test src/kernel/types.test.ts` → PASS

  **QA Scenarios:**
  ```
  Scenario: Kernel types are valid
    Tool: Bash
    Steps:
      1. `npx tsc --noEmit` → exit 0
      2. `bun test src/kernel/types.test.ts` → all pass
    Evidence: .sisyphus/evidence/task-2-kernel-types.txt
  ```

  **Commit**: YES (Wave 1)
  - Message: `feat: define kernel types — Module, Command, ServiceContainer interfaces`

- [x] 3. Platform Detector

  **What to do**:
  - Create `src/platform/detector.ts`:
    - `detectPlatform(deps: { env: Record<string, string>, readFile: (path: string) => Promise<string> }): PlatformInfo`
    - Detection: `process.platform` → win32/darwin/linux, then WSL detection via `WSL_DISTRO_NAME` env or `/proc/version` for "Microsoft"
    - `PlatformInfo`: `{ platform: Platform, shell: string, packageManager: string, isWSL: boolean }`
  - Create `src/platform/detector.test.ts` with TDD:
    - Test: macOS, Windows native, WSL2, WSL1, Linux
    - Test: shell detection (SHELL env var on Unix, PowerShell on Windows)
    - Test: package manager detection (brew/winget/apt)
  - Export via `src/platform/index.ts`

  **Must NOT do**:
  - Do NOT call `fs.readFileSync` directly — use injected reader

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with 2, 4, 5, 6)
  - **Blocks**: 11, 12, 13, 14
  - **Blocked By**: 1

  **References**:
  - Research (Metis): WSL detection is non-trivial — check `WSL_DISTRO_NAME` then `/proc/version`

  **Acceptance Criteria**:
  **TDD**:
  - [ ] `src/platform/detector.test.ts` → PASS (5 platform tests)

  **QA Scenarios:**
  ```
  Scenario: All platforms detected
    Tool: Bash
    Steps:
      1. `bun test src/platform/detector.test.ts` → "5 pass"
    Evidence: .sisyphus/evidence/task-3-platform.txt
  ```

  **Commit**: YES (Wave 1)
  - Message: `feat: add platform detection for Windows/WSL1/WSL2/macOS/Linux`

- [x] 4. Output/Formatting Module

  **What to do**:
  - Create `src/output/formatter.ts`: `Formatter` class for TTY-aware output
  - Methods: `success(msg)`, `error(msg)`, `warn(msg)`, `info(msg)` with ANSI colors (✓ green, ✗ red, ⚠ yellow, ℹ blue)
  - Method: `table(headers, rows)` for tool status display
  - Method: `json(data)` for `--json` flag (`JSON.stringify(data, null, 2)`)
  - Method: `section(title)` for grouping output
  - TTY detection: `process.stdout.isTTY` — disable colors when piped
  - Create `src/output/formatter.test.ts` with TDD:
    - Test: colored output when TTY, plain when not
    - Test: table formatting
    - Test: JSON output is valid and parseable

  **Must NOT do**:
  - Do NOT add a formatting library dependency — use simple ANSI codes

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: 16
  - **Blocked By**: 1

  **Acceptance Criteria**:
  **TDD**:
  - [ ] `src/output/formatter.test.ts` → PASS (4+ tests)

  **QA Scenarios:**
  ```
  Scenario: Formatter works with and without TTY
    Tool: Bash
    Steps:
      1. `bun test src/output/formatter.test.ts` → all pass
    Evidence: .sisyphus/evidence/task-4-formatter.txt
  ```

  **Commit**: YES (Wave 1)

- [x] 5. Remote Config Schema + Bundled Defaults

  **What to do**:
  - Create `src/config/schema.ts`: Zod schema for remote config
  - Schema: `{ version: string, tools: Array<{ name, displayName, minVersion?, installMethod? }> }`
  - Create `src/config/defaults.ts`: Bundled default config with 4 tools (nvm, azure-cli, copilot, opencode)
  - Export types via `z.infer<typeof RemoteConfigSchema>`
  - Create `src/config/schema.test.ts` with TDD:
    - Test: valid config parses
    - Test: invalid config rejected (missing fields)
    - Test: bundled defaults pass validation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: 8
  - **Blocked By**: 1

  **Acceptance Criteria**:
  **TDD**:
  - [ ] `src/config/schema.test.ts` → PASS (3+ tests)

  **QA Scenarios:**
  ```
  Scenario: Bundled defaults are valid against schema
    Tool: Bash
    Steps:
      1. `bun -e "import {defaults} from './src/config/defaults'; import {RemoteConfigSchema} from './src/config/schema'; RemoteConfigSchema.parse(defaults); console.log('valid')"` → "valid"
    Evidence: .sisyphus/evidence/task-5-defaults.txt
  ```

  **Commit**: YES (Wave 1)

- [x] 6. Kernel Core: ServiceContainer Impl + ModuleLoader

  **What to do**:
  - Create `src/kernel/service-container.ts`: `ServiceContainerImpl` implementing `ServiceContainer` interface from Task 2
    - Accept service factories via constructor (lazy init pattern)
    - Methods: `getProcessRunner()`, `getConfigLoader()`, `getPrompter()`, `getFileSystem()`, `getPlatformDetector()`, `getFormatter()`
    - Each getter lazy-inits on first call (factory function stored, not the instance)
  - Create `src/kernel/module-loader.ts`: `ModuleLoader`
    - Maintains explicit list of known modules (import from `src/modules/*/index.ts`)
    - `loadAll(): DevcliModule[]` — returns all known module instances
    - `registerAll(program, services)` — iterates modules, calls each `register(program, services)`
  - Create `src/kernel/service-container.test.ts`:
    - Test: lazy init (factory called only once, on first get)
    - Test: multiple gets return same instance
    - Test: all service getters return correct type
  - Create `src/kernel/module-loader.test.ts`:
    - Test: loadAll returns modules with correct shape
    - Test: registerAll calls register on each module with program + services

  **Must NOT do**:
  - Do NOT use dynamic `import()` for module discovery — use explicit import list
  - Do NOT implement a plugin system — modules are compiled into the binary
  - Do NOT create `src/kernel/types.ts` — that's Task 2

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 2)
  - **Parallel Group**: Wave 2 (with 7, 8, 9, 10)
  - **Blocks**: 11, 18
  - **Blocked By**: 2

  **References**:
  - Research (gh CLI): Factory pattern — central DI container with lazy init
  - The module interface is inspired by `gh`'s extension system but simpler (compiled-in, not runtime-loaded)

  **WHY Each Reference Matters**:
  - The ServiceContainer is the backbone of the micro-kernel — all modules depend on it for shared services
  - ModuleLoader auto-discovery means adding a new module = adding a directory + index.ts, zero kernel changes

  **Acceptance Criteria**:
  **TDD**:
  - [ ] `src/kernel/types.test.ts` → PASS (module interface contract)
  - [ ] `src/kernel/service-container.test.ts` → PASS (3+ tests: register, get, lazy init)
  - [ ] `src/kernel/module-loader.test.ts` → PASS (2+ tests: discover, register)

  **QA Scenarios:**
  ```
  Scenario: Module auto-discovery works
    Tool: Bash
    Steps:
      1. `bun test src/kernel/` → all pass
      2. Verify test creates a mock module directory and ModuleLoader discovers it
    Evidence: .sisyphus/evidence/task-6-kernel.txt

  Scenario: ServiceContainer lazy-inits services
    Tool: Bash
    Steps:
      1. Verify service-container test shows lazy init (service factory called only on first get)
    Evidence: .sisyphus/evidence/task-6-container.txt
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat: implement micro-kernel with ServiceContainer and ModuleLoader`

- [x] 7. ProcessRunner Service

  **What to do**:
  - Create `src/services/process-runner.ts`: `ProcessRunner` interface
  - Create `src/services/process-runner.impl.ts`: `RealProcessRunner` using `child_process.spawn` (NOT Bun.spawn)
  - Create `src/services/process-runner.mock.ts`: `MockProcessRunner` (pre-programmed responses)
  - Features: capture mode (stdout/stderr), inherit mode (interactive), signal forwarding (SIGINT/SIGTERM), timeout support (60s check, 300s install)
  - Create `src/services/process-runner.test.ts`:
    - Test: successful execution + captured output
    - Test: non-zero exit code
    - Test: timeout kills process
    - Test: mock returns pre-programmed responses

  **Must NOT do**: Do NOT use `Bun.spawn` or `Bun.$`. Do NOT use `exec`/`execSync`.

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 2, parallel with 8,9,10. Blocks: 12-15. Blocked by: 2.

  **Acceptance Criteria**:
  - [ ] `bun test src/services/process-runner.test.ts` → PASS (4 tests)
  - [ ] `grep "Bun\\.spawn\|Bun\\.\\$" src/services/process-runner.impl.ts` → exit code 1 (no matches)

  **QA Scenarios:**
  ```
  Scenario: ProcessRunner spawns and captures output
    Tool: Bash
    Steps:
      1. `bun test src/services/process-runner.test.ts` → "4 pass" and "0 fail"
    Expected Result: All spawn, capture, timeout, and mock tests pass
    Evidence: .sisyphus/evidence/task-7-process-runner.txt

  Scenario: No Bun-specific APIs used
    Tool: Bash
    Steps:
      1. `grep -r "Bun\\.spawn\\|Bun\\.\\$\\|Bun\\.file" src/services/process-runner.impl.ts` → exit code 1
    Expected Result: Zero matches — only child_process used
    Evidence: .sisyphus/evidence/task-7-no-bun.txt
  ```

- [x] 8. ConfigLoader Service

  **What to do**:
  - Create `src/services/config-loader.ts`: `ConfigLoader` interface (async `load()` method returning validated `RemoteConfig`)
  - Create `src/services/config-loader.impl.ts`: `RealConfigLoader`
    - Fetch remote config from configurable GitHub raw URL (env var `DEVCLI_CONFIG_URL`)
    - Validate with Zod schema (from Task 5)
    - Local cache at `~/.devcli/config-cache.json`
    - Fallback chain: try remote → try cache → use bundled defaults (from Task 5)
    - Cache TTL: 1 hour (configurable via env var)
    - Accept injected `fetch` function via constructor for testability
  - Create `src/services/config-loader.mock.ts`: `MockConfigLoader`
  - Create `src/services/config-loader.test.ts`:
    - Test: remote fetch success → valid config returned
    - Test: remote fetch fails → falls back to cached config
    - Test: cache miss → falls back to bundled defaults
    - Test: invalid remote config (fails Zod) → rejected, falls back
    - Test: successful fetch writes to cache

  **Must NOT do**: Do NOT use `Bun.file`. Do NOT call `fetch` directly — inject via constructor.

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 2, parallel with 7,9,10. Blocks: 16. Blocked by: 2, 5.

  **Acceptance Criteria**:
  - [ ] `bun test src/services/config-loader.test.ts` → PASS (5 tests)
  - [ ] `grep "Bun\\.file" src/services/config-loader.impl.ts` → exit code 1

  **QA Scenarios:**
  ```
  Scenario: Full fallback chain works
    Tool: Bash
    Steps:
      1. `bun test src/services/config-loader.test.ts` → "5 pass" and "0 fail"
    Expected Result: Remote success, remote fail→cache, cache miss→defaults, invalid rejection, cache write all pass
    Evidence: .sisyphus/evidence/task-8-config-loader.txt

  Scenario: No Bun.file usage
    Tool: Bash
    Steps:
      1. `grep "Bun\\.file" src/services/config-loader.impl.ts` → exit code 1
    Expected Result: Only fs.promises used, no Bun APIs
    Evidence: .sisyphus/evidence/task-8-no-bun.txt
  ```

- [x] 9. Prompter Service

  **What to do**:
  - Create `src/services/prompter.ts`: `Prompter` interface (`confirm(message): Promise<boolean>`, `select(message, choices): Promise<string>`)
  - Create `src/services/prompter.impl.ts`: `RealPrompter` using Node.js `readline` (NOT Bun-specific)
  - Create `src/services/prompter.mock.ts`: `MockPrompter`
  - Constructor accepts `yesMode: boolean` — when true, `confirm()` returns true, `select()` returns first choice
  - Create `src/services/prompter.test.ts`:
    - Test: confirm with 'y' returns true
    - Test: confirm with 'n' returns false
    - Test: select with valid choice returns correct value
    - Test: yesMode=true auto-confirms without prompting

  **Must NOT do**: Do NOT use Bun-specific readline APIs. Do NOT use inquirer or heavy prompt libraries.

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 2, parallel with 7,8,10. Blocks: 14,16,17. Blocked by: 2.

  **Acceptance Criteria**:
  - [ ] `bun test src/services/prompter.test.ts` → PASS (4 tests)

  **QA Scenarios:**
  ```
  Scenario: Prompter handles interactive and auto-confirm modes
    Tool: Bash
    Steps:
      1. `bun test src/services/prompter.test.ts` → "4 pass" and "0 fail"
    Expected Result: Interactive and --yes mode both tested
    Evidence: .sisyphus/evidence/task-9-prompter.txt
  ```

- [x] 10. FileSystem Service

  **What to do**:
  - Create `src/services/file-system.ts`: `FileSystem` interface (`exists(path)`, `readFile(path)`, `writeFile(path, content)`, `mkdirp(path)`)
  - Create `src/services/file-system.impl.ts`: `RealFileSystem` using `fs.promises` (NOT Bun.file)
  - Create `src/services/file-system.mock.ts`: `MockFileSystem` (in-memory Map)
  - Create `src/services/file-system.test.ts`:
    - Test: write → read roundtrip (use `os.tmpdir()`)
    - Test: exists returns false for non-existent file
    - Test: mkdirp creates nested directories
    - Test: readFile throws for non-existent file

  **Must NOT do**: Do NOT use `Bun.file`, `Bun.write`, or any Bun-specific file APIs.

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 2, parallel with 7,8,9. Blocks: 15. Blocked by: 2.

  **Acceptance Criteria**:
  - [ ] `bun test src/services/file-system.test.ts` → PASS (4 tests)

  **QA Scenarios:**
  ```
  Scenario: FileSystem operations work correctly
    Tool: Bash
    Steps:
      1. `bun test src/services/file-system.test.ts` → "4 pass" and "0 fail"
    Expected Result: exists, read, write, mkdirp all work correctly
    Evidence: .sisyphus/evidence/task-10-filesystem.txt

  Scenario: No Bun.file usage detected
    Tool: Bash
    Steps:
      1. `grep -r "Bun\\.file\\|Bun\\.write\\|Bun\\.spawn" src/services/file-system.impl.ts` → exit code 1
    Expected Result: Only fs.promises used, no Bun APIs
    Evidence: .sisyphus/evidence/task-10-no-bun.txt
  ```

- [x] 11. Tool Registry Pattern

  **What to do**:
  - Create `src/modules/setup/tools/registry.ts`: `ToolRegistry` class
  - Methods: `register(tool)`, `get(name)`, `getAll()`
  - `ToolModule` interface: `{ name, displayName, check(runner, platform), Promise<CheckResult>, install(runner, prompter, platform): Promise<InstallResult> }`
  - Create `src/modules/setup/tools/registry.test.ts` with TDD:
    - Test: register + get returns correct tool
    - Test: get unknown tool name throws descriptive error
    - Test: getAll returns all registered tools
    - Test: duplicate registration overwrites previous

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 3, parallel with 12-15. Blocks: 12-15. Blocked by: 2.

  **Acceptance Criteria**:
  - [ ] `bun test src/modules/setup/tools/registry.test.ts` → PASS (4 tests)

  **QA Scenarios:**
  ```
  Scenario: Tool registry CRUD operations work
    Tool: Bash
    Steps:
      1. `bun test src/modules/setup/tools/registry.test.ts` → "4 pass" and "0 fail"
    Expected Result: Register, get, getAll, duplicate handling all work correctly
    Evidence: .sisyphus/evidence/task-11-registry.txt
  ```

- [x] 12. nvm Module: Checker + Installer

  **What to do**:
  - Create `src/modules/setup/tools/nvm/nvm.ts`: `NvmTool` implementing `ToolModule`
  - **Checker**:
    - Unix/macOS: `nvm --version`; Windows (nvm-windows): `nvm version`
    - Configured: `nvm current` (Unix) / `nvm list` (Windows) — "none"/"N/A" = not configured
  - **Installer**:
    - macOS/WSL: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash` + guard-block shell profile update (`# >>> devcli-nvm >>>` / `# <<< devcli-nvm <<<`)
    - Windows: `winget install CoreyButler.NVMforWindows`
    - Post-install: verify `nvm --version`
  - Create `src/modules/setup/tools/nvm/nvm.test.ts` with TDD:
    - Test: installed+configured, installed+not-configured, not-installed
    - Test: macOS installer, Windows installer
    - Test: idempotent (install twice = same result)

  **Must NOT do**: Do NOT call child_process.spawn directly. Do NOT modify shell profile without guard-blocks. Do NOT install Node versions.

  **Recommended Agent Profile**: `deep` — nvm vs nvm-windows divergence is significant
  **Parallelization**: Wave 3, parallel with 13, 14, 15. Blocked by: 3, 7, 11.

  **References**:
  - Research (Metis): nvm-windows uses `NVM_HOME`/`NVM_SYMLINK` registry vars, different commands
  - `src/modules/setup/tools/registry.ts` (Task 11): `ToolModule` interface

  **Acceptance Criteria**:
  - [ ] Tests pass (6 tests)

  **QA Scenarios:**
  ```
  Scenario: nvm checker handles all platform states
    Tool: Bash
    Steps:
      1. `bun test src/modules/setup/tools/nvm/` → all pass
    Evidence: .sisyphus/evidence/task-12-nvm.txt
  Scenario: No direct child_process usage
    Tool: Bash
    Steps:
      1. `grep "child_process" src/modules/setup/tools/nvm/nvm.ts` → exit code 1
    Evidence: .sisyphus/evidence/task-12-nvm-di.txt
  ```

- [x] 13. azure-cli Module: Checker + Installer

  **What to do**:
  - Create `src/modules/setup/tools/azure/azure.ts`: `AzureTool` implementing `ToolModule`
  - **Checker**: `az --version` for installed; `az account show` JSON with `id` field for configured; handle expired tokens
  - **Installer**: macOS `brew install azure-cli`; Windows `winget install Microsoft.AzureCLI`; Linux/WSL `curl -sL https://aka.ms/InstallAzureCLIDeb | bash`
  - Create `src/modules/setup/tools/azure/azure.test.ts`: 5 tests (installed+configured, installed+not-configured, not-installed, platform installers, expired token)

  **Must NOT do**: Do NOT call `az login` automatically.

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 3, parallel with 12, 14, 15. Blocked by: 3, 7, 11.

  **Acceptance Criteria**:
  - [ ] Tests pass (5 tests)

  **QA Scenarios:**
  ```
  Scenario: azure-cli checker handles all states including expired tokens
    Tool: Bash
    Steps:
      1. `bun test src/modules/setup/tools/azure/` → "5 pass" and "0 fail"
    Expected Result: installed, not-installed, expired token, and platform installers all pass
    Evidence: .sisyphus/evidence/task-13-azure.txt

 ```

- [x] 14. copilot Module: Checker + Installer

  **What to do**:
  - Create `src/modules/setup/tools/copilot/copilot.ts`: `CopilotTool` implementing `ToolModule`
  - **Checker**: Check both `gh copilot --version` (extension) and `which github-copilot-cli` (standalone). Configured: `gh auth status` shows "Logged in"
  - **Installer**: If gh installed → `gh extension install github/gh-copilot`. If not → install gh first (brew/winget/apt)
  - Create `src/modules/setup/tools/copilot/copilot.test.ts`: 5 tests (extension path, standalone path, missing, unconfigured, gh missing)

  **Recommended Agent Profile**: `deep` — dual install path + gh dependency
  **Parallelization**: Wave 3, parallel with 12, 13, 15. Blocked by: 3, 7, 9, 11.

  **Acceptance Criteria**:
  - [ ] Tests pass (5 tests)

  **QA Scenarios:**
  ```
  Scenario: copilot dual install path detection
    Tool: Bash
    Steps:
      1. `bun test src/modules/setup/tools/copilot/` → "5 pass" and "0 fail"
    Expected Result: Extension path, standalone path, missing, unconfigured, gh missing all detected
    Evidence: .sisyphus/evidence/task-14-copilot.txt
  ```

- [x] 15. opencode Module: Checker + Installer

  **What to do**:
  - Create `src/modules/setup/tools/opencode/opencode.ts`: `OpencodeTool` implementing `ToolModule`
  - **Checker**: `opencode --version` for installed. Configured: config file exists at `~/.config/opencode/opencode.json` (use injected FileSystem). No env var checks — only check the file.
  - **Installer**: `npm install -g opencode` (cross-platform, Node.js is prerequisite since devcli itself needs it)
  - Create `src/modules/setup/tools/opencode/opencode.test.ts`: 4 tests (installed+configured, installed+not-configured, not-installed, platform installers)

  **Must NOT do**: Do NOT check OPENCODE_API_KEY or any env var. Do NOT create opencode config files.

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 3, parallel with 12, 13, 14. Blocked by: 3, 7, 10, 11.

  **Acceptance Criteria**:
  - [ ] Tests pass (4 tests)

  **QA Scenarios:**
  ```
  Scenario: opencode checker handles file-based config check only
    Tool: Bash
    Steps:
      1. `bun test src/modules/setup/tools/opencode/` → "4 pass" and "0 fail"
    Expected Result: Installed+configured, installed+not-configured, not-installed, install-via-npm all pass
    Evidence: .sisyphus/evidence/task-15-opencode.txt

  Scenario: No env var checks in opencode module
    Tool: Bash
    Steps:
      1. `grep -r "OPENCODE_API_KEY\|OPENCODE.*KEY" src/modules/setup/tools/opencode/` → exit code 1
    Expected Result: Zero references to env var API keys
    Evidence: .sisyphus/evidence/task-15-no-envvar.txt
  ```

- [x] 16. `setup doctor` Command

  **What to do**:
  - Create `src/modules/setup/commands/doctor.ts`: DoctorCommand
  - Wire up: ConfigLoader → load config → PlatformDetector → detect platform → for each tool in registry → run checker → collect results → format output → optionally install
  - Flags: `--json` (machine output), `--yes` (auto-install), `--tool <name>` (check single tool)
  - Flow:
    1. Load config via ConfigLoader (from ServiceContainer)
    2. Detect platform via PlatformDetector
    3. For each tool: run checker → collect CheckResult
    4. Display table via Formatter (or JSON if --json)
    5. If issues and not --json: prompt to install (or auto if --yes)
    6. Run installers for selected tools
    7. Display final status
    8. Exit: 0 if all good, 1 if issues remain
  - Create `src/modules/setup/commands/doctor.test.ts` with TDD:
    - Test: all tools OK → exit 0, table shows all ✓
    - Test: one tool missing → offers install → installs → exit 0
    - Test: --json → valid JSON with correct structure
    - Test: --yes → auto-installs without prompt
    - Test: --tool nvm → only checks nvm
    - Test: config load failure → falls back to defaults, still runs
    - Test: install fails → exit 1, shows error

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 4, parallel with 17. Blocks: 18. Blocked by: 12-15, 4, 8, 9.

  **Acceptance Criteria**:
  - [ ] Tests pass (7 tests)

  **QA Scenarios:**
  ```
  Scenario: Doctor with all tools mocked as installed
    Tool: Bash
    Steps:
      1. `bun test src/modules/setup/commands/doctor.test.ts` → all pass
    Evidence: .sisyphus/evidence/task-16-doctor.txt

  Scenario: Doctor --json produces valid JSON
    Tool: Bash
    Steps:
      1. Run doctor with --json flag and mock ProcessRunner
      2. Parse output as JSON
      3. Assert structure: {tools: [{name, installed, configured}]}
    Evidence: .sisyphus/evidence/task-16-doctor-json.txt
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat: implement setup doctor command with --json, --yes, --tool flags`

- [x] 17. `setup install` Command

  **What to do**:
  - Create `src/modules/setup/commands/install.ts`: InstallCommand
  - Takes optional argument: tool name (if omitted, install all missing)
  - Wire up: PlatformDetector → check tool → if missing, install via ToolModule.install → verify
  - Flags: `--yes` (skip confirm, just install), `--force` (reinstall even if already installed)
  - Create `src/modules/setup/commands/install.test.ts` with TDD:
    - Test: install specific tool (nvm) → runs installer
    - Test: install all (no arg) → installs all missing tools
    - Test: install already-installed tool → skips unless --force
    - Test: --yes → no confirmation prompt
    - Test: unknown tool name → error message

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 4, parallel with 16. Blocks: 18. Blocked by: 12-15, 7, 9.

  **Acceptance Criteria**:
  - [ ] Tests pass (5 tests)

  **QA Scenarios:**
  ```
  Scenario: Install a specific missing tool
    Tool: Bash
    Preconditions: Mock ProcessRunner returns "not found" for `nvm --version`, returns 0 for install commands
    Steps:
      1. `bun run bin/devcli.ts setup install nvm --yes` → exit 0
      2. stdout contains "Installing nvm"
      3. stdout contains "nvm installed successfully"
    Expected Result: Install command executes, verification passes
    Failure Indicators: Exit code non-zero, "already installed" when mocked as missing
    Evidence: .sisyphus/evidence/task-17-install-specific.txt

  Scenario: Install already-installed tool without --force
    Tool: Bash
    Preconditions: Mock ProcessRunner returns "0.39.0" for `nvm --version` (tool present)
    Steps:
      1. `bun run bin/devcli.ts setup install nvm` → exit 0
      2. stdout contains "already installed"
      3. stdout does NOT contain "Installing"
    Expected Result: Skips install, reports already installed
    Failure Indicators: Attempts to reinstall, exits with error
    Evidence: .sisyphus/evidence/task-17-install-skip.txt

  Scenario: Unknown tool name produces clear error
    Tool: Bash
    Steps:
      1. `bun run bin/devcli.ts setup install nonexistent-tool` → exit 1
      2. stderr or stdout contains "Unknown tool"
    Expected Result: Error message with list of valid tool names
    Failure Indicators: Exit 0, silent failure, unhandled exception
    Evidence: .sisyphus/evidence/task-17-install-unknown-error.txt
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat: implement setup install command with --yes and --force flags`

- [x] 18. Setup Module Registration

  **What to do**:
  - Create `src/modules/setup/index.ts`: Setup module registration
  - Export `DevcliModule` with:
    - name: 'setup'
    - description: 'Developer environment setup and verification'
    - registerCommands(program, services): registers `doctor` and `install` subcommands under the `setup` command group
  - Register all 4 tools in the ToolRegistry within the module
  - Create `src/modules/setup/index.test.ts`: verify module exports correct shape, commands register properly

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 4 (starts after T16+T17 complete). Blocks: 20. Blocked by: 16, 17.

  **Acceptance Criteria**:
  - [ ] Tests pass (2+ tests)

  **QA Scenarios:**
  ```
  Scenario: Setup module registers doctor and install subcommands
    Tool: Bash
    Preconditions: All dependencies built (kernel, tools, commands)
    Steps:
      1. `bun run bin/devcli.ts setup --help` → exit 0
      2. stdout contains "doctor"
      3. stdout contains "install"
    Expected Result: `setup` command group shows both subcommands in help output
    Failure Indicators: Missing subcommand, "unknown command", exit non-zero
    Evidence: .sisyphus/evidence/task-18-module-registration.txt

  Scenario: Module exports correct shape and registers all 4 tools
    Tool: Bash
    Preconditions: Test file exists at src/modules/setup/index.test.ts
    Steps:
      1. `bun test src/modules/setup/index.test.ts` → exit 0
      2. All tests pass (verifies: module.name === "setup", module.registerCommands is a function, ToolRegistry has nvm/azure/copilot/opencode)
    Expected Result: Module interface matches DevcliModule type, all 4 tools registered
    Failure Indicators: Missing tool in registry, wrong module name, registerCommands not a function
    Evidence: .sisyphus/evidence/task-18-module-shape.txt
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat: register setup module with doctor and install commands`

- [x] 19. Shell Completion Command

  **What to do**:
  - Create `src/commands/completion.ts`: completion command (NOT a module — built-in kernel command)
  - Generate shell completion scripts for: bash, zsh, fish, PowerShell
  - Completion includes: `setup` (with subcommands doctor/install), `completion` (with shells), `--version`, `--help`
  - Use Commander.js `.command()` for registration (not module system)
  - Create `src/commands/completion.test.ts`:
    - Test: bash output contains `complete -F _devcli devcli`
    - Test: zsh output contains `#compdef devcli`
    - Test: fish output contains `complete -c devcli`
    - Test: PowerShell output contains `Register-ArgumentCompleter`
    - Test: invalid shell → error

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 4, parallel with 16, 17, 18. Blocks: 20. Blocked by: 2.

  **Acceptance Criteria**:
  - [ ] Tests pass (5 tests)

  **QA Scenarios:**
  ```
  Scenario: Completion scripts syntax-valid
    Tool: Bash
    Steps:
      1. `bun run bin/devcli.ts completion bash | bash -n` → exit 0
      2. `bun run bin/devcli.ts completion zsh` → contains "#compdef devcli"
      3. `bun run bin/devcli.ts completion fish` → contains "complete -c devcli"
      4. `bun run bin/devcli.ts completion powershell` → contains "Register-ArgumentCompleter"
    Evidence: .sisyphus/evidence/task-19-completion.txt
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat: add shell completion generation for bash, zsh, fish, PowerShell`

- [x] 20. CLI Entry Point + Integration Tests

  **What to do**:
  - Update `bin/devcli.ts`: real CLI entry point
  - Wire up micro-kernel:
    1. Create ServiceContainer with all services
    2. Create ModuleLoader, discover modules from `src/modules/*/index.ts`
    3. Create Commander program with --version and --help
    4. Register completion command (built-in)
    5. For each discovered module: call `registerCommands(program, services)`
    6. Parse argv and execute
  - Use `program.exitOverride()` + `program.configureOutput()` for testability
  - Create `src/cli.ts`: `createProgram(deps)` factory function
  - Create `tests/integration/cli.integration.test.ts`:
    - Test: `--version` prints version
    - Test: `--help` shows setup + completion
    - Test: `setup --help` shows doctor + install
    - Test: `setup doctor --json` with all tools mocked
    - Test: `setup install nvm` with mock
    - Test: `completion bash` generates valid script
    - Test: Module auto-discovery (kernel finds setup module)
  - Verify `package.json` bin/files/engines fields correct
  - Verify `npm pack --dry-run` includes correct files
  - Run `bun test` (all unit + integration)
  - Run `npx tsc --noEmit` (0 errors)

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Sequential (final task). Blocks: F1-F4. Blocked by: 18, 19.

  **Acceptance Criteria**:
  - [ ] `bun test` → 0 failures (all unit + integration)
  - [ ] `npx tsc --noEmit` → 0 errors
  - [ ] `npm install -g .` + `devcli --version` → prints version
  - [ ] `devcli setup --help` → shows doctor + install
  - [ ] `npm pack --dry-run` → correct files listed

  **QA Scenarios:**
  ```
  Scenario: Full CLI end-to-end
    Tool: Bash
    Steps:
      1. `npm install -g .` → exit 0
      2. `devcli --version` → prints version
      3. `devcli --help` → contains "setup" and "completion"
      4. `devcli setup --help` → contains "doctor" and "install"
      5. `devcli setup doctor --json` → valid JSON with tools array
      6. `devcli completion bash | bash -n` → exit 0
      7. `bun test` → 0 fail
      8. `npx tsc --noEmit` → 0 errors
    Evidence: .sisyphus/evidence/task-20-e2e.txt

  Scenario: Module auto-discovery verified
    Tool: Bash
    Steps:
      1. Run integration test that verifies setup module was auto-discovered
      2. `grep "modules/setup/index" src/kernel/module-loader.ts` or similar → auto-discovery pattern
    Evidence: .sisyphus/evidence/task-20-discovery.txt

  Scenario: Package is correctly configured
    Tool: Bash
    Steps:
      1. `npm pack --dry-run 2>&1` → contains source files, NOT test files or .sisyphus/
    Evidence: .sisyphus/evidence/task-20-packaging.txt
  ```

  **Commit**: YES
  - Message: `feat: wire CLI entry point with micro-kernel, auto-discovery, and integration tests`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Specifically verify: micro-kernel architecture (ServiceContainer, ModuleLoader, auto-discovery), module auto-registration works, no Bun APIs. Check evidence files.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + `bun test`. Review all files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, unused imports. Verify NO Bun-specific APIs (grep `Bun.spawn`, `Bun.file`, `Bun.$`). Check DI boundaries: business logic files should NOT import from `child_process`, `fs`, or global `fetch` directly.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Execute EVERY QA scenario from EVERY task. Test: `devcli setup doctor` (all tools mocked as missing, all present, partial), `devcli setup install`, `devcli setup install nvm`, `devcli setup doctor --json`, `devcli setup doctor --yes`, `devcli completion bash|zsh|fish|powershell`. Verify module auto-discovery (remove a module, run, confirm commands gone).
  Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify: micro-kernel architecture (not flat), module auto-discovery works, setup module is the ONLY module (no proxy, no config module), no Bun APIs, no plugin system beyond module pattern. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Architecture [micro-kernel ✅ | flat ❌] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `chore: scaffold devcli project with micro-kernel architecture`
- **Wave 2**: `feat: implement kernel services (ProcessRunner, ConfigLoader, Prompter, FileSystem)`
- **Wave 3**: `feat: add tool checker and installer modules (nvm, azure, copilot, opencode)`
- **Wave 4**: `feat: implement setup module with doctor and install commands`
- **Final**: `feat: complete devcli with integration tests and npm packaging`

---

## Success Criteria

### Verification Commands
```bash
npm install -g .                          # Expected: installs successfully
devcli --version                          # Expected: prints version
devcli --help                             # Expected: shows setup + completion
devcli setup --help                       # Expected: shows doctor + install
devcli setup doctor                       # Expected: checks all 4 tools
devcli setup doctor --json                # Expected: valid JSON
devcli setup doctor --yes                 # Expected: auto-installs
devcli setup doctor --tool nvm            # Expected: only checks nvm
devcli setup install                      # Expected: offers to install all missing
devcli setup install nvm                  # Expected: installs nvm only
devcli completion bash                    # Expected: valid bash completion
devcli completion zsh                     # Expected: #compdef devcli
devcli completion fish                    # Expected: complete -c devcli
devcli completion powershell              # Expected: Register-ArgumentCompleter
bun test                                  # Expected: all pass, 0 fail
npx tsc --noEmit                          # Expected: 0 errors
```

### Architecture Verification
```bash
# Verify micro-kernel: module auto-discovery works
grep -r "registerModule\|ModuleLoader" src/kernel/   # Expected: found
grep -r "modules/.*/index.ts" src/kernel/            # Expected: auto-discovery pattern
# Verify no flat command registration
grep "program.command.*doctor" bin/devcli.ts          # Expected: NOT found (module registers it)
```

### Final Checklist
- [ ] All "Must Have" present (micro-kernel, module auto-discovery, setup module)
- [ ] All "Must NOT Have" absent (no Bun APIs, no proxy, no plugin system)
- [ ] All tests pass (`bun test`)
- [ ] Type checking passes (`npx tsc --noEmit`)
- [ ] Works on Node.js (not just Bun)
- [ ] Module auto-discovery works (kernel finds setup module automatically)
