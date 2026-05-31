# Contributing

Thanks for helping improve this Pi setup.

This repo is public-facing configuration, so contributions should be reusable, documented, and safe by default.

## Good contributions

- Better agent or skill definitions
- Safer permission defaults
- Clearer setup and verification docs
- MCP configuration improvements
- Cross-platform setup notes
- Bug fixes for broken paths or outdated package names
- Examples that help users adapt the setup

## Before opening a PR

1. Keep secrets and local state out of the repo.
2. Run a quick status check:

   ```bash
   git status --short
   git diff --check
   ```

3. Validate JSON files you changed:

   ```bash
   python3 -m json.tool agent/settings.json >/dev/null
   python3 -m json.tool agent/mcp.json >/dev/null
   python3 -m json.tool agent/extensions/pi-permission-system/config.json >/dev/null
   ```

4. If you changed docs, make sure setup commands are copy/paste friendly.
5. If you changed safety rules, explain the tradeoff clearly.

## Safety rules

Do not commit:

- `.env*` files
- auth files
- secrets, tokens, or credentials
- Pi sessions or runtime state
- `.a5c/` run state
- package caches or `node_modules`
- local databases, memory stores, logs, or backups

The default permission posture should remain conservative. Risky commands should be denied or ask-gated.

## Style

- Prefer simple Markdown.
- Use short sections with practical examples.
- Explain why a config exists, not only what it contains.
- Keep personal machine paths out of public docs.

## Commit messages

Use concise conventional-style commits when possible:

```text
docs: improve setup instructions
feat: add browser automation skill
fix: correct mcp config example
chore: update package list
```
