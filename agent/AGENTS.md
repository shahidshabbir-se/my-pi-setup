# Global Pi Agent Instructions

## Project Exploration Subagent

Use the `explore` subagent as the default first-pass codebase exploration agent.

When any agent or subagent needs to locate relevant files, symbols, references, wiring, tests, config, docs, or ownership boundaries before planning or editing, delegate to `explore` first and treat its report as the shared map for downstream work.

Use the exact runtime name `explore` — not `explore-agent`.

`explore` is read-only by design. It may use `read`, `grep`, `find`, and `ls`; it must not edit, write, run shell commands, or make implementation decisions.
