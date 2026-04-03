import * as readline from "node:readline";
import type { Prompter } from "@/kernel/types";

export class RealPrompter implements Prompter {
	private readonly yesMode: boolean;

	constructor(options: { yesMode?: boolean } = {}) {
		this.yesMode = options.yesMode ?? false;
	}

	async confirm(message: string): Promise<boolean> {
		if (this.yesMode) {
			return true;
		}

		const answer = await this.prompt(`${message} (y/n) `);
		return answer.toLowerCase() === "y";
	}

	async select(message: string, choices: string[]): Promise<string> {
		if (this.yesMode) {
			return choices[0]!;
		}

		if (choices.length === 0) {
			throw new Error("At least one choice must be provided");
		}

		const choicesText = choices.map((c, i) => `  ${i + 1}. ${c}`).join("\n");
		const answer = await this.prompt(
			`${message}\n${choicesText}\nEnter choice (1-${choices.length}): `,
		);

		const index = parseInt(answer, 10) - 1;
		if (isNaN(index) || index < 0 || index >= choices.length) {
			return choices[0]!;
		}

		return choices[index]!;
	}

	private prompt(question: string): Promise<string> {
		return new Promise((resolve) => {
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			rl.question(question, (answer) => {
				rl.close();
				resolve(answer.trim());
			});
		});
	}
}
