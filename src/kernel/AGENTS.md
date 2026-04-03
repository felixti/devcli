# Kernel

**Purpose:** Core framework — dependency injection container, module system, and type definitions.

## STRUCTURE

```
kernel/
├── types.ts           # ALL interfaces (centralized)
├── service-container.ts # DI container with lazy loading
├── module-loader.ts   # Module registration
└── *.test.ts          # Unit tests
```

## KEY INTERFACES

### DevcliModule
Plugin contract for CLI modules:
```typescript
interface DevcliModule {
  name: string;
  description: string;
  register(program: Command, services: ServiceContainer): void;
}
```

### ServiceContainer
DI container providing:
- `getProcessRunner()` — Process execution
- `getConfigLoader()` — Remote config fetching
- `getPrompter()` — User interaction
- `getFileSystem()` — File operations
- `getPlatformDetector()` — Platform detection
- `getFormatter()` — Output formatting

## ARCHITECTURE

### Lazy Loading Pattern
```typescript
getProcessRunner(): ProcessRunner {
  if (!this.instances.processRunner) {
    this.instances.processRunner = this.factories.getProcessRunner();
  }
  return this.instances.processRunner;
}
```

### Module Registration
```typescript
export class ModuleLoader {
  private readonly modules: DevcliModule[] = [setupModule];
  
  registerAll(program: Command, services: ServiceContainer): void {
    for (const module of this.modules) {
      module.register(program, services);
    }
  }
}
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new module | `module-loader.ts:9` | Add to modules array |
| Add service interface | `types.ts` | Add to ServiceContainer |
| New tool result type | `types.ts` | CheckResult, InstallResult |

## ANTI-PATTERNS

**DON'T:** Put interfaces in other directories — ALL go here  
**DON'T:** Import implementations — only import interfaces  
**DON'T:** Add business logic — this is infrastructure only  

## NOTES

- All types centralized for single source of truth
- ServiceContainer enables testability via mocks
- Module system allows command extensibility
- types.ts is the ONLY file other modules should import from
