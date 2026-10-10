---
description: Create a focused Git commit with context-aware analysis and safety checks
---

1. Analyze changes in the repository:
   - First inspect staged changes.
   - If there are no staged changes, inspect unstaged changes instead.

2. Analyze recent commit history to understand:
   - Commit message style and conventions
   - Logical grouping patterns
   - Ongoing features, refactors, or fixes
   - Whether current changes relate to recent work

3. Determine logical groupings among the current changes:
   - Identify a single coherent theme for one atomic commit.
   - Examples: fixing one bug, implementing one feature, refactoring one module, or updating related docs.
   - Do NOT stage everything automatically.

4. Select only the files that belong to the primary coherent group:
   - Stage only those files.
   - Explicitly exclude unrelated files.
   - Inform the user which files were excluded and why.

5. Before committing, scan the staged changes for:
   - CRITICAL-level bugs
   - SEVERE security vulnerabilities

   If any such issues are found:
   - Abort the commit.
   - Report findings clearly.
   - Do not create a partial commit.

6. If all checks pass:
   - Generate a concise, context-aware commit message.
   - Ensure it aligns with previous commit style.
   - Ensure the message accurately describes all included changes.

7. Create the commit using only the grouped, staged files.
