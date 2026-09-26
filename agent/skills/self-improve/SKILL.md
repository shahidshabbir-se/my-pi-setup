---
name: self-improve
description: Turn a concrete agent mistake into a durable, versioned rule in the project's AGENTS.md (or a skill file), so the same mistake doesn't happen twice. Use this whenever the user corrects Claude's behavior and the correction should apply again in future sessions on this project — e.g. "remember this", "add this as a rule", "make sure you don't do that again", "turn this into a skill". Do NOT use for one-off typos or single bad guesses with no reuse value, and do not use to encode a preference the user hasn't actually confirmed.
---

# Self-Improve

Turn a concrete agent failure into a versioned rule. `$ARGUMENTS` may name the mistake and the desired rule; if it doesn't, ask before writing anything.

## When NOT to use

- One-off typos or a single bad guess with no reuse value — just fix it, don't write a rule.
- The failure is really "the product/spec was ambiguous" and the user hasn't confirmed a preference yet — ask first instead of encoding a guess as a permanent rule.

## Steps

1. **Pin the failure** — One sentence: what the agent did wrong, and the correct behavior instead. If it doesn't clear the bar above, stop here.

2. **Pick the home** (first match wins):
   - Applies every session / every prompt in this repo → one bullet in the root `AGENTS.md`, under the tightest existing heading (or a new short heading only if nothing fits).
   - Applies to one app or package only → a nested `AGENTS.md` inside that package (create it only if the rule is likely to recur there).
   - Describes a multi-step workflow rather than a single rule → extend or add a skill under `.agents/skills/` instead of bloating `AGENTS.md`.

3. **Write the rule** — Positive, short, checkable. Match the existing tone of `AGENTS.md`. No essays. Prefer "do X" over a long list of "don't do Y." If the rule is really "look here for the answer," point at the path rather than restating the content.

4. **Dedupe** — Search `AGENTS.md` and nearby agent docs for the same idea already written down. Edit in place rather than adding a duplicate.

5. **Keep it lean** — If the root `AGENTS.md` is drifting long, move branch-specific detail into a skill or a nested file and leave a one-line pointer from the root.

6. **Report** — State the file changed, the exact rule text added or edited, and why it belongs there.

## Completion

Done when the durable rule is committed to the right file in the working tree, and any redundant wording elsewhere has been removed. Do not create a rule for a preference the user hasn't confirmed when the failure is product-ambiguous — ask first, per the guardrail above.
