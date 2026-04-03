import { describe, expect, test } from "bun:test";
import { generateCompletion } from "./completion";

describe("completion command", () => {
	describe("bash completion", () => {
		test("generates valid bash completion script", () => {
			const output = generateCompletion("bash");

			expect(output).toContain("complete -F");
			expect(output).toContain("_devcli");
			expect(output).toContain("devcli");
		});
	});

	describe("zsh completion", () => {
		test("generates zsh completion with #compdef", () => {
			const output = generateCompletion("zsh");

			expect(output).toContain("#compdef");
			expect(output).toContain("devcli");
			expect(output).toContain("_devcli");
		});
	});

	describe("fish completion", () => {
		test("generates valid fish completion script", () => {
			const output = generateCompletion("fish");

			expect(output).toContain("complete -c");
			expect(output).toContain("devcli");
		});
	});

	describe("powershell completion", () => {
		test("generates valid PowerShell completion script", () => {
			const output = generateCompletion("powershell");

			expect(output).toContain("Register-ArgumentCompleter");
			expect(output).toContain("devcli");
		});
	});

	describe("invalid shell", () => {
		test("throws error for unsupported shell", () => {
			expect(() => generateCompletion("csh")).toThrow(
				"Unsupported shell: csh. Supported: bash, zsh, fish, powershell",
			);
		});

		test("throws error for empty shell", () => {
			expect(() => generateCompletion("")).toThrow(
				"Unsupported shell: . Supported: bash, zsh, fish, powershell",
			);
		});
	});
});
