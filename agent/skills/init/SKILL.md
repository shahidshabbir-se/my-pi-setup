---
name: init
description: Set up project docs, coding standards, architecture, and ADR scaffolding. Works for greenfield and existing repos.
---

# Init

Set up a project's documentation and standards from scratch or reconcile existing conventions with best practices.

## When to use

- User says "init", "set up docs", "setup project", "initialize docs", or runs /init
- New project needs documentation scaffolding
- Existing project needs its conventions documented

## Task tracking

At the very start of init, create the following tasks using `TaskCreate`:

- Detection (Explore)
- Grilling + Skill opportunities
- Producing core files
- Skills proposal (Phase 5)
- Report + Commit

Use `TaskUpdate` to mark them in progress or complete as you move through phases.
Use `TaskList` to review status when needed.

This keeps complex init sessions organized and visible.

## Hard Gates (non-negotiable)

- **Phase 2 gate**: Phase 4 cannot begin until Phase 2's frontier is empty. This means: keep asking `ask_user_question` rounds of exactly 3, recomputing the frontier after every round, until either (a) the frontier is empty, or (b) every remaining frontier item has an explicit skip-list entry with `path:line` evidence or a stated reason it can't be resolved by asking. **A single answered round does not satisfy this gate by itself** — if the frontier still has open items after a round, ask another round. "User was quiet" is not a skip. Existing `CONTEXT.md` is evidence for *those* terms only.
- **Phase 5 gate**: Phase 6 cannot begin until the interactive proposal in Phase 5 has been reviewed and explicitly approved by the user.
- **No main-session scanning**: Phase 1 must use Explore. Main session may only `read` paths named by Explore.
- **No `web_search` in main session**: Research gaps must spawn a `researcher` subagent.

## Phase 1 — Detection

Spawn one Explore subagent and wait for the result:

```ts
subagent_spawn({ agentType: "explore", prompt: "..." })
```

**Non-coding project detection** (enhanced):
After Explore results, check for strong non-coding signals:

