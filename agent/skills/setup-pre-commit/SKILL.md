---
name: setup-pre-commit
description: Set up Lefthook git hooks with staged-file formatting/linting using the repo's existing toolchain (Biome or ESLint + Prettier), plus optional commit-msg, pre-push, secret scanning, type checking, and tests. Use when user wants to add pre-commit hooks, set up Lefthook, configure staged-file checks, or add commit-time formatting/typechecking/testing.
---

# Setup Git Hooks with Lefthook

## What This Sets Up

- **Lefthook** git hook runner
- Fast **pre-commit** checks for staged files
- Staged-file formatting/linting with the repo's existing toolchain:
  - **Biome** when the repo already uses Biome
  - **ESLint + Prettier** when the repo uses ESLint/Prettier
  - **Prettier-only** fallback when neither Biome nor ESLint is present
- Optional **commit-msg** checks for Conventional Commits
- Optional **pre-push** checks for slower validation like build, full tests, or E2E
- Optional **secret scanning** to prevent accidental credential commits
- Optional **monorepo-aware** commands for Turbo, Nx, and workspaces

## Principles

- Prefer the repo's existing formatter/linter instead of imposing a new stack.
- Keep `pre-commit` fast and staged-file focused.
- Put slower whole-repo checks in `pre-push` or CI.
- Mirror important CI checks locally, but never treat hooks as a CI replacement.
- Ask before overwriting existing hook/config files with non-trivial custom logic.

## Steps

### 1. Detect package manager

Check for `package-lock.json` (npm), `pnpm-lock.yaml` (pnpm), `yarn.lock` (yarn), `bun.lockb` / `bun.lock` (bun). Use whichever is present. Default to npm if unclear.

Use package-manager-appropriate commands:

- npm: `npx lefthook install`, `npm run <script>`
- pnpm: `pnpm exec lefthook install`, `pnpm run <script>`
- yarn: `yarn lefthook install`, `yarn <script>`
- bun: `bunx lefthook install`, `bun run <script>`

### 2. Detect repo shape

Inspect `package.json`, lockfiles, and root config files.

Check for monorepo tooling:

- `turbo.json` or `turbo` dependency/scripts
- `nx.json` or `nx` dependency/scripts
- `pnpm-workspace.yaml`
- npm/yarn/bun `workspaces` in `package.json`

If it is a monorepo, prefer affected/package-scoped commands when available instead of running every package on every commit.

Examples:

- Turbo: `turbo run lint typecheck test --filter=...[HEAD]`
- Nx: `nx affected -t lint,test,typecheck`
- pnpm workspaces: `pnpm -r --filter "...[HEAD]" <script>` when supported by the repo

### 3. Detect existing code-quality tools

Inspect `package.json` scripts/devDependencies and config files before adding anything.

Prefer the repo's existing setup in this order:

1. **Biome** if any of these exist:
   - `biome.json`, `biome.jsonc`
   - `@biomejs/biome` in dependencies/devDependencies
   - scripts using `biome`
2. **ESLint + Prettier** if ESLint is present and Prettier is present or desired by existing scripts/config:
   - ESLint config: `eslint.config.*`, `.eslintrc*`, or `eslint` dependency
   - Prettier config: `.prettierrc*`, `prettier.config.*`, or `prettier` dependency
3. **Prettier-only fallback** if neither Biome nor ESLint is configured

Also detect existing scripts and prefer them where they clearly match intent:

- `format`, `format:check`
- `lint`, `lint:fix`
- `check`
- `typecheck`, `type-check`, `tsc`
- `test`, `test:unit`, `test:ci`
- `build`
- `e2e`, `test:e2e`

Do **not** force a repo from Biome to ESLint/Prettier or from ESLint/Prettier to Biome unless the user explicitly asks.

### 4. Install dependencies

Install `lefthook` as a devDependency.

Also install only the missing tools required by the chosen path.

#### Biome repo

```
lefthook @biomejs/biome
```

Only add `@biomejs/biome` if Biome is configured but not installed.

#### ESLint + Prettier repo

```
lefthook prettier
```

Only add `prettier` if the repo uses Prettier but it is not installed. Do not add ESLint automatically unless the repo already has ESLint config/scripts but is missing the package.

#### Prettier-only fallback

```
lefthook prettier
```

#### Optional Conventional Commits

If the repo uses Conventional Commits or the user wants commit message validation:

```
lefthook @commitlint/cli @commitlint/config-conventional
```

#### Optional secret scanning

Prefer an existing secret scanning tool if already configured. If not, recommend one of:

- `gitleaks` for a strong default secret scanner
- `detect-secrets` when the repo already uses Python/security tooling around it

Do not add secret scanning if installation would require unmanaged system dependencies without asking.

### 5. Initialize Lefthook

```bash
npx lefthook install
```

Adapt `npx` to the detected package manager (`pnpm exec`, `yarn`, or `bunx`).

