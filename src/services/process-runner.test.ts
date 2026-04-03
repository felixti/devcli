import { test, expect, describe } from "bun:test";
import { RealProcessRunner } from "./process-runner.impl";
import { MockProcessRunner } from "./process-runner.mock";

describe("RealProcessRunner", () => {
  test("run() captures stdout and stderr on successful execution", async () => {
    const runner = new RealProcessRunner();
    const result = await runner.run("echo", ["hello world"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello world");
    expect(result.stderr).toBe("");
    expect(result.timedOut).toBe(false);
  });

  test("run() returns non-zero exit code when command fails", async () => {
    const runner = new RealProcessRunner();
    const result = await runner.run("sh", ["-c", "exit 42"]);

    expect(result.exitCode).toBe(42);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(result.timedOut).toBe(false);
  });

  test("run() kills process and sets timedOut when timeout expires", async () => {
    const runner = new RealProcessRunner();
    const result = await runner.run("sleep", ["10"], { timeout: 100 });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(-1);
  });
});

describe("MockProcessRunner", () => {
  test("run() returns pre-programmed response", async () => {
    const runner = new MockProcessRunner();
    runner.setResponse("test-command", {
      stdout: "mocked output",
      stderr: "mocked error",
      exitCode: 0,
    });

    const result = await runner.run("test-command");

    expect(result.stdout).toBe("mocked output");
    expect(result.stderr).toBe("mocked error");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });
});
