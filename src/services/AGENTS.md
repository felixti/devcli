# Services Layer

**Purpose:** Service abstractions with impl/mock/test pattern for system resources.

## STRUCTURE

```
services/
├── *.ts              # Interface re-exports from kernel
├── *.impl.ts         # Real implementations
├── *.mock.ts         # Test doubles
└── *.test.ts         # Unit tests (co-located)
```

## SERVICES

| Service | Interface | Real | Mock | Purpose |
|---------|-----------|------|------|---------|
| ProcessRunner | ✓ | ✓ | ✓ | Spawn child processes with timeout |
| ConfigLoader | ✓ | ✓ | ✓ | Fetch remote config with caching |
| FileSystem | ✓ | ✓ | ✓ | File operations via Bun.file |
| Prompter | ✓ | ✓ | ✓ | Interactive user prompts |
| PlatformDetector | ✓ | ✓ | — | Detect platform/shell/package manager |

## CONVENTIONS

### Interface File Pattern
```typescript
// process-runner.ts - Just re-exports
export type {
  ProcessRunner,
  RunOptions,
  RunResult,
} from "@/kernel/types";
```

### Implementation Pattern
```typescript
// process-runner.impl.ts
export class RealProcessRunner implements ProcessRunner {
  async run(command: string, args?: string[], options?: RunOptions): Promise<RunResult> {
    // Real implementation using child_process
  }
}
```

### Mock Pattern
```typescript
// process-runner.mock.ts
export class MockProcessRunner implements ProcessRunner {
  private mockResults = new Map<string, RunResult>();
  
  setMockResult(command: string, result: RunResult): void {
    this.mockResults.set(command, result);
  }
  
  async run(command: string): Promise<RunResult> {
    return this.mockResults.get(command) ?? { exitCode: 0, stdout: "", stderr: "" };
  }
}
```

## ANTI-PATTERNS

**DON'T:** Create services without interface in kernel/types.ts  
**DON'T:** Put interfaces in service files — all in kernel/types.ts  
**DON'T:** Import from `../kernel/types` — use `@/kernel/types`  

## NOTES

- Services are lazy-loaded via `ServiceContainerImpl`
- All services are singletons per container instance
- Mocks enable deterministic testing without side effects
- `RealConfigLoader` uses TTL-based caching (60 min default)
