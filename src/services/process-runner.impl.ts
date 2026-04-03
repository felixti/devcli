import { spawn } from "node:child_process";
import type {
  ProcessRunner,
  RunOptions,
  RunResult,
  SpawnOptions,
  ChildProcess,
} from "@/kernel/types";

export class RealProcessRunner implements ProcessRunner {
  async run(
    command: string,
    args: string[] = [],
    options: RunOptions = {}
  ): Promise<RunResult> {
    const { cwd, timeout, env } = options;

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let killed = false;

      const child = spawn(command, args, {
        cwd,
        env,
        stdio: "pipe",
      });

      if (timeout && timeout > 0) {
        setTimeout(() => {
          timedOut = true;
          killed = true;
          child.kill("SIGKILL");
        }, timeout);
      }

      const forwardSignal = (signal: NodeJS.Signals) => {
        if (!child.killed) {
          killed = true;
          child.kill(signal);
        }
      };

      const onSigint = () => forwardSignal("SIGINT");
      const onSigterm = () => forwardSignal("SIGTERM");

      process.on("SIGINT", onSigint);
      process.on("SIGTERM", onSigterm);

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code: number | null) => {
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);

        resolve({
          stdout,
          stderr,
          exitCode: code ?? (killed ? -1 : 0),
          timedOut,
        });
      });

      child.on("error", () => {
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);

        resolve({
          stdout,
          stderr,
          exitCode: -1,
          timedOut,
        });
      });
    });
  }

  spawn(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {}
  ): ChildProcess {
    const { cwd, env, stdio = "pipe" } = options;

    const child = spawn(command, args, {
      cwd,
      env,
      stdio,
    });

    return {
      pid: child.pid ?? -1,
      kill: () => child.kill(),
      on: (event: "exit" | "error", callback: (arg: number | Error) => void) => {
        if (event === "exit") {
          child.on("exit", (code: number | null) => {
            callback(code ?? -1);
          });
        } else {
          child.on("error", (err: Error) => {
            callback(err);
          });
        }
      },
    } as ChildProcess;
  }
}
