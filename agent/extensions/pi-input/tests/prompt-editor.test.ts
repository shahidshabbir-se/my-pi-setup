import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
// The host injects this manager; the package root only exports its type.
import { KeybindingsManager } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings.js";
import { setKeybindings, visibleWidth, type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import { PromptEditor } from "../prompt-editor";

const theme: EditorTheme = {
	borderColor: (text) => text,
	selectList: {
		selectedPrefix: (text) => text,
		selectedText: (text) => text,
		description: (text) => text,
		scrollInfo: (text) => text,
		noMatch: (text) => text,
	},
};

function createEditor(bindings = new KeybindingsManager(), rows = 40) {
	setKeybindings(bindings);
	// SAFETY: Editor only needs terminal.rows and render requests for these
	// input/render tests; no real terminal or input loop is started.
	const tui = { terminal: { rows }, requestRender() {} } as unknown as TUI;
	return new PromptEditor(tui, theme, bindings);
}

function paste(editor: PromptEditor, content: string) {
	editor.handleInput(`\x1b[200~${content}\x1b[201~`);
}

const stash = (editor: PromptEditor) => editor.handleInput("\x13");
const helpVisible = (editor: PromptEditor) => editor.render(100).some((line) => line.includes("Keyboard shortcuts"));

describe("Ctrl+S prompt stash", () => {
	test("empty stash is a no-op and never submits", () => {
		const editor = createEditor();
		let submissions = 0;
		editor.onSubmit = () => submissions++;
		stash(editor);
		assert.equal(editor.getText(), "");
		assert.equal(editor.getInputHint(), "");
		assert.equal(submissions, 0);
	});

	test("restores exact multiline text and cursor after a side prompt", () => {
		const editor = createEditor();
		editor.setText("  first\nsecond 😀 line\n  ");
		editor.handleInput("\x1b[A");
		editor.handleInput("\x1b[D");
		const cursor = editor.getCursor();
		const text = editor.getText();
		stash(editor);
		assert.equal(editor.getText(), "");
		assert.ok(editor.getInputHint().includes("Stash 1"));
		editor.setText("side question");
		let submitted = "";
		editor.onSubmit = (value) => { submitted = value; };
		editor.handleInput("\r");
		assert.equal(submitted, "side question");
		stash(editor);
		assert.equal(editor.getText(), text);
		assert.deepEqual(editor.getCursor(), cursor);
		assert.equal(editor.getInputHint(), "");
	});

	test("preserves collapsed pasted content and its cursor", () => {
		const editor = createEditor();
		const content = Array.from({ length: 20 }, (_, i) => `pasted line ${i}`).join("\n");
		paste(editor, content);
		const display = editor.getText();
		const cursor = editor.getCursor();
		assert.notEqual(display, content);
		stash(editor);
		paste(editor, "different scratch paste\n".repeat(15));
		editor.setText("");
		stash(editor);
		assert.equal(editor.getText(), display);
		assert.equal(editor.getExpandedText(), content);
		assert.deepEqual(editor.getCursor(), cursor);
		paste(editor, "another long paste\n".repeat(15));
		assert.equal(editor.getExpandedText(), content + "another long paste\n".repeat(15));
		let submitted = "";
		editor.onSubmit = (value) => { submitted = value; };
		editor.handleInput("\r");
		// Submission trimming belongs to pi; stash restoration itself is exact.
		assert.equal(submitted, (content + "another long paste\n".repeat(15)).trim());
	});

	test("repeated non-empty stashes do not lose earlier drafts", () => {
		const editor = createEditor();
		editor.setText("first");
		stash(editor);
		editor.setText("second");
		stash(editor);
		assert.ok(editor.getInputHint().includes("Stash 2"));
		stash(editor);
		assert.equal(editor.getText(), "second");
		editor.setText("");
		stash(editor);
		assert.equal(editor.getText(), "first");
	});

	test("whitespace-only drafts are not discarded", () => {
		const editor = createEditor();
		editor.setText(" \n ");
		stash(editor);
		stash(editor);
		assert.equal(editor.getText(), " \n ");
	});

	test("scratch undo cannot resurrect a stashed draft", () => {
		const editor = createEditor();
		editor.setText("saved");
		stash(editor);
		editor.handleInput("\x1bz");
		assert.equal(editor.getText(), "");
	});

	test("change callbacks see fully restored paste content and cursor", () => {
		const editor = createEditor();
		paste(editor, "line\n".repeat(20));
		const expected = editor.getExpandedText();
		const cursor = editor.getCursor();
		stash(editor);
		const changes: unknown[] = [];
		editor.onChange = () => changes.push([editor.getExpandedText(), editor.getCursor()]);
		stash(editor);
		assert.deepEqual(changes, [[expected, cursor]]);
	});

	test("accepts Kitty Ctrl+S encoding", () => {
		const editor = createEditor();
		editor.setText("saved");
		editor.handleInput("\x1b[115;5u");
		assert.equal(editor.getText(), "");
		stash(editor);
		assert.equal(editor.getText(), "saved");
	});

	test("stash state does not leak into a new editor/session", () => {
		const editor = createEditor();
		editor.setText("saved");
		stash(editor);
		const next = createEditor();
		stash(next);
		assert.equal(next.getText(), "");
	});
});

describe("host input behavior", () => {
	test("other extension shortcuts and app actions still reach the host", () => {
		const editor = createEditor();
		let extensionCalls = 0;
		let followUps = 0;
		editor.onExtensionShortcut = (data) => {
			if (data !== "\x1b[24~") return false;
			extensionCalls++;
			return true;
		};
		editor.onAction("app.message.followUp", () => followUps++);
		editor.handleInput("\x1b[24~");
		editor.handleInput("\x1b\r");
		assert.equal(extensionCalls, 1);
		assert.equal(followUps, 1);
	});

	test("explicit Ctrl+S host remaps and extension shortcuts take precedence", () => {
		const editor = createEditor(new KeybindingsManager({ "app.model.select": "ctrl+s" }));
		let selected = 0;
		editor.onAction("app.model.select", () => selected++);
		editor.setText("draft");
		stash(editor);
		assert.equal(selected, 1);
		assert.equal(editor.getText(), "draft");
		const other = createEditor();
		other.setText("other draft");
		other.onExtensionShortcut = (data) => data === "\x13";
		stash(other);
		assert.equal(other.getText(), "other draft");
	});

	test("explicit Ctrl+S editor remaps take precedence", () => {
		const editor = createEditor(new KeybindingsManager({ "tui.input.newLine": "ctrl+s" }));
		editor.setText("draft");
		stash(editor);
		assert.equal(editor.getText(), "draft\n");
	});

	test("autocomplete is cancelled by stash and works after restoration", async () => {
		const editor = createEditor();
		editor.setAutocompleteProvider({
			async getSuggestions() { return { items: [{ value: "/help", label: "help" }], prefix: "/" }; },
			applyCompletion() { return { lines: ["/help"], cursorLine: 0, cursorCol: 5 }; },
		});
		editor.handleInput("/");
		await delay(20);
		assert.equal(editor.isShowingAutocomplete(), true);
		stash(editor);
		assert.equal(editor.isShowingAutocomplete(), false);
		stash(editor);
		editor.handleInput("\t");
		await delay(20);
		assert.equal(editor.isShowingAutocomplete(), true);
		editor.handleInput("\t");
		assert.equal(editor.getText(), "/help");
	});
});

describe("? shortcut help", () => {
	test("toggles on empty input without inserting or submitting", () => {
		const editor = createEditor();
		let submissions = 0;
		editor.onSubmit = () => submissions++;
		editor.handleInput("?");
		assert.equal(helpVisible(editor), true);
		assert.equal(editor.getText(), "");
		editor.handleInput("?");
		assert.equal(helpVisible(editor), false);
		assert.equal(submissions, 0);
	});

	test("Kitty-encoded question marks toggle help too", () => {
		const editor = createEditor();
		editor.handleInput("\x1b[63u");
		assert.equal(helpVisible(editor), true);
		editor.handleInput("\x1b[47:63;2u");
		assert.equal(helpVisible(editor), false);
		editor.setText("why");
		editor.handleInput("\x1b[47:63;2u");
		assert.equal(editor.getText(), "why?");
	});

	test("within a draft it is ordinary text", () => {
		const editor = createEditor();
		editor.setText("why");
		editor.handleInput("?");
		assert.equal(editor.getText(), "why?");
		assert.equal(helpVisible(editor), false);
	});

	test("bracketed paste, including chunked ?, is ordinary content", () => {
		const editor = createEditor();
		paste(editor, "?");
		assert.equal(editor.getText(), "?");
		editor.setText("");
		editor.handleInput("\x1b[200~");
		editor.handleInput("?");
		editor.handleInput("\x1b[201~");
		assert.equal(editor.getText(), "?");
		assert.equal(helpVisible(editor), false);
	});

	test("Escape dismisses help without interrupting; next Escape works normally", () => {
		const editor = createEditor();
		let interrupted = 0;
		editor.onEscape = () => interrupted++;
		editor.handleInput("?");
		editor.handleInput("\x1b");
		assert.equal(helpVisible(editor), false);
		assert.equal(interrupted, 0);
		editor.handleInput("\x1b");
		assert.equal(interrupted, 1);
	});

	test("typing dismisses help and resumes normal input", () => {
		const editor = createEditor();
		editor.handleInput("?");
		editor.handleInput("x");
		assert.equal(editor.getText(), "x");
		assert.equal(helpVisible(editor), false);
	});

	test("shows remapped bindings and fits narrow terminals", () => {
		const editor = createEditor(new KeybindingsManager({ "app.editor.external": "ctrl+e" }));
		editor.handleInput("?");
		assert.ok(editor.render(100).join("\n").includes("ctrl+e  Open external editor"));
		for (const width of [1, 10, 30, 80]) {
			for (const line of editor.render(width)) assert.ok(visibleWidth(line) <= width);
		}
	});

	test("short terminals paginate help without hiding the final actions", () => {
		const editor = createEditor(new KeybindingsManager(), 12);
		editor.handleInput("?");
		assert.ok(editor.render(80).length <= 11);
		for (let i = 0; i < 30; i++) {
			editor.handleInput("\x1b[B");
			editor.render(80);
		}
		assert.ok(editor.render(80).join("\n").includes("/hotkeys"));
		assert.equal(editor.getText(), "");
	});

	test("stashed draft survives opening help", () => {
		const editor = createEditor();
		editor.setText("saved");
		stash(editor);
		editor.handleInput("?");
		stash(editor);
		assert.equal(editor.getText(), "saved");
		assert.equal(helpVisible(editor), false);
	});
});
