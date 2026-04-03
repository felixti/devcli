import { beforeEach, describe, expect, test } from "bun:test";
import { RealPrompter } from "./prompter.impl";
import { MockPrompter } from "./prompter.mock";

describe("Prompter", () => {
	describe("MockPrompter", () => {
		let prompter: MockPrompter;

		beforeEach(() => {
			prompter = new MockPrompter();
		});

		test("confirm returns true for 'y' response", async () => {
			prompter.setConfirmResponse(true);
			const result = await prompter.confirm("Install tool?");
			expect(result).toBe(true);
			expect(prompter.getConfirmCalls()).toEqual(["Install tool?"]);
		});

		test("confirm returns false for 'n' response", async () => {
			prompter.setConfirmResponse(false);
			const result = await prompter.confirm("Install tool?");
			expect(result).toBe(false);
			expect(prompter.getConfirmCalls()).toEqual(["Install tool?"]);
		});

		test("select returns chosen value", async () => {
			prompter.setSelectResponse("node");
			const result = await prompter.select("Select runtime:", [
				"node",
				"python",
				"rust",
			]);
			expect(result).toBe("node");
			expect(prompter.getSelectCalls()).toEqual([
				{ message: "Select runtime:", choices: ["node", "python", "rust"] },
			]);
		});

		test("yesMode auto-confirms without prompting", async () => {
			const prompter = new RealPrompter({ yesMode: true });

			const result = await prompter.confirm("Are you sure?");
			expect(result).toBe(true);
		});
	});
});
