---
description: Implement tasks from an OpenSpec change
---

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name (e.g., `/opsx-apply add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous, prompt for available changes.

Steps:

1. Select the change.
   - If a name is provided, use it.
   - Otherwise infer from context, auto-select only if one active change exists, or run `openspec list --json` and ask the user to select.

2. Check status:
   ```bash
   openspec status --change "<name>" --json
   ```

3. Get apply instructions:
   ```bash
   openspec instructions apply --change "<name>" --json
   ```

4. Read all context files listed in the apply instructions output.

5. Show current progress: schema, task count, remaining tasks, and current instruction.

6. Implement pending tasks one by one:
   - Keep changes minimal and focused.
   - Mark each completed task in the tasks file (`- [ ]` -> `- [x]`).
   - Continue until complete or blocked.

Pause if a task is unclear, implementation reveals a design issue, an error occurs, or the user interrupts.

On completion, show the change name, schema, completed tasks, and suggest `/opsx-archive`.
