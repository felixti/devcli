# WSL Resource Configuration Feature Design

**Date:** 2026-04-03  
**Status:** Approved

## Overview

When running on WSL2, automatically check if `.wslconfig` exists in the Windows user home. If missing or misconfigured, suggest optimal CPU/memory limits based on host hardware using a linear formula (CPU/2, RAM/4).

## Architecture

### File Structure

```
src/
├── wsl/
│   ├── wslconfig.service.ts    # Main service
│   ├── wslconfig.service.test.ts
│   └── wslconfig.types.ts      # Interfaces only
└── kernel/
    └── types.ts               # Add WslConfigService to ServiceContainer
```

### Service Responsibilities

**WslConfigService:**
- Detect Windows host CPU cores and RAM via `powershell.exe`
- Calculate recommended limits (linear formula: CPU/2, RAM/4)
- Check if `.wslconfig` exists in Windows home
- Compare existing vs. recommended, warn user
- Generate `.wslconfig` content on user confirmation

## Resource Calculation

| Host CPU | Host RAM | Suggested CPU | Suggested RAM |
|----------|----------|--------------|--------------|
| 12       | 16 GB    | 6            | 4 GB         |
| 24       | 32 GB    | 12           | 8 GB         |
| 8        | 8 GB     | 4            | 2 GB         |
| 4        | 4 GB     | 2            | 1 GB         |

**Formula:**
- CPU: `hostCores / 2` (round down to even number)
- RAM: `hostMemoryGB / 4` (round down to nearest GB)

User can override suggested values interactively.

## Data Flow

```
setup doctor (WSL2)
    ↓
WslConfigService.check()
    ↓
powershell.exe → Get-Host (CPU/RAM)
    ↓
Calculate recommendations
    ↓
Check ~/.wslconfig exists?
    ├─ No → Suggest creation
    └─ Yes → Compare values
             └─ Mismatch → Warn + show diff
```

## `.wslconfig` Format

```ini
[wsl2]
processors=6
memory=4GB
```

## Interfaces

```typescript
// src/wsl/wslconfig.types.ts
interface HostResources {
  cpuCores: number;
  memoryGB: number;
}

interface WslConfig {
  processors: number;
  memoryGB: number;
}

interface WslConfigRecommendation {
  suggested: WslConfig;
  current?: WslConfig;  // undefined if file doesn't exist
  hostResources: HostResources;
}
```

## Kernel Types Addition

```typescript
// src/kernel/types.ts
interface ServiceContainer {
  // ... existing
  getWslConfigService(): WslConfigService;
}

interface WslConfigService {
  check(): Promise<WslConfigRecommendation | null>;
  createConfig(config: WslConfig): Promise<void>;
  getWindowsHomePath(): Promise<string>;
}
```

## Integration Points

1. **`setup doctor`** — Call `wslConfigService.check()` when `platform === "wsl2"`, show results inline with other tool checks
2. **Auto-trigger on WSL2** — Service auto-invokes on first doctor run (no explicit flag needed)

## Error Handling

- **`powershell.exe` fails** → Show warning, skip WSL config check, don't block other doctor checks
- **Can't read Windows home path** → Show error with manual instructions
- **File doesn't exist** → Suggest creation with recommended values
- **User declines** → Silent skip, no state stored
- **File write fails** → Show error with instructions to manually create file

## Testing Strategy

**Unit tests:**
- Resource calculation (CPU/2, RAM/4) — pure function tests
- `.wslconfig` content generation
- Path construction helpers

**Integration tests:**
- Mock `powershell.exe` output for host resource detection
- Mock file system for `.wslconfig` existence checks

## Dependencies

No new external dependencies. Uses existing:
- `ProcessRunner` for `powershell.exe` execution
- `FileSystem` for `.wslconfig` read/write
- `Prompter` for user interaction
