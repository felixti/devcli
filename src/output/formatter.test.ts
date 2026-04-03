import { beforeEach, describe, expect, test } from "bun:test";
import { Formatter } from "./formatter";

// Mock stdout to capture output without actually writing to terminal
let stdoutData: string[] = [];
let stderrData: string[] = [];

function createMockFormatter(isTTY = true): Formatter {
	stdoutData = [];
	stderrData = [];

	// Create formatter with mock process
	const formatter = new Formatter(
		isTTY,
		(output: string) => {
			stdoutData.push(output);
		},
		(output: string) => {
			stderrData.push(output);
		},
	);

	return formatter;
}

describe("Formatter", () => {
	let formatter: Formatter;

	beforeEach(() => {
		formatter = createMockFormatter(true);
	});

	describe("TTY mode (colored output)", () => {
		test("success() outputs green checkmark with message", () => {
			formatter.success("Operation completed");
			expect(stdoutData[0]).toContain("\x1b[32m"); // green
			expect(stdoutData[0]).toContain("✓");
			expect(stdoutData[0]).toContain("Operation completed");
			expect(stdoutData[0]).toContain("\x1b[0m"); // reset
		});

		test("error() outputs red X with message", () => {
			formatter.error("Something went wrong");
			expect(stdoutData[0]).toContain("\x1b[31m"); // red
			expect(stdoutData[0]).toContain("✗");
			expect(stdoutData[0]).toContain("Something went wrong");
		});

		test("warn() outputs yellow warning with message", () => {
			formatter.warn("Be careful");
			expect(stdoutData[0]).toContain("\x1b[33m"); // yellow
			expect(stdoutData[0]).toContain("⚠");
			expect(stdoutData[0]).toContain("Be careful");
		});

		test("info() outputs blue info with message", () => {
			formatter.info("Here is some info");
			expect(stdoutData[0]).toContain("\x1b[34m"); // blue
			expect(stdoutData[0]).toContain("ℹ");
			expect(stdoutData[0]).toContain("Here is some info");
		});

		test("section() outputs formatted section header", () => {
			formatter.section("My Section");
			expect(stdoutData[0]).toContain("══");
			expect(stdoutData[0]).toContain("My Section");
		});
	});

	describe("Non-TTY mode (plain output)", () => {
		test("success() outputs plain text without ANSI codes", () => {
			formatter = createMockFormatter(false);
			formatter.success("Operation completed");
			const output = stdoutData[0];
			expect(output).not.toContain("\x1b[");
			expect(output).toContain("✓");
			expect(output).toContain("Operation completed");
		});

		test("error() outputs plain text without ANSI codes", () => {
			formatter = createMockFormatter(false);
			formatter.error("Something went wrong");
			const output = stdoutData[0];
			expect(output).not.toContain("\x1b[");
			expect(output).toContain("✗");
			expect(output).toContain("Something went wrong");
		});
	});

	describe("table()", () => {
		test("formats table with headers and rows", () => {
			formatter.table(
				["Name", "Age"],
				[
					["Alice", "30"],
					["Bob", "25"],
				],
			);
			const output = stdoutData.join("\n");
			expect(output).toContain("Name");
			expect(output).toContain("Age");
			expect(output).toContain("Alice");
			expect(output).toContain("30");
			expect(output).toContain("Bob");
			expect(output).toContain("25");
		});

		test("handles empty table", () => {
			formatter.table([], []);
			const output = stdoutData[0];
			expect(output).toBeDefined();
		});
	});

	describe("json()", () => {
		test("formats object as pretty-printed JSON", () => {
			formatter.json({ name: "test", value: 42 });
			const output = stdoutData[0];
			expect(output).toContain('"name"');
			expect(output).toContain('"test"');
			expect(output).toContain('"value"');
			expect(output).toContain("42");
		});

		test("formats nested objects correctly", () => {
			formatter.json({ outer: { inner: "value" } });
			const output = stdoutData[0];
			expect(output).toContain('"outer"');
			expect(output).toContain('"inner"');
			expect(output).toContain('"value"');
		});

		test("formats arrays correctly", () => {
			formatter.json([1, 2, 3]);
			const output = stdoutData[0];
			expect(output).toContain("1");
			expect(output).toContain("2");
			expect(output).toContain("3");
		});
	});
});
