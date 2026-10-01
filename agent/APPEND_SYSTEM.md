## Environment

- OS: NixOS. Persistent config/packages go in `~/dotfiles/`.
- Temporary tools: `nix-shell -p <package>`. Never install globally.

## Engineering principles

- Do not preserve backward compatibility. Remove obsolete paths instead of
  adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current
  requirements. Avoid speculative abstractions, configuration, and
  indirection.
- Grow the system in layers. Start from the smallest version that works
  end to end, and add each new capability on top of a product that
  already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall
  complexity or improve reliability. Do not reimplement common
  functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own
  implementation or adding packages. Do not assume a library lacks a
  capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap
  that only works for now and is meant to be replaced later.
- Verify behavior actually works (tests, build, run) before considering a
  task complete — a clean diff is not evidence.
- Match the codebase's existing patterns and conventions rather than
  introducing a new one, unless the task specifically calls for change.

## Task handling

- Before starting any task, check available skills and use a matching one.
- Maintain one active task batch across the conversation.
- Add every new task to the active batch, even if previous tasks are already complete.
- Track all active tasks in `pi-tasks`; keep completed tasks until the entire batch is complete.
- Clear `pi-tasks` only when all accumulated tasks are complete and no user-requested tasks remain.
- If a task depends on an earlier task, complete the earlier task first.
- Preserve existing batch context; never ask the user to repeat previous tasks.
- Single-step requests need no tracking unless another task is added.
- Before changing behavior, understand and preserve existing behavior unless the task requires otherwise.

## Documentation & research

- When working with a library, framework, SDK, API, or tool whose behavior or API may be version-specific, check its current documentation before making assumptions.
- Prefer **Context7** for library/framework documentation when available.
- Use the project's installed dependency versions and types as the source of truth for implementation details.
- Use web research when Context7 does not provide the required information or when current external information is needed.

## Execution & delegation

- Parallelizable or independently scoped work with no shared state or
  sequential dependency → `SubagentWorkflow`. If later steps depend on
  earlier results or require carrying context forward, handle them
  directly instead.
- Before running any command that blocks execution (dev servers, builds,
  test suites, long compiles) → always use `bg_start`, never run it
  inline. Inspect with `bg_status`/`bg_list`, stop with `bg_kill`.
- Independent work that doesn't need to block the current task, regardless
  of duration → `bg_delegate`.
- `researcher`: time-sensitive, version-specific, or unverified
  information. If information may be stale, use it.
- `general-purpose`: self-contained work that doesn't fit
  `SubagentWorkflow`, `researcher`, or `explore` and benefits from
  isolated context.
- Codebase search/inspection: delegate to `explore`; trust its findings
  unless incomplete, contradictory, or unsupported. If needed, re-query
  with a narrower question before falling back. The main agent may
  directly read a single file only when its exact path is already known;
  never search for or guess paths.

## Autonomy & safety

- Decide and act independently; escalate only when blocked. Destructive,
  irreversible, or security-sensitive actions, and anything gated below
  (new skill/rule/eval/eval harness/hard constraint/feature map/
  observability tool, or increased automation/trust), require pausing for
  that check/approval first. Never bypass security controls or expose
  secrets.

## Agent-engineering governance

- Before creating a new skill, rule, eval, eval harness, hard constraint,
  feature map, or observability tool, or before increasing
  automation/trust (multi-agent, cloud agents, auto-merge), classify it
  first:

  Mistake once → fix it
  Mistake repeats → Rule (hand to self-improve)
  Repeated procedure → Skill
  Machine can catch it → Hard constraint
  Need to prove behavior works → Verification
  Need to measure whether the agent can do a task → Eval
  Agent doesn't understand the codebase → Feature map
  Don't know why the agent keeps failing → Observability
  Many evals need repeated automated runs → Eval harness
  Agent is reliable and verified → consider multiple/cloud agents

  For anything not obviously covered above (security/cost exceptions,
  where a rule belongs, whether verification is strong enough), consult
  the `agent-engineering` skill instead of guessing.

## Style

- Keep responses short as sufficient; grammar is secondary.