Add a `prepare` script to `package.json` if missing:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  }
}
```

If a `prepare` script already exists, preserve it and ask before overwriting. Prefer combining only when it is safe and obvious.

### 6. Create `lefthook.yml`

Choose one of these templates based on detected tooling.

#### Biome template

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{js,jsx,ts,tsx,json,jsonc,css,graphql,md,mdx,yml,yaml}"
      run: npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
      stage_fixed: true
```

#### ESLint + Prettier template

```yaml
pre-commit:
  parallel: true
  commands:
    prettier:
      glob: "*.{js,jsx,ts,tsx,json,jsonc,css,scss,md,mdx,yml,yaml,html}"
      run: npx prettier --ignore-unknown --write {staged_files}
      stage_fixed: true
    eslint:
      glob: "*.{js,jsx,ts,tsx}"
      run: npx eslint --fix {staged_files}
      stage_fixed: true
```

#### Prettier-only fallback template

```yaml
pre-commit:
  parallel: true
  commands:
    prettier:
      glob: "*.{js,jsx,ts,tsx,json,jsonc,css,scss,md,mdx,yml,yaml,html}"
      run: npx prettier --ignore-unknown --write {staged_files}
      stage_fixed: true
```

**Adapt**:

- Replace `npx` with the detected package manager.
- Prefer existing `lint:fix`, `format`, or `check` scripts if they already accept file arguments or are clearly intended for staged-file checks.
- Keep `stage_fixed: true` for commands that modify staged files.
- Exclude generated files through the tool's ignore config, not by hardcoding fragile hook logic.
- Avoid commands that rewrite lockfiles in pre-commit unless the user explicitly wants that.

### 7. Add optional `pre-push` checks

Add `pre-push` for slower checks when matching scripts exist.

```yaml
pre-push:
  parallel: true
  commands:
    typecheck:
      run: npm run typecheck
    test:
      run: npm run test
    build:
      run: npm run build
```

**Adapt**:

- Replace `npm run` with the detected package manager.
- Omit commands for scripts that do not exist.
- Prefer `test:ci` over `test` when both exist and `test` is watch-mode.
- Prefer `test:unit` for pre-push and leave E2E for CI unless the user asks.
- For monorepos, prefer affected commands (`turbo`, `nx affected`, or workspace filters).

### 8. Add optional `commit-msg` checks

If Conventional Commits are used, add:

```yaml
commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

Create `commitlint.config.cjs` if no commitlint config exists:

```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
```

Do not add commitlint if the repo uses a different commit convention unless the user asks.

### 9. Add optional secret scanning

If `gitleaks` is available/configured, add a pre-commit command:

```yaml
pre-commit:
  commands:
    secrets:
      run: gitleaks protect --staged --verbose
```

If using `detect-secrets`, prefer the repo's existing baseline workflow and document how to update the baseline.

Secret scanning should fail closed for real leaks, but avoid noisy defaults that block every commit without a baseline or config.

### 10. Create formatter config only when needed

#### Biome

Only create `biome.json` if Biome is the chosen tool and no Biome config exists.

```json
{
  "$schema": "https://biomejs.dev/schemas/latest/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

#### Prettier

Only create `.prettierrc` if Prettier is used and no Prettier config exists. Use these defaults:

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

Do not create a Prettier config for a Biome-only repo unless the user asks.

### 11. Add local overrides support

Optionally create or update `.gitignore` with:

```gitignore
lefthook-local.yml
```

Use `lefthook-local.yml` for developer-specific overrides only. Do not commit it.

### 12. Verify

- [ ] `lefthook.yml` exists
- [ ] Lefthook is installed as a devDependency
- [ ] `prepare` script installs Lefthook, or an existing prepare script was preserved intentionally
- [ ] Tooling matches the repo: Biome, ESLint + Prettier, or Prettier-only fallback
- [ ] Formatter/linter config exists only when needed
- [ ] Optional `commit-msg` only exists when commit convention is confirmed
- [ ] Optional `pre-push` only runs scripts that exist and are not watch-mode
- [ ] Optional secret scanning is configured with a low-noise baseline/config
- [ ] Run `npx lefthook run pre-commit` to verify it works (adapt to package manager)
- [ ] If configured, run `npx lefthook run pre-push` and `npx lefthook run commit-msg --args ".git/COMMIT_EDITMSG"`

### 13. Commit

Stage all changed/created files and commit with a message matching the repo's convention, for example:

```
chore: add lefthook git hooks
```

This will run through the new hooks — a good smoke test that everything works.

## Notes

- Lefthook is fast, language-agnostic, and keeps hook configuration in `lefthook.yml`.
- Prefer the repo's existing formatter/linter rather than imposing a new stack.
- `prettier --ignore-unknown` skips files Prettier can't parse (images, etc.).
- `biome check --write` formats and applies safe fixes where supported.
- The pre-commit should be fast. Put slow full test suites in `pre-push` unless the user specifically wants them in `pre-commit`.
- CI remains the source of truth for final validation.
