# Shift-Left Git Hooks Design

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Local quality gates via git hooks

## Problem

The devcli project has 20 test files, strict TypeScript configuration, and zero automated quality enforcement in the developer workflow. Linting, formatting, and type errors are caught manually or not at all. There is no linter, no formatter, and no git hooks configured.

## Solution

Add shift-left quality gates that run automatically on git operations. Three hooks provide tiered checking:

- **pre-commit**: Fast checks on staged files only (lint + format via Biome)
- **commit-msg**: Commit message convention validation (commitlint)
- **pre-push**: Full project verification (typecheck + test suite)

## Architecture

```
Developer → git commit ─┬─→ pre-commit  → lint-staged → Biome (staged .ts files)
                        └─→ commit-msg  → commitlint  (conventional format)

Developer → git push ────→ pre-push     → tsc --noEmit + bun test (full codebase)
```

### Bypass Mechanism

All hooks respect:
- `git commit --no-verify` / `git push --no-verify` — skip hooks for emergencies
- `HUSKY=0` env var — disable Husky entirely (for CI environments)

## Tool Choices

| Tool | Role | Why |
|------|------|-----|
| Biome | Lint + format | All-in-one Rust-based tool. Replaces ESLint + Prettier with a single dependency. Fast enough for interactive use. |
| Husky | Git hooks management | Industry standard. Hooks version-controlled in `.husky/` directory. Installed via `prepare` script. |
| lint-staged | Staged-file filtering | Runs linters only on files about to be committed. Keeps pre-commit fast (1-3 seconds). |
| commitlint + config-conventional | Commit message validation | Enforces conventional commit format. Enables clean git history and future changelog generation. |

## Hook Details

### pre-commit (`.husky/pre-commit`)

```sh
bun run lint-staged
```

lint-staged filters to staged `.ts` files and runs Biome check with autofix. Fixed files are automatically re-staged. Runs in 1-3 seconds.

### commit-msg (`.husky/commit-msg`)

```sh
bun run commitlint --edit "$1"
```

Validates commit message against conventional commit format. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

### pre-push (`.husky/pre-push`)

```sh
bun run tsc --noEmit && bun test
```

Two checks in sequence:
1. TypeScript type check across entire project
2. Full test suite (20 test files via `bun test`)

Order matters: typecheck first because it's faster and catches issues tests might miss. Expected duration: 5-15 seconds.

## Configuration Files

### `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "warn",
        "noUnusedImports": "warn"
      },
      "style": {
        "noNonNullAssertion": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  },
  "files": {
    "ignore": ["node_modules", "coverage", "dist", "out", "*.lock"]
  },
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

Design decisions:
- `noUnusedVariables` as warn — matches `tsconfig.json` `noUnusedLocals: false`
- `noNonNullAssertion: off` — TypeScript CLI tools commonly use `!` for process/env access
- VCS integration enabled — Biome respects `.gitignore` automatically
- 2-space indent, double quotes, semicolons — matches existing code style in `src/cli.ts` and other files

### `commitlint.config.js`

```js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-max-length": [2, "always", 72],
    "body-max-line-length": [1, "always", 100],
  },
};
```

72-character subject limit follows git's own truncation-safe recommendation. Body lines get a softer warning at 100 characters.

### `package.json` additions

**Scripts:**

```json
{
  "prepare": "husky",
  "lint": "biome check src/",
  "lint:fix": "biome check --fix src/",
  "format": "biome format src/",
  "format:fix": "biome format --fix src/",
  "typecheck": "tsc --noEmit",
  "test": "bun test",
  "check": "bun run typecheck && bun run lint && bun test"
}
```

**lint-staged config (in package.json):**

```json
{
  "lint-staged": {
    "*.ts": ["biome check --fix --no-errors-on-unmatched"]
  }
}
```

**devDependencies:**

- `@biomejs/biome`
- `husky`
- `lint-staged`
- `@commitlint/cli`
- `@commitlint/config-conventional`

## File Structure (new and modified files)

```
devcli/
├── biome.json                    # NEW — Biome lint + format config
├── commitlint.config.js          # NEW — commit message rules
├── .husky/
│   ├── pre-commit                # NEW — lint-staged (Biome on staged files)
│   ├── commit-msg                # NEW — commitlint validation
│   └── pre-push                  # NEW — tsc --noEmit + bun test
├── package.json                  # MODIFIED — add scripts + devDependencies + lint-staged config
├── tsconfig.json                 # UNCHANGED
└── .gitignore                    # UNCHANGED
```

## Scope

### In scope

- Biome lint + format setup and configuration
- Husky git hooks management
- lint-staged for staged-file-only checking
- commitlint for conventional commit enforcement
- npm scripts for manual quality checks
- Initial Biome pass to fix existing lint/format issues in `src/`

### Out of scope

- Secrets scanning — CLI tool does not handle credentials
- Markdown linting — README-only project
- CI/CD pipeline — local-only shift-left; CI is a separate concern
- Custom Biome rules or plugins
- Editor integration setup (VS Code extension)
- Test coverage thresholds — tests exist but coverage enforcement is a separate decision