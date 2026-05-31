# Pi Setup

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi setup](https://img.shields.io/badge/Pi-Coding%20Agent-blueviolet)](https://github.com/earendil-works/pi)
[![Safety defaults](https://img.shields.io/badge/safety-YOLO%20off-success)](agent/extensions/pi-permission-system/config.json)

A public, reproducible Pi Coding Agent setup with curated agents, skills, MCP servers, safety defaults, and workflow extensions.

This repo is meant to be copied or adapted as a starting point for a productive Pi environment. It tracks configuration only — not secrets, auth state, package caches, sessions, or local runtime data.

## Why use this?

Setting up an AI coding environment gets messy fast: agents, skills, browser tooling, MCP servers, memory, permissions, and orchestration all need to fit together. This repo gives you a working baseline you can inspect, fork, and adapt instead of starting from a blank config.

Good fit if you want:

- a batteries-included Pi setup
- curated specialist agents and skills
- MCP-ready docs/reasoning tools
- conservative safety defaults
- a public template for your own AI coding workflow

## What this includes

- **Pi settings** — package list, default agent, theme, provider/model defaults, and UI preferences.
- **Agents** — reusable specialist agent definitions for planning, building, reviewing, testing, research, and orchestration.
- **Skills** — reusable task instructions for frontend, backend, testing, security, TypeScript, Rust, Docker, accessibility, and more.
- **MCP config** — ready-to-use entries for `sequential-thinking` and `context7`.
- **Permission policy** — conservative defaults that deny secrets, gate risky commands, and keep YOLO mode disabled.

## Repository layout

```text
agent/
  AGENTS.md                         # Global agent instructions
  settings.json                     # Pi packages and defaults
  mcp.json                          # MCP server config
  agents/                           # Agent definitions
  skills/                           # Skill definitions
  extensions/
    pi-permission-system/config.json # Safety/permission policy
```

## What is not included

The following are intentionally ignored and should not be committed:

- `.env*`, auth files, secrets, tokens, credentials
- Pi sessions and runtime state
- installed npm packages and `node_modules`
- Context/memory databases
- Babysitter `.a5c/` runs and local process state
- logs, caches, and backups

See `.gitignore` for the full list.

## Prerequisites

Install Pi and the required runtimes first:

- Pi Coding Agent
- Bun
- Node.js / npm
- Git

Some optional features may need extra system dependencies, such as browser dependencies for browser automation.

## Install this setup

Clone the repo:

```bash
git clone https://github.com/shahidshabbir-se/my-pi-setup.git pi-setup
cd pi-setup
```

Back up your existing Pi config before copying anything:

```bash
mkdir -p ~/.pi/agent-backup
cp -R ~/.pi/agent/settings.json ~/.pi/agent-backup/settings.json 2>/dev/null || true
cp -R ~/.pi/agent/mcp.json ~/.pi/agent-backup/mcp.json 2>/dev/null || true
cp -R ~/.pi/agent/agents ~/.pi/agent-backup/agents 2>/dev/null || true
cp -R ~/.pi/agent/skills ~/.pi/agent-backup/skills 2>/dev/null || true
cp -R ~/.pi/agent/extensions ~/.pi/agent-backup/extensions 2>/dev/null || true
```

Copy the tracked config into Pi:

```bash
mkdir -p ~/.pi/agent
cp agent/settings.json ~/.pi/agent/settings.json
cp agent/mcp.json ~/.pi/agent/mcp.json
cp agent/AGENTS.md ~/.pi/agent/AGENTS.md
cp -R agent/agents ~/.pi/agent/agents
cp -R agent/skills ~/.pi/agent/skills
cp -R agent/extensions ~/.pi/agent/extensions
```

Restart Pi after copying the config.

## Install packages

The expected package list is declared in `agent/settings.json`.

Use Pi’s package manager to install missing packages from that file. Review the package list before installing, especially in shared or work environments.

This setup currently expects packages for:

- themes and UI polish
- subagents
- todo/task tracking
- ask-user-question UI
- LSP/code navigation
- browser automation
- process management
- MCP adapter
- memory/context tools
- notifications
- Babysitter orchestration
- permission enforcement

## Verify the setup

Run:

```bash
pi --version
bun --version
node --version
npm --version
```

Then verify the key config files exist:

```bash
test -f ~/.pi/agent/settings.json
test -f ~/.pi/agent/mcp.json
test -f ~/.pi/agent/AGENTS.md
test -d ~/.pi/agent/agents
test -d ~/.pi/agent/skills
test -d ~/.pi/agent/extensions
```

If you use Babysitter, verify:

```bash
babysitter process-library:active --json
babysitter profile:read --user --json
```

If you use MCP tools, start Pi and confirm the MCP tools for `sequential-thinking` and `context7` are available.

## Safety defaults

The permission policy is intentionally conservative:

- YOLO mode is disabled.
- `.env` files and secrets are denied by default.
- SSH paths are denied.
- destructive shell commands are denied or ask-gated.
- global installs and Pi package changes are ask-gated.
- `git push` is denied by default.

Adjust `agent/extensions/pi-permission-system/config.json` if your workflow needs different tradeoffs.

## Customizing

Common changes:

- Update `agent/settings.json` to change packages, theme, provider, model, or default agent.
- Add or edit agent definitions in `agent/agents/`.
- Add or edit skills in `agent/skills/`.
- Add MCP servers in `agent/mcp.json`.
- Adjust safety rules in `agent/extensions/pi-permission-system/config.json`.

After making changes, restart Pi and run the verification steps again.

## Updating this repo from your local Pi config

If you change your live Pi config and want to publish those changes:

```bash
cp ~/.pi/agent/settings.json agent/settings.json
cp ~/.pi/agent/mcp.json agent/mcp.json
cp ~/.pi/agent/AGENTS.md agent/AGENTS.md
cp -R ~/.pi/agent/agents agent/agents
cp -R ~/.pi/agent/skills agent/skills
cp -R ~/.pi/agent/extensions agent/extensions
```

Do not commit auth files, sessions, caches, `.a5c/`, `node_modules`, or local databases.

## Recommended GitHub topics

If you fork or publish your own version, useful topics include:

```text
pi ai-coding coding-agent agents mcp developer-tools automation ai-workflow open-source
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
