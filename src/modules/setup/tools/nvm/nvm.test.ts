import { expect, test } from "bun:test";
import type { ChildProcess, ProcessRunner, RunOptions, RunResult } from "@/kernel/types";
import { MockFileSystem } from "../../../../services/file-system.mock";
import { MockPrompter } from "../../../../services/prompter.mock";
import { NvmTool } from "./nvm";

const mockFs = new MockFileSystem();

class NvmMockProcessRunner implements ProcessRunner {
  private responses: Map<string, RunResult> = new Map();

  setResponse(command: string, args: string[], response: RunResult): void {
    const key = `${command} ${args.join(" ")}`.trim();
    this.responses.set(key, response);
  }

  async run(command: string, args: string[] = [], _options?: RunOptions): Promise<RunResult> {
    const key = `${command} ${args.join(" ")}`.trim();
    const response = this.responses.get(key);

    if (response) {
      return response;
    }

    return {
      stdout: "",
      stderr: `No mock response for: ${key}`,
      exitCode: 127,
      timedOut: false,
    };
  }

  spawn(): ChildProcess {
    return { pid: 0, kill: () => {}, on: () => {} };
  }
}

test("check: installed and configured on Unix", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();

  runner.setResponse("nvm", ["--version"], {
    stdout: "0.39.7",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse("nvm", ["current"], {
    stdout: "v20.11.0",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });

  const result = await tool.check(runner, "linux", mockFs);

  expect(result.toolName).toBe("nvm");
  expect(result.installed).toBe(true);
  expect(result.configured).toBe(true);
  expect(result.version).toBe("0.39.7");
  expect(result.message).toContain("v20.11.0");
});

test("check: installed but not configured on Unix", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();

  runner.setResponse("nvm", ["--version"], {
    stdout: "0.39.7",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse("nvm", ["current"], {
    stdout: "none",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });

  const result = await tool.check(runner, "linux", mockFs);

  expect(result.toolName).toBe("nvm");
  expect(result.installed).toBe(true);
  expect(result.configured).toBe(false);
  expect(result.version).toBe("0.39.7");
  expect(result.message).toContain("not configured");
});

test("check: not installed", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();

  runner.setResponse("nvm", ["--version"], {
    stdout: "",
    stderr: "command not found",
    exitCode: 127,
    timedOut: false,
  });

  const result = await tool.check(runner, "linux", mockFs);

  expect(result.toolName).toBe("nvm");
  expect(result.installed).toBe(false);
  expect(result.configured).toBe(false);
  expect(result.message).toContain("not installed");
});

test("install: macOS installer via curl script", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();
  const prompter = new MockPrompter();

  // Initial check - not installed
  runner.setResponse("nvm", ["--version"], {
    stdout: "",
    stderr: "command not found",
    exitCode: 127,
    timedOut: false,
  });
  runner.setResponse(
    "bash",
    ["-c", "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"],
    { stdout: "", stderr: "", exitCode: 0, timedOut: false },
  );
  runner.setResponse("cat", ["/Users/test/.bashrc"], {
    stdout: "",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  // Post-install verification - now installed
  runner.setResponse("nvm", ["--version"], {
    stdout: "0.39.7",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse("nvm", ["current"], {
    stdout: "none",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  prompter.setConfirmResponse(true);

  const result = await tool.install(runner, prompter, "macos");

  expect(result.success).toBe(true);
  expect(result.message).toContain("installed successfully");
});

test("install: Windows installer via winget", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();
  const prompter = new MockPrompter();

  // Initial check - not installed
  runner.setResponse("nvm", ["version"], {
    stdout: "",
    stderr: "command not found",
    exitCode: 127,
    timedOut: false,
  });
  runner.setResponse("winget", ["install", "CoreyButler.NVMforWindows", "--silent"], {
    stdout: "Successfully installed",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  // Post-install verification - now installed
  runner.setResponse("nvm", ["version"], {
    stdout: "1.1.12",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse("nvm", ["list"], {
    stdout: "No installations recognized.",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  prompter.setConfirmResponse(true);

  const result = await tool.install(runner, prompter, "windows");

  expect(result.success).toBe(true);
  expect(result.message).toContain("installed successfully");
});

test("install: already installed proceeds with install (idempotency handled by InstallCommand)", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();
  const prompter = new MockPrompter();

  runner.setResponse("nvm", ["--version"], {
    stdout: "0.39.7",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse("nvm", ["current"], {
    stdout: "v20.11.0",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse(
    "bash",
    ["-c", "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"],
    {
      stdout: "nvm installed",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    },
  );
  prompter.setConfirmResponse(true);

  const result = await tool.install(runner, prompter, "linux");

  expect(result.success).toBe(true);
  expect(result.message).toContain("installed successfully");
});

test("check: Windows platform uses correct commands", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();

  runner.setResponse("nvm", ["version"], {
    stdout: "1.1.12",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse("nvm", ["list"], {
    stdout: "  * 20.11.0 (Currently using 64-bit executable)",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });

  const result = await tool.check(runner, "windows", mockFs);

  expect(result.toolName).toBe("nvm");
  expect(result.installed).toBe(true);
  expect(result.configured).toBe(true);
  expect(result.version).toBe("1.1.12");
});

test("check: Windows platform not configured", async () => {
  const tool = new NvmTool();
  const runner = new NvmMockProcessRunner();

  runner.setResponse("nvm", ["version"], {
    stdout: "1.1.12",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });
  runner.setResponse("nvm", ["list"], {
    stdout: "No installations recognized.",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });

  const result = await tool.check(runner, "windows", mockFs);

  expect(result.toolName).toBe("nvm");
  expect(result.installed).toBe(true);
  expect(result.configured).toBe(false);
});
