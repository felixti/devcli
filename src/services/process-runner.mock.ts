import type {
	ChildProcess,
	ProcessRunner,
	RunOptions,
	RunResult,
	SpawnOptions,
} from "@/kernel/types";

export interface MockResponse {
	stdout: string;
	stderr: string;
	exitCode: number;
	delay?: number;
}

export class MockProcessRunner implements ProcessRunner {
	private responses: Map<string, MockResponse> = new Map();
	private spawnedProcesses: MockChildProcess[] = [];

	setResponse(command: string, response: MockResponse): void {
		this.responses.set(command, response);
	}

	clearResponses(): void {
		this.responses.clear();
	}

	getResponse(command: string): MockResponse | undefined {
		return this.responses.get(command);
	}

	async run(
		command: string,
		_args: string[] = [],
		_options?: RunOptions,
	): Promise<RunResult> {
		const response = this.responses.get(command);

		if (!response) {
			return {
				stdout: "",
				stderr: `MockProcessRunner: no response programmed for "${command}"`,
				exitCode: 127,
				timedOut: false,
			};
		}

		const { stdout, stderr, exitCode, delay = 0 } = response;

		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		return {
			stdout,
			stderr,
			exitCode,
			timedOut: false,
		};
	}

	spawn(
		_command: string,
		_args: string[] = [],
		_options?: SpawnOptions,
	): ChildProcess {
		const mock: MockChildProcess = {
			pid: Math.floor(Math.random() * 10000) + 1000,
			killed: false,
			listeners: new Map(),
		};

		this.spawnedProcesses.push(mock);

		return {
			pid: mock.pid,
			kill: () => {
				mock.killed = true;
			},
			on: (
				event: "exit" | "error",
				callback: (arg: number | Error) => void,
			) => {
				mock.listeners.set(event, callback);
			},
		} as ChildProcess;
	}

	triggerAllExit(code: number): void {
		for (const mock of this.spawnedProcesses) {
			const exitCallback = mock.listeners.get("exit");
			if (exitCallback) {
				exitCallback(code);
			}
		}
		this.spawnedProcesses = [];
	}

	getSpawnedCount(): number {
		return this.spawnedProcesses.length;
	}
}

interface MockChildProcess {
	pid: number;
	killed: boolean;
	listeners: Map<string, (arg: number | Error) => void>;
}
