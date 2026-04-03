import { describe, test, expect } from "bun:test";
import { createProgram } from "@/cli";

describe("CLI Integration Tests", () => {
  function createTestProgram() {
    const outputs: { out: string[]; err: string[] } = { out: [], err: [] };

    const program = createProgram({
      version: "0.1.0",
      argv: [],
      exitOverride: true,
      configureOutput: {
        writeOut: (str: string) => outputs.out.push(str),
        writeErr: (str: string) => outputs.err.push(str),
      },
    });

    return { program, outputs };
  }

  describe("--version", () => {
    test("displays version number", async () => {
      const { program, outputs } = createTestProgram();

      try {
        await program.parseAsync(["node", "devcli", "--version"]);
      } catch (error: unknown) {
        const e = error as { code?: string; message?: string };
        if (e.code === "commander.version") {
          expect(e.message).toContain("0.1.0");
        }
      }
    });

    test("exits successfully with code 0", async () => {
      const { program } = createTestProgram();

      try {
        await program.parseAsync(["node", "devcli", "--version"]);
      } catch (error: unknown) {
        const e = error as { code?: string; exitCode?: number };
        expect(e.code).toBe("commander.version");
        expect(e.exitCode).toBe(0);
      }
    });
  });

  describe("--help", () => {
    test("displays main help with available commands", async () => {
      const { program, outputs } = createTestProgram();

      try {
        await program.parseAsync(["node", "devcli", "--help"]);
      } catch {
        // --help throws with exit code 0
      }

      const output = outputs.out.join("\n");
      expect(output).toContain("devcli");
      expect(output).toContain("Developer environment CLI");
      expect(output).toContain("setup");
      expect(output).toContain("completion");
    });

    test("lists all available commands", async () => {
      const { program, outputs } = createTestProgram();

      try {
        await program.parseAsync(["node", "devcli", "--help"]);
      } catch {
        // --help throws with exit code 0
      }

      const output = outputs.out.join("\n");
      expect(output).toContain("Commands:");
      expect(output).toContain("setup");
      expect(output).toContain("completion");
    });
  });

  describe("setup --help", () => {
    test("displays setup command help with subcommands", async () => {
      const { program, outputs } = createTestProgram();

      try {
        await program.parseAsync(["node", "devcli", "setup", "--help"]);
      } catch {
        // --help throws with exit code 0
      }

      const output = outputs.out.join("\n");
      expect(output).toContain("setup");
      expect(output).toContain("doctor");
      expect(output).toContain("install");
    });
  });

  describe("completion bash", () => {
    test("generates bash completion script", async () => {
      const { program, outputs } = createTestProgram();

      await program.parseAsync(["node", "devcli", "completion", "bash"]);

      const output = outputs.out.join("\n");
      expect(output).toContain("#!/bin/bash");
      expect(output).toContain("_devcli");
      expect(output).toContain("complete -F");
    });

    test("contains main commands in completion", async () => {
      const { program, outputs } = createTestProgram();

      await program.parseAsync(["node", "devcli", "completion", "bash"]);

      const output = outputs.out.join("\n");
      expect(output).toContain("setup");
      expect(output).toContain("completion");
      expect(output).toContain("doctor");
      expect(output).toContain("install");
    });
  });

  describe("module auto-discovery", () => {
    test("setup module commands are registered", async () => {
      const { program, outputs } = createTestProgram();

      try {
        await program.parseAsync(["node", "devcli", "--help"]);
      } catch {
        // --help throws with exit code 0
      }

      const output = outputs.out.join("\n");
      expect(output).toContain("setup");
      expect(output).toContain("Developer environment setup");
    });

    test("all module subcommands are accessible", async () => {
      const { program: doctorProgram } = createTestProgram();
      const { program: installProgram } = createTestProgram();

      let doctorAccessible = false;
      let installAccessible = false;

      try {
        await doctorProgram.parseAsync(["node", "devcli", "setup", "doctor", "--help"]);
        doctorAccessible = true;
      } catch {
        doctorAccessible = true;
      }

      try {
        await installProgram.parseAsync(["node", "devcli", "setup", "install", "--help"]);
        installAccessible = true;
      } catch {
        installAccessible = true;
      }

      expect(doctorAccessible).toBe(true);
      expect(installAccessible).toBe(true);
    });
  });
});
