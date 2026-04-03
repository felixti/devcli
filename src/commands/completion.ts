export type ShellType = "bash" | "zsh" | "fish" | "powershell";

const SUPPORTED_SHELLS: ShellType[] = ["bash", "zsh", "fish", "powershell"];

function assertShell(shell: string): asserts shell is ShellType {
	if (!SUPPORTED_SHELLS.includes(shell as ShellType)) {
		throw new Error(
			`Unsupported shell: ${shell}. Supported: ${SUPPORTED_SHELLS.join(", ")}`,
		);
	}
}

function generateBashCompletion(): string {
	return `#!/bin/bash
_devcli() {
    local cur prev words cword
    _init_completion || return

    case "$prev" in
        setup|completion|doctor|install)
            return
            ;;
        --version|--help|-v|-h)
            return
            ;;
    esac

    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--version --help" -- "$cur"))
        return
    fi

    COMPREPLY=($(compgen -W "setup completion doctor install bash zsh fish powershell" -- "$cur"))
}

complete -F _devcli devcli
`;
}

function generateZshCompletion(): string {
	return `#!/bin/zsh
#compdef devcli

_devcli() {
    local -a commands
    commands=(
        "setup:Setup completion for your shell"
        "completion:Generate completion scripts"
        "doctor:Check completion status"
        "install:Install completion script"
        "bash:Generate bash completion"
        "zsh:Generate zsh completion"
        "fish:Generate fish completion"
        "powershell:Generate PowerShell completion"
    )

    _arguments -C \\
        "--version[Show version number]" \\
        "--help[Show help information]" \\
        "-v[Show version number]" \\
        "-h[Show help information]" \\
        "1: :($commands)" \\
        "*:arg:->args"

    case "$words[1]" in
        setup)
            _arguments "2:subcommand:(doctor install)"
            ;;
        completion)
            _arguments "2:shell:(bash zsh fish powershell)"
            ;;
    esac
}

_devcli "$@"
`;
}

function generateFishCompletion(): string {
	return `#!/usr/bin/env fish
complete -c devcli -f

complete -c devcli -l version -d "Show version number"
complete -c devcli -l help -d "Show help information"
complete -c devcli -s v -d "Show version number"
complete -c devcli -s h -d "Show help information"

complete -c devcli -n "__fish_use_subcommand" -a setup -d "Setup completion for your shell"
complete -c devcli -n "__fish_use_subcommand" -a completion -d "Generate completion scripts"
complete -c devcli -n "__fish_use_subcommand" -a doctor -d "Check completion status"
complete -c devcli -n "__fish_use_subcommand" -a install -d "Install completion script"
complete -c devcli -n "__fish_use_subcommand" -a bash -d "Generate bash completion"
complete -c devcli -n "__fish_use_subcommand" -a zsh -d "Generate zsh completion"
complete -c devcli -n "__fish_use_subcommand" -a fish -d "Generate fish completion"
complete -c devcli -n "__fish_use_subcommand" -a powershell -d "Generate PowerShell completion"

complete -c devcli -n "test (count (commandline -opc)) -eq 2" -a "doctor install" -d "Setup subcommand"
complete -c devcli -n "test (count (commandline -opc)) -eq 2" -a "bash zsh fish powershell" -d "Completion shell"
`;
}

function generatePowerShellCompletion(): string {
	return `#!/usr/bin/env pwsh
using namespace System.Management.Automation
using namespace System.Management.Automation.Language

$script:ShellType = @{
    CommandName = 'devcli'
    Options = @{
        Setup = @('doctor', 'install')
        Completion = @('bash', 'zsh', 'fish', 'powershell')
        Global = @('--version', '--help', '-v', '-h')
        SubCommands = @('setup', 'completion', 'doctor', 'install', 'bash', 'zsh', 'fish', 'powershell')
    }
}

$devcliCompleter = {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandName = $commandAst.CommandElements[0].Value
    $tokenCount = $commandAst.CommandElements.Count

    if ($tokenCount -eq 1) {
        $script:ShellType.Options.SubCommands | ForEach-Object {
            [CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
        return
    }

    $secondToken = $commandAst.CommandElements[1].Value

    switch ($secondToken) {
        'setup' {
            if ($tokenCount -eq 2) {
                $script:ShellType.Options.Setup | ForEach-Object {
                    [CompletionResult]::new($_, $_, 'ParameterValue', $_)
                }
            }
        }
        'completion' {
            if ($tokenCount -eq 2) {
                $script:ShellType.Options.Completion | ForEach-Object {
                    [CompletionResult]::new($_, $_, 'ParameterValue', $_)
                }
            }
        }
        default {
            $script:ShellType.Options.Global | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                [CompletionResult]::new($_, $_, 'ParameterValue', $_)
            }
        }
    }
}

Register-ArgumentCompleter -CommandName 'devcli' -ScriptBlock $devcliCompleter
`;
}

export function generateCompletion(shell: string): string {
	assertShell(shell);

	switch (shell) {
		case "bash":
			return generateBashCompletion();
		case "zsh":
			return generateZshCompletion();
		case "fish":
			return generateFishCompletion();
		case "powershell":
			return generatePowerShellCompletion();
	}
}
