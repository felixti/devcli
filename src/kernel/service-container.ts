import type { ServiceContainer, ProcessRunner, ConfigLoader, Prompter, FileSystem, PlatformDetector, Formatter } from "./types";

type ServiceFactories = {
  getProcessRunner: () => ProcessRunner;
  getConfigLoader: () => ConfigLoader;
  getPrompter: () => Prompter;
  getFileSystem: () => FileSystem;
  getPlatformDetector: () => PlatformDetector;
  getFormatter: () => Formatter;
};

export class ServiceContainerImpl implements ServiceContainer {
  private factories: ServiceFactories;
  private instances: Partial<{
    processRunner: ProcessRunner;
    configLoader: ConfigLoader;
    prompter: Prompter;
    fileSystem: FileSystem;
    platformDetector: PlatformDetector;
    formatter: Formatter;
  }> = {};

  constructor(factories: ServiceFactories) {
    this.factories = factories;
  }

  getProcessRunner(): ProcessRunner {
    if (!this.instances.processRunner) {
      this.instances.processRunner = this.factories.getProcessRunner();
    }
    return this.instances.processRunner;
  }

  getConfigLoader(): ConfigLoader {
    if (!this.instances.configLoader) {
      this.instances.configLoader = this.factories.getConfigLoader();
    }
    return this.instances.configLoader;
  }

  getPrompter(): Prompter {
    if (!this.instances.prompter) {
      this.instances.prompter = this.factories.getPrompter();
    }
    return this.instances.prompter;
  }

  getFileSystem(): FileSystem {
    if (!this.instances.fileSystem) {
      this.instances.fileSystem = this.factories.getFileSystem();
    }
    return this.instances.fileSystem;
  }

  getPlatformDetector(): PlatformDetector {
    if (!this.instances.platformDetector) {
      this.instances.platformDetector = this.factories.getPlatformDetector();
    }
    return this.instances.platformDetector;
  }

  getFormatter(): Formatter {
    if (!this.instances.formatter) {
      this.instances.formatter = this.factories.getFormatter();
    }
    return this.instances.formatter;
  }
}