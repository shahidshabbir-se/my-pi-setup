# pi-input

Compact input bar and footer for pi, with draft stashing and shortcut help.

## Input shortcuts

- **Ctrl+S with text:** stash the draft and clear the editor.
- **Ctrl+S on empty input:** restore the latest stashed draft, including its cursor position and collapsed pasted text. Restoration does not submit it.
- **? on empty input:** toggle shortcut help. Use **↑/↓** to scroll in short terminals. Press **?** or **Esc** to close, or start typing to resume input.
- **? within a draft or bracketed paste:** ordinary text.

Repeated stashes are restored newest-first, so an earlier draft is not overwritten. The bottom border shows the stash count and the applicable Ctrl+S action. Stashes are in memory for the current editor/session only; they do not survive restart, session replacement, or extension reload. Undo does not cross stash/restore transitions.

Shortcut-help hints are hidden from the border; `?` still works on empty input. Previously submitted user prompts on the active branch are restored to Up/Down history when the editor is recreated by `/reload`.

Explicit host remappings and other extensions that already handle Ctrl+S take precedence over stashing. Help uses the active pi keybindings for common editing and application actions. `/hotkeys` remains the full reference, including other extensions. Existing shell mode, autocomplete, and agent controls remain provided by pi.

## Development

Behavior tests exercise the installed pi editor, not a replacement implementation:

```sh
bun test tests/*.test.ts
```

The tests require `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` to resolve from local `node_modules` (links to an existing pi installation are sufficient). Tested with pi 1.2.0. The snapshot bridge in `prompt-editor.ts` accesses pi-tui's private draft fields because its public interface does not expose cursor/paste restoration; rerun the tests when updating pi.

Live tests launch the installed pi in a real PTY, exercise regular and fullscreen modes, and use SDK-created synthetic sessions without making model requests:

```sh
nix-shell -p python3Packages.pyte --run 'python3 tests/live-input.py'
nix-shell -p python3Packages.pyte --run 'python3 tests/live-input.py --configured'
```

Both runs use your keybindings. `--configured` additionally loads your installed extension packages in a temporary profile, without copying authentication or changing your settings. The Python language server outside `nix-shell` may report `pyte` as unavailable; the live-test command supplies it temporarily.

See [input UX research](docs/input-ux-research.md) for the reference-tool comparison and deferred ideas.
