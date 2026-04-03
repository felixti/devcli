import type { Prompter } from "@/kernel/types";

export class MockPrompter implements Prompter {
  private confirmResponse: boolean = true;
  private selectResponse: string = "";
  private confirmCalls: string[] = [];
  private selectCalls: { message: string; choices: string[] }[] = [];

  setConfirmResponse(response: boolean): void {
    this.confirmResponse = response;
  }

  setSelectResponse(response: string): void {
    this.selectResponse = response;
  }

  getConfirmCalls(): string[] {
    return [...this.confirmCalls];
  }

  getSelectCalls(): { message: string; choices: string[] }[] {
    return [...this.selectCalls];
  }

  reset(): void {
    this.confirmCalls = [];
    this.selectCalls = [];
  }

  async confirm(message: string): Promise<boolean> {
    this.confirmCalls.push(message);
    return this.confirmResponse;
  }

  async select(message: string, choices: string[]): Promise<string> {
    this.selectCalls.push({ message, choices });
    return this.selectResponse;
  }
}
