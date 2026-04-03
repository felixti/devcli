export class Formatter {
	private isTTY: boolean;
	private writeStdout: (output: string) => void;
	private writeStderr: (output: string) => void;

	constructor(
		isTTY: boolean = typeof process !== "undefined"
			? process.stdout.isTTY
			: false,
		writeStdout: (output: string) => void = (output) => console.log(output),
		writeStderr: (output: string) => void = (output) => console.error(output),
	) {
		this.isTTY = isTTY ?? false;
		this.writeStdout = writeStdout;
		this.writeStderr = writeStderr;
	}

	private color(code: string, text: string): string {
		if (!this.isTTY) return text;
		return `\x1b[${code}m${text}\x1b[0m`;
	}

	private green(text: string): string {
		return this.color("32", text);
	}

	private red(text: string): string {
		return this.color("31", text);
	}

	private yellow(text: string): string {
		return this.color("33", text);
	}

	private blue(text: string): string {
		return this.color("34", text);
	}

	success(message: string): void {
		this.writeStdout(this.green(`✓ ${message}`));
	}

	error(message: string): void {
		this.writeStdout(this.red(`✗ ${message}`));
	}

	warn(message: string): void {
		this.writeStdout(this.yellow(`⚠ ${message}`));
	}

	info(message: string): void {
		this.writeStdout(this.blue(`ℹ ${message}`));
	}

	section(title: string): void {
		const border = "═".repeat(40);
		this.writeStdout(`\n${border}\n  ${title}\n${border}\n`);
	}

	table(headers: string[], rows: string[][]): void {
		if (headers.length === 0 && rows.length === 0) {
			this.writeStdout("");
			return;
		}

		const colWidths = headers.map((h, i) => {
			const maxRowWidth = rows.reduce(
				(max, row) => Math.max(max, (row[i] || "").length),
				0,
			);
			return Math.max(h.length, maxRowWidth);
		});

		const headerLine = headers
			.map((h, i) => h.padEnd(colWidths[i]!))
			.join(" │ ");

		const separator = colWidths.map((w) => "─".repeat(w)).join("─┼─");

		this.writeStdout(`┌─${separator}─┐`);
		this.writeStdout(`│ ${headerLine} │`);
		this.writeStdout(`├─${separator}─┤`);

		for (const row of rows) {
			const rowLine = row
				.map((cell, i) => (cell || "").padEnd(colWidths[i]!))
				.join(" │ ");
			this.writeStdout(`│ ${rowLine} │`);
		}

		this.writeStdout(`└─${separator}─┘`);
	}

	json(data: unknown): void {
		const formatted = JSON.stringify(data, null, 2);
		this.writeStdout(formatted);
	}
}
