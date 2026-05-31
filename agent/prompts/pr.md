---
description: Create a PR description from commits
---

Generate a pull request description based on the commits on this branch.

Branch commits (compared to main):
!`git log --oneline main..HEAD 2>/dev/null || git log --oneline -20`

Summary of changes:
!`git diff --stat main..HEAD 2>/dev/null || echo "Unable to compare with main"`

Create a PR description with:
1. Summary section (2-3 bullet points)
2. Changes made (key modifications)
3. Testing performed
4. Any breaking changes or migration notes
