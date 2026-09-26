# Pi Setup

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi setup](https://img.shields.io/badge/Pi-Coding%20Agent-blueviolet)](https://github.com/earendil-works/pi)

A public, reproducible [Pi Coding Agent](https://github.com/earendil-works/pi) setup: agent instructions, custom agents, skills, and TypeScript extensions that extend the TUI and the agent loop.

This repo tracks configuration and source only — not secrets, auth state, package caches, sessions, or local runtime data.

## Why use this?

Setting up an AI coding environment gets messy fast. Agents, skills, editor UI, long-running processes, and session bookkeeping all need to fit together. This repo is a working baseline you can inspect, fork, and adapt instead of starting from a blank config.

Good fit if you want:

- background process management wired into the agent loop
- automatic per-run session summaries with secret redaction
- AI-generated session names
- a custom editor with context/token readouts
- a set of opinionated engineering-principles instructions
- skills for design review, agent engineering, and self-improvement

## What this includes

- **`APPEND_SYSTEM.md`** — standing instructions appended to every run: environment notes (NixOS, `nix-shell`), engineering principles, task handling, delegation rules, and an agent-engineering governance framework.
- **Agents** — four subagent definitions covering planning, codebase exploration, general autonomous work, and time-sensitive research.
- **Skills** — six task-scoped instruction sets (see below).
- **Extensions** — seven TypeScript extensions that add tools and UI to Pi.
- **Config** — `settings.json`, `keybindings.json`, `mcp.json`, `tasks-config.json`, `prompt-improve.json`, `pi-input.json`, and skill-gate configuration.

## Agents

| Agent | Purpose |
| --- | --- |
| `Plan` | Implementation planning. |
| `explore` | Fast read-only codebase search and analysis. |
| `general-purpose` | Self-contained multi-step work that needs full tool access. |
| `researcher` | Time-sensitive or version-specific research. |

## Skills

| Skill | Purpose |
| --- | --- |
| `agent-browser` | Browser automation CLI for navigating, filling, clicking, and scraping. |
| `agent-engineering` | Framework for choosing the right mechanism — rule, skill, constraint, verification, eval, or observability. |
| `init` | Scaffold project docs, standards, architecture, and ADRs. |
| `redesign` | Audit and upgrade an existing app to higher visual quality. |
| `self-improve` | Turn a concrete agent mistake into a durable, versioned rule. |
| `taste` | Anti-slop frontend design guidance for landing pages and redesigns. |

## Extensions

| Extension | What it does |
| --- | --- |
| `background-terminals` | Adds `bg_start` / `bg_status` / `bg_list` / `bg_kill` so the agent can run long-lived processes it can inspect and stop but never write to. Shows a running-count widget and a `/ps` overlay. Built on Effect v4. |
| `pi-summary` | Summarizes each run on exit and saves a recap, redacting secrets from the transcript. Reports token usage. Built on Effect v4. |
| `pi-session-rename` | Names sessions automatically with a configurable model. |
| `pi-input` | Custom editor with a context/token footer readout. |
| `copy-all` | Copy-all binding for the editor. |
| `herdr-agent-state` | State bridge for the `herdr` agent orchestrator. Machine-managed — reinstalling the integration overwrites it. |

`background-terminals` and `pi-summary` ship unit tests (`*.test.ts`). Run them with the package's configured test runner after installing dependencies.

## Repository layout

```text
agent/
  APPEND_SYSTEM.md                       # Standing instructions for every run
  settings.json                          # Packages, theme, model and UI defaults
  keybindings.json                        # Key bindings
  mcp.json                               # MCP servers (empty by default)
  tasks-config.json                      # Task-list glyphs
  pi-input.json                          # pi-input extension config
  prompt-improve.json                    # Prompt-improvement extension config
  config/
    skill-gate.json                      # Per-skill enable/disable
    skill-gate-analytics.json            # Skill usage analytics
  agents/                                # Subagent definitions
  skills/                                # Skill definitions
  extensions/                            # TypeScript extensions
```

## What is not included

The following are intentionally ignored and should not be committed:

- `.env*`, auth files, secrets, tokens, credentials
- `agent/trust.json` and `agent/models.json` — machine-local; they contain absolute home paths and private project locations
- Pi sessions, runtime state, and `.pi/` task state
- installed packages, `agent/git/`, `agent/npm/`, and `node_modules/`
- logs, caches, checkpoints, and model/provider caches

See `.gitignore` for the full list. The ignore rules also match `**/*secret*`, `**/*token*`, `**/*credential*`, and `*.jsonl` as a safety net.

## Prerequisites

- [Pi Coding Agent](https://github.com/earendil-works/pi)
- Node.js
- Bun (required by `background-terminals` and `pi-summary`, which depend on Effect v4)
- Git

## Install this setup

Back up your existing config first:

```bash
mkdir -p ~/.pi/agent-backup
cp -R ~/.pi/agent ~/.pi/agent-backup/ 2>/dev/null || true
```

Then copy the tracked config into place:

```bash
git clone https://github.com/shahidshabbir-se/my-pi-setup.git pi-setup
cd pi-setup

mkdir -p ~/.pi/agent
cp agent/settings.json          ~/.pi/agent/settings.json
cp agent/keybindings.json       ~/.pi/agent/keybindings.json
cp agent/mcp.json               ~/.pi/agent/mcp.json
cp agent/tasks-config.json      ~/.pi/agent/tasks-config.json
cp agent/pi-input.json          ~/.pi/agent/pi-input.json
cp agent/prompt-improve.json    ~/.pi/agent/prompt-improve.json
cp agent/APPEND_SYSTEM.md       ~/.pi/agent/APPEND_SYSTEM.md
cp -R agent/agents    ~/.pi/agent/agents
cp -R agent/skills    ~/.pi/agent/skills
cp -R agent/extensions ~/.pi/agent/extensions
cp -R agent/config    ~/.pi/agent/config
```

Install the packages declared in `agent/settings.json` using Pi's package manager, then restart Pi. Review the package list before installing — it includes themes, subagents, LSP tooling, browser automation, MCP, and context tools.

## Customizing

- `agent/settings.json` — packages, theme, default provider/model, UI behavior.
- `agent/APPEND_SYSTEM.md` — the standing instructions; this is the highest-leverage file to edit.
- `agent/agents/` and `agent/skills/` — add or edit agent and skill definitions.
- `agent/extensions/` — add or edit extensions.
- `agent/mcp.json` — MCP servers; empty by default, add your own.
- `agent/config/skill-gate.json` — enable or disable individual skills.

## Publishing changes from your local Pi config

Copy your live config outward, then commit:

```bash
cp ~/.pi/agent/settings.json agent/settings.json
cp ~/.pi/agent/APPEND_SYSTEM.md agent/APPEND_SYSTEM.md
cp -R ~/.pi/agent/agents agent/agents
cp -R ~/.pi/agent/skills agent/skills
cp -R ~/.pi/agent/extensions agent/extensions
git add -A && git commit -m "Update setup"
```

Do not commit auth files, sessions, caches, or `agent/trust.json` and `agent/models.json`.

## License

MIT — see [LICENSE](LICENSE).