- High ratio of documentation files (`.md`, `.txt`, `docs/`, `content/`)
- Absence of source code folders (`src/`, `apps/`, `packages/*/src`)
- No package manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`)
- Presence of research/writing-oriented files

If detected as non-coding, switch to **General Project Mode**:

- Skip `docs/coding-standards.md` and `docs/testing.md`
- Adapt `docs/ARCHITECTURE.md` to focus on project structure, content organization, and workflows
- Still create core files (`AGENTS.md`, `docs/README.md`, `docs/adr/`)
- Emphasize documentation and process conventions

## Phase 2 — Grilling (hard gate)

Read and follow (no wrapper):

- `grilling` — `~/.pi/agent/git/github.com/mattpocock/skills/skills/productivity/grilling/SKILL.md`
- `domain-modeling` — `~/.pi/agent/git/github.com/mattpocock/skills/skills/engineering/domain-modeling/SKILL.md`

**When asking the user anything during grilling, you MUST use the `ask_user_question` tool.** Never print questions in plain text. Use batches of exactly 3.

### Loop until convergence (do not stop after one round)

Grilling is a loop, not a single Q&A exchange. After each batch of 3 is answered:

1. Recompute the frontier — what's still unknown, ambiguous, or unconfirmed given the answers so far.
2. If the frontier is non-empty, ask another batch of exactly 3. Do not stop just because one round has already happened — the Phase 2 gate checks frontier convergence, not round count.
3. Stop asking only when one of these is true:
   - The frontier is empty.
   - Two consecutive rounds produced no new frontier progress (diminishing returns) — record what remains as a skip list with `path:line` or a stated reason.
   - The user explicitly asks to stop or defers the rest — record the remaining frontier as a skip list, citing the user's decision as the reason. This is different from silence: an explicit "skip this" or "use your judgment" is a real skip; getting no response, or a non-answer, is not.
4. Before moving to Phase 3, state the final frontier status out loud (empty, or skip list with reasons) so the Phase 2 gate check is auditable.

Grill for:

- Project purpose, domain, boundaries
- Irreversible architectural decisions (ADR gates)
- Glossary terms
- Repeated procedures or complex workflows that would benefit from being a reusable skill
- Any gaps not already locked with evidence in existing docs

When repeated workflows or multi-step procedures appear during grilling, ask:

> "I see repeated work around X. Want to turn this into a project skill?"

**Every project-specific claim** must come from exactly one of:

1. Observed in the codebase
2. Grilled (locked decision)
3. Researched and justified (industry practice appropriate here; explicit user agreement only for consequential project-specific decisions)

If the frontier is empty or every remaining question is already evidenced, record the skip list with `path:line` and proceed. Otherwise the gate blocks.

## Phase 3 — Apply skill-encoded best practices

**Non-coding project note**: Skip `codebase-design` and `domain-modeling` if this is a non-coding project (they are code-oriented). Focus on general documentation structure instead.

Read (paths listed so agents do not hunt):

| Skill | Path | Shapes |
| --- | --- | --- |
| codebase-design | `~/.pi/agent/git/github.com/mattpocock/skills/skills/engineering/codebase-design/SKILL.md` | coding-standards.md, architecture.md |
| domain-modeling | `~/.pi/agent/git/github.com/mattpocock/skills/skills/engineering/domain-modeling/SKILL.md` | glossary.md, docs/adr/ |
| research | `~/.pi/agent/git/github.com/mattpocock/skills/skills/engineering/research/SKILL.md` | Gap-filling only |

`grilling` was already consumed in Phase 2.

**Degradation**: missing skill → continue and report what was skipped. No glossary if domain-modeling absent. Shallower standards if codebase-design absent.

Research gaps only: framework conventions, latest security advisories, tool-specific patterns. Never embed book references as required reading.

## Phase 4 — Produce files + Filename reconcile + Slim AGENTS.md

**Filename casing convention**:

- Root-level files → **uppercase** (`AGENTS.md`, `README.md`, `CONTEXT.md`, `ARCHITECTURE.md`)
- Files inside `docs/` → **lowercase** (`docs/coding-standards.md`, `docs/architecture.md`, `docs/testing.md`, `docs/adr/template.md`)

**Non-coding project mode**: Skip `docs/coding-standards.md` and `docs/testing.md`. Adapt `docs/ARCHITECTURE.md` to focus on project structure and workflows.

### Filename reconcile rule (run before any write)

- If a file with the same logical name already exists on disk (any case, any location the spec allows), update **in place**. Never create a second copy.
- Canonical path = the path that already exists.
- `docs/README.md` links to the real path on disk.
- Root `CONTEXT.md` / `ARCHITECTURE.md` are allowed **only** as 3–10 line pointers when the body lives under `docs/` and tools look for the root name. Otherwise the body lives under `docs/`.

### Locked file set (always written unless gate says otherwise)

1. `docs/adr/README.md` — how to add an ADR, three gates, numbering.
2. `docs/adr/template.md` — Title, Status, Context, Decision, Consequences.
3. `docs/adr/0000-use-architecture-decision-records.md` — only if `docs/adr/` has no numbered ADRs yet.
4. `docs/coding-standards.md` — Observed, New, On-touch, Rejected, In-repo examples.
5. `docs/architecture.md` — omit-capable C4-ish outline (Purpose, Context, Containers, Module map, Domain, Quality attributes, Constraints, Key flows, ADR links, Known debt). Three explicit layers: Observed / Agreed / Unresolved. Every claim traceable.
6. `docs/testing.md` — if tests exist or convention stated.
7. `docs/glossary.md` — only if new terms were resolved in Phase 2 (domain-modeling owns it).
8. `docs/README.md` — index written last.
9. `AGENTS.md` handling strategy:
   - If no `AGENTS.md` exists → create a comprehensive one in the rich contract style.
   - If a rich `AGENTS.md` already exists → merge in missing critical sections (Doc sync rule, ADR trigger rule, Self-improve, Boundaries, Commands if outdated) without destroying existing content or tone.
   - Only consider slimming if the existing file is clearly bloated, repetitive, or low-signal.
   - Always ensure the following are present: Doc sync rule, ADR trigger rule, Self-improve process.
10. Root `README.md` — add "Project docs" link only; never replace.

**Doc sync rule** (written into the new `AGENTS.md`):

> Docs are part of the codebase. If your change affects a doc's accuracy, update that doc in the same session. Specific triggers:
>
> - New dependency or tool → update the architecture doc (tech stack)
> - New module, service, or directory structure change → update the architecture doc (module map)
> - Naming or pattern change → update coding-standards.md
> - Test framework, strategy, or coverage change → update testing.md
> - New domain term or term meaning change → update glossary.md
> - Architectural decision (hard to reverse, surprising without context, real trade-off) → create ADR from `docs/adr/template.md`
> - Root or package scripts added, removed, or renamed → update the Commands section in `AGENTS.md`
>
> If a doc does not exist yet and the trigger fires, create it. Do not wait for /init.

**ADR trigger rule** (also written into `AGENTS.md`):

> If a change introduces or reverses a significant architectural decision, check the three ADR gates and create a new ADR when appropriate.

### Optional root stubs

Only create 3–10 line pointers at root `CONTEXT.md` or `ARCHITECTURE.md` if tools look for those exact names and the body already lives under `docs/`.

### CLAUDE.md — not created

Claude Code reads `AGENTS.md` natively when no `CLAUDE.md` is present in the project (added in Claude Code v2.1.277, September 18, 2026; not yet available on Bedrock, Vertex, or Foundry). Do not create a `CLAUDE.md` symlink or stub for Claude Code compatibility — `AGENTS.md` alone is sufficient, and adding a `CLAUDE.md` would only shadow it.

If a `CLAUDE.md` already exists on disk from before this behavior shipped (or from another tool's setup), leave it in place per the filename reconcile rule rather than deleting it, but flag it in the Phase 6 report: it is now redundant and, if the project uses Bedrock/Vertex/Foundry, still the only way Claude Code will pick up project instructions there.

## Phase 5 — Skills proposal (interactive)

This phase supports multiple rounds until the user confirms.

**Step 1: Build proposal**
From Phase 2 grilling + exploration, collect repeated workflows and complex procedures.

**Step 2: Present proposal**
Show a clear list with:

- Suggested skill name
- One-sentence purpose
- When it would trigger

**Step 3: Collect feedback**
Use `ask_user_question` to let the user:

- Approve as-is
- Edit names or purposes
- Drop some items
- Add new ones
- Skip entirely

**Step 4: Repeat if needed**
If the user made edits, present the updated proposal and ask again.

**Step 5: Final confirmation**
Only after explicit approval, create the skills in `.agents/skills/<name>/SKILL.md` — **not** `.claude/skills/`. This project's skills stay under the harness-neutral `.agents/` tree (same reasoning as `AGENTS.md` over `CLAUDE.md`), so they work across Claude Code, Codex, and other agents that read that convention.

When writing skills, follow these quality guidelines:

- Strong `description` in frontmatter
- Clear "When to use" section
- Concrete steps or reference
- Keep focused (one purpose per skill)

Never duplicate core skills (init, audit, grilling, domain-modeling, etc.).

## Phase 6 — Report + Commit

List created files, skipped files with reason, skills used, skills missing (degraded), optional files declined, and any filename reconciliations performed. Also state how Phase 2 concluded: frontier empty, or the skip list with each item's `path:line` or reason — including whether that skip came from convergence, diminishing returns, or the user stopping early.

At the end, ask the user in this order:

1. "Would you also like to run `setup-matt-pocock-skills` to configure issue tracker, triage labels, and domain docs?"
2. "Would you like to commit these changes now, or skip git?"

## Idempotence & Re-runs

- Existing docs updated in place, never duplicated.
- No duplicate ADRs.
- Glossary edits owned by domain-modeling are never overwritten.
- On re-runs, detect what's already good and only suggest improvements instead of re-proposing everything.
- `AGENTS.md` is intelligently merged toward the rich contract style (not blindly slimmed).
- Report what changed vs what was already correct.

## Ownership (no two writers)

- init creates ADR infrastructure and may backfill.
- domain-modeling owns glossary generation and new ADRs that pass the gates.
- init owns `docs/**` except `docs/glossary.md`.
- grilling owns the interview; it writes nothing.

## Locked file set reference (final)

**Always**: docs/README.md, docs/coding-standards.md, docs/architecture.md, docs/adr/README.md, docs/adr/template.md, docs/adr/0000-*.md (when `docs/adr/` empty), AGENTS.md (rich contract style, intelligently merged on existing projects).

**Conditional**: docs/glossary.md, docs/adr/0001-*.md, docs/testing.md, docs/context-map.md.

**Ask first**: handled interactively in Phase 5 (human docs, full-tier, AGENTS.local.md, project skills at `.agents/skills/<name>/SKILL.md` — never `.claude/skills/`).

**Never invent**: LICENSE.

**Never in kit**: CLAUDE.md (unless already present on disk), ROADMAP.md, FAQ.md, GOVERNANCE.md, threat-model stubs, OpenAPI dumps, docs/c4/, second agent instruction files, empty TODO shells.

## Build-mode exception

`/init` and `/audit` are explicit documentation requests. Build mode is allowed to create and edit the locked set for these two commands only. All other "never proactively create docs" rules remain.
