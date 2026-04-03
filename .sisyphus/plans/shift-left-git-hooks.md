# Shift-Left Git Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Biome linting/formatting, Husky git hooks, lint-staged, and commitlint to enforce quality gates on every commit and push.

**Architecture:** Three git hooks provide tiered checks — pre-commit runs Biome on staged files only (fast), commit-msg validates conventional commit format, and pre-push runs full typecheck + test suite. Husky manages hooks, lint-staged scopes Biome to staged files.

**Tech Stack:** Biome, Husky, lint-staged, commitlint, Bun, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-03-shift-left-git-hooks-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `biome.json` | CREATE | Biome lint + format configuration |
| `commitlint.config.js` | CREATE | Conventional commit rules |
| `.husky/pre-commit` | CREATE | Runs lint-staged (Biome on staged files) |
| `.husky/commit-msg` | CREATE | Runs commitlint on commit message |
| `.husky/pre-push` | CREATE | Runs tsc --noEmit + bun test |
| `package.json` | MODIFY | Add scripts, devDeps, lint-staged config |

---

### Task 1: Install devDependencies

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install all devDependencies**

```bash
bun add -d @biomejs/biome husky lint-staged @commitlint/cli @commitlint/config-conventional
```

- [ ] **Step 2: Verify dependencies were added**

Run: `cat package.json | grep -A 10 '"devDependencies"'`
Expected: All 8 devDeps listed (3 existing + 5 new)

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add biome, husky, lint-staged, commitlint devDependencies"
```

---

### Task 2: Create biome.json configuration

**Files:**
- Create: `biome.json`

- [ ] **Step 1: Write biome.json**

Create `biome.json` at project root with this exact content:

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

- [ ] **Step 2: Verify Biome can parse its config**

Run: `bunx biome check --help`
Expected: Help output, no config parse errors

- [ ] **Step 3: Commit**

```bash
git add biome.json
git commit -m "chore: add biome.json lint and format configuration"
```

---

### Task 3: Create commitlint.config.js

**Files:**
- Create: `commitlint.config.js`

- [ ] **Step 1: Write commitlint.config.js**

Create `commitlint.config.js` at project root with this exact content:

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

- [ ] **Step 2: Verify commitlint loads config**

Run: `bunx commitlint --help`
Expected: Help output, no config parse errors

- [ ] **Step 3: Commit**

```bash
git add commitlint.config.js
git commit -m "chore: add commitlint conventional commit configuration"
```

---

### Task 4: Add scripts and lint-staged config to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts and lint-staged config**

Edit `package.json` to add a `"scripts"` section and a `"lint-staged"` section. Add the following keys:

**Scripts to add:**
```json
"scripts": {
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

**lint-staged config to add:**
```json
"lint-staged": {
  "*.ts": ["biome check --fix --no-errors-on-unmatched"]
}
```

Note: The exact version strings for devDependencies are whatever `bun add -d` installed in Task 1. Do NOT change those — only add `"scripts"` and `"lint-staged"` sections.

- [ ] **Step 2: Verify scripts are runnable**

Run: `bun run typecheck`
Expected: `tsc --noEmit` runs without errors

Run: `bun run test`
Expected: All test files pass

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add quality scripts and lint-staged config to package.json"
```

---

### Task 5: Initialize Husky and create git hooks

**Files:**
- Create: `.husky/pre-commit`
- Create: `.husky/commit-msg`
- Create: `.husky/pre-push`

- [ ] **Step 1: Initialize Husky**

```bash
bunx husky init
```

This creates `.husky/` directory and sets up the git hooks path. It may create a default `.husky/pre-commit` — that's fine, we'll overwrite it.

- [ ] **Step 2: Write .husky/pre-commit**

Replace the contents of `.husky/pre-commit` with:

```sh
bun run lint-staged
```

- [ ] **Step 3: Write .husky/commit-msg**

Create `.husky/commit-msg` with:

```sh
bun run commitlint --edit "$1"
```

- [ ] **Step 4: Write .husky/pre-push**

Create `.husky/pre-push` with:

```sh
bun run tsc --noEmit && bun test
```

- [ ] **Step 5: Verify hooks are executable**

Run: `ls -la .husky/`
Expected: All three hook files exist with execute permission

- [ ] **Step 6: Commit**

```bash
git add .husky/
git commit -m "chore: add husky pre-commit, commit-msg, and pre-push hooks"
```

---

### Task 6: Fix existing lint/format issues with Biome

**Files:**
- Modify: all `.ts` files in `src/` that have lint or format violations

- [ ] **Step 1: Run Biome check on entire src/ to see violations**

```bash
bun run lint
```

Expected: A list of lint errors and/or warnings.

- [ ] **Step 2: Run Biome autofix**

```bash
bun run lint:fix
bun run format:fix
```

This applies safe autofixes (formatting, organize imports, etc.).

- [ ] **Step 3: Check remaining issues**

```bash
bun run lint
```

If there are remaining warnings (not errors), that's acceptable — the config has `noUnusedVariables` and `noUnusedImports` as warnings. If there are actual errors, fix them manually.

- [ ] **Step 4: Run typecheck to verify nothing broke**

```bash
bun run typecheck
```

Expected: No type errors

- [ ] **Step 5: Run tests to verify nothing broke**

```bash
bun run test
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "style: apply biome lint and format fixes across codebase"
```

---

### Task 7: Verify full shift-left pipeline end-to-end

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full check script**

```bash
bun run check
```

This runs `typecheck && lint && test` — the same thing pre-push does. Expected: All three pass.

- [ ] **Step 2: Test pre-commit hook manually**

Make a small change, stage it, and commit:
```bash
echo "// shift-left test" >> src/cli.ts
git add src/cli.ts
git commit -m "test: verify pre-commit hook runs lint-staged"
```

Expected: lint-staged runs Biome on `src/cli.ts`, commit succeeds.

- [ ] **Step 3: Test commit-msg hook rejects invalid messages**

Try an invalid commit message:
```bash
git commit -m "bad commit message" --allow-empty
```

Expected: commitlint rejects with error about non-conventional format.

- [ ] **Step 4: Verify valid conventional commit works**

```bash
git commit -m "test: verify commitlint accepts conventional commits" --allow-empty
```

Expected: Commit succeeds.

- [ ] **Step 5: Verify pre-push hook works**

```bash
git push --dry-run
```

Expected: Typecheck and tests run (or dry-run output shows the push would succeed).
