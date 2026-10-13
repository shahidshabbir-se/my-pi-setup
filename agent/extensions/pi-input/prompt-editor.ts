import { CustomEditor, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { decodeKittyPrintable, matchesKey, truncateToWidth, type EditorTheme, type Keybinding, type TUI } from "@earendil-works/pi-tui";

type Draft = {
	state: { lines: string[]; cursorLine: number; cursorCol: number };
	pastes: Map<number, string>;
	pasteCounter: number;
};

// pi-tui 1.2 exposes getCursor/getExpandedText, but no draft restore interface.
// Keep access to its private draft fields here so collapsed pastes and cursor
// positions survive without expanding or reinterpreting their visible markers.
type EditorDraftState = Draft & {
	isInPaste: boolean;
	jumpMode: "forward" | "backward" | null;
	preferredVisualCol: number | null;
	snappedFromCursorCol: number | null;
	undoStack: { clear(): void };
};

const HELP_ACTIONS: Keybinding[] = [
	"tui.input.submit",
	"tui.input.newLine",
	"tui.input.tab",
	"tui.editor.cursorUp",
	"tui.editor.cursorDown",
	"tui.editor.undo",
	"app.interrupt",
	"app.clear",
	"app.editor.external",
	"app.message.followUp",
	"app.message.dequeue",
	"app.model.select",
	"app.thinking.cycle",
	"app.clipboard.pasteImage",
];

export class PromptEditor extends CustomEditor {
	private drafts: Draft[] = [];
	private showingHelp = false;
	private helpOffset = 0;
	private helpPageSize = 1;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		private helpKeybindings: KeybindingsManager,
	) {
		super(tui, theme, helpKeybindings);
	}

	private get draftState(): EditorDraftState {
		// SAFETY: pi-tui 1.2 Editor stores these runtime fields; its declarations
		// mark them private. Integration tests exercise this exact installed shape.
		return this as unknown as EditorDraftState;
	}

	handleInput(data: string): void {
		// A literal '?' or control byte within a bracketed paste is content.
		if (this.draftState.isInPaste || data.includes("\x1b[200~")) {
			super.handleInput(data);
			return;
		}
		// Character-jump targets are editor input, even when they are '?'.
		if (this.draftState.jumpMode) {
			super.handleInput(data);
			return;
		}
		if ((decodeKittyPrintable(data) ?? data) === "?" && this.getText().length === 0) {
			this.showingHelp = !this.showingHelp;
			this.helpOffset = 0;
			this.tui.requestRender();
			return;
		}
		if (this.showingHelp) {
			if (matchesKey(data, "down") || matchesKey(data, "up")) {
				const direction = matchesKey(data, "down") ? 1 : -1;
				this.helpOffset = Math.max(0, Math.min(HELP_ACTIONS.length + 3 - this.helpPageSize, this.helpOffset + direction));
				this.tui.requestRender();
				return;
			}
			this.showingHelp = false;
			this.tui.requestRender();
			if (matchesKey(data, "escape")) return;
		}
		if (matchesKey(data, "ctrl+s")) {
			// Respect explicitly remapped host actions and registered extensions.
			const hostAction = [...this.actionHandlers.keys()].some((action) =>
				this.helpKeybindings.matches(data, action),
			);
			const editorAction = Object.entries(this.helpKeybindings.getResolvedBindings()).some(([action, keys]) =>
				(action.startsWith("tui.editor.") || action.startsWith("tui.input.")) &&
				(Array.isArray(keys) ? keys : [keys]).some((key) => key && matchesKey(data, key)),
			);
			if (hostAction || editorAction) {
				super.handleInput(data);
				return;
			}
			if (this.onExtensionShortcut?.(data)) return;
			this.toggleStash();
			return;
		}
		super.handleInput(data);
	}

	private toggleStash(): void {
		if (this.getText().length > 0) {
			this.drafts.push(structuredClone({
				state: this.draftState.state,
				pastes: this.draftState.pastes,
				pasteCounter: this.draftState.pasteCounter,
			}));
			this.setText("");
			// Undo in the scratch prompt must not resurrect the stashed draft.
			this.draftState.undoStack.clear();
		} else {
			const draft = this.drafts.pop();
			if (!draft) return;
			// setText cancels autocomplete and exits history browsing. Delay the
			// change callback until text, paste registry and cursor are restored.
			const onChange = this.onChange;
			this.onChange = undefined;
			try {
				this.setText(draft.state.lines.join("\n"));
				Object.assign(this.draftState.state, draft.state);
				this.draftState.pastes = draft.pastes;
				this.draftState.pasteCounter = draft.pasteCounter;
				this.draftState.preferredVisualCol = null;
				this.draftState.snappedFromCursorCol = null;
				this.draftState.undoStack.clear();
			} finally {
				this.onChange = onChange;
			}
			onChange?.(this.getText());
		}
		this.tui.requestRender();
	}

	getInputHint(): string {
		if (this.drafts.length === 0) return "";
		const action = this.getText().length > 0 ? "stash" : "restore";
		return ` Stash ${this.drafts.length} · Ctrl+S ${action} `;
	}

	render(width: number): string[] {
		const lines = super.render(width);
		if (this.getText().length > 0) this.showingHelp = false;
		if (!this.showingHelp) return lines;
		const help = [
			"Ctrl+S  Stash draft / restore latest on empty input",
			"?  Toggle shortcut help on empty input",
			...HELP_ACTIONS.map((action) => {
				const keys = this.helpKeybindings.getKeys(action).join(" / ") || "unbound";
				return `${keys}  ${this.helpKeybindings.getDefinition(action).description}`;
			}),
			"/hotkeys  Full shortcut reference, including extensions",
		];
		// Leave room for the editor/footer, and make every help row reachable
		// even in short terminals instead of appending an unbounded panel.
		const available = Math.max(0, Math.min(Math.floor(this.tui.terminal.rows / 2), this.tui.terminal.rows - lines.length - 1));
		this.helpPageSize = Math.max(1, available - 2);
		this.helpOffset = Math.min(this.helpOffset, Math.max(0, help.length - this.helpPageSize));
		const panel = [
			"Keyboard shortcuts",
			...help.slice(this.helpOffset, this.helpOffset + this.helpPageSize),
			"↑/↓ scroll · ? / Esc close · typing resumes input",
		].slice(0, available);
		return [...lines, ...panel.map((line) => truncateToWidth(line, Math.max(0, width), "…"))];
	}
}
