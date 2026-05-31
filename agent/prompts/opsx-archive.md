---
description: Archive a completed OpenSpec change
---

Archive a completed OpenSpec change.

**Input**: Optionally specify a change name after `/opsx-archive` (e.g., `/opsx-archive add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous, prompt for available changes.

Steps:

1. If no change name is provided, run:
   ```bash
   openspec list --json
   ```
   Ask the user to select an active change.

2. Check artifact completion:
   ```bash
   openspec status --change "<name>" --json
   ```
   Warn if artifacts are incomplete and ask before continuing.

3. Check task completion in the tasks file, if one exists. Warn if incomplete tasks remain.

4. If delta specs exist under `openspec/changes/<name>/specs/`, compare them with `openspec/specs/<capability>/spec.md` and ask whether to sync before archiving.

5. Archive the change:
   ```bash
   mkdir -p openspec/changes/archive
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```

6. Show archive summary: change name, archive path, spec sync status, and warnings.
