import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { KeybindingsManager } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings.js";
import { setKeybindings, type TUI, type EditorTheme } from "@earendil-works/pi-tui";
import extension from "../index";
import type { PromptEditor } from "../prompt-editor";

type Entry = {
	type: "message";
	message: { role: "user" | "assistant"; content: string | { type: "text"; text: string }[] };
};
const user = (text: string): Entry => ({ type: "message", message: { role: "user", content: [{ type: "text", text }] } });
const theme: EditorTheme = {
	borderColor: (text) => text,
	selectList: { selectedPrefix: (text) => text, selectedText: (text) => text, description: (text) => text, scrollInfo: (text) => text, noMatch: (text) => text },
};

function withHost(branch: Entry[], run: (host: { start(reason: "startup" | "reload" | "resume"): PromptEditor }) => void, entries = branch) {
	const dir = mkdtempSync(`${tmpdir()}/pi-input-history-`);
	const previousDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = dir;
	const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => void>();
	let current: PromptEditor;
	const bindings = new KeybindingsManager();
	setKeybindings(bindings);
	// SAFETY: The real editor only needs these TUI members in the input tests.
	const tui = { terminal: { rows: 40 }, requestRender() {} } as unknown as TUI;
	// SAFETY: The fixture exercises only extension registration and editor
	// construction. All session/UI members used by that path are supplied.
	const api = {
		on(name: string, handler: (event: unknown, ctx: ExtensionContext) => void) { handlers.set(name, handler); },
		getThinkingLevel: () => "off",
	} as unknown as ExtensionAPI;
	const ctx = {
		hasUI: true,
		ui: {
			setWidget() {}, setWorkingVisible() {}, setFooter() {},
			setEditorComponent(factory?: (tui: TUI, theme: EditorTheme, bindings: KeybindingsManager) => PromptEditor) {
				if (!factory) return;
				const text = current?.getText() ?? "";
				current = factory(tui, theme, bindings);
				current.setText(text);
			},
		},
		sessionManager: { getBranch: () => branch, getEntries: () => entries },
		getContextUsage: () => undefined,
	} as unknown as ExtensionContext;
	try {
		extension(api);
		run({ start(reason) {
			handlers.get("session_start")!({ reason }, ctx);
			// The host renders initial messages with populateHistory on startup
			// and resume, but rebuilds chat without that flag during reload.
			if (reason !== "reload") {
				for (const entry of branch) {
					if (entry.message.role !== "user") continue;
					const content = entry.message.content;
					current.addToHistory(typeof content === "string" ? content : content.map((part) => part.text).join("\n"));
				}
			}
			return current;
		} });
	} finally {
		handlers.get("session_shutdown")?.({}, ctx);
		if (previousDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousDir;
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("replacement editor prompt history", () => {
	test("Up after reload recalls prompts submitted before reload", () => {
		withHost([user("older prompt"), user("prompt before reload")], (host) => {
			const original = host.start("startup");
			original.addToHistory("prompt before reload");
			const reloaded = host.start("reload");
			assert.notEqual(original, reloaded);
			reloaded.handleInput("\x1b[A");
			assert.equal(reloaded.getText(), "prompt before reload");
			reloaded.handleInput("\x1b[A");
			assert.equal(reloaded.getText(), "older prompt");
		});
	});

	test("reload history excludes assistant messages and abandoned branches", () => {
		const branch = [user("active branch prompt"), { type: "message", message: { role: "assistant", content: "assistant response" } } satisfies Entry];
		withHost(branch, (host) => {
			const editor = host.start("reload");
			editor.handleInput("\x1b[A");
			assert.equal(editor.getText(), "active branch prompt");
			editor.handleInput("\x1b[A");
			assert.equal(editor.getText(), "active branch prompt");
		}, [...branch, user("abandoned branch prompt")]);
	});

	test("reload preserves the current draft and history remains available after clearing", () => {
		withHost([user("previous prompt")], (host) => {
			host.start("startup").setText("unfinished draft");
			const editor = host.start("reload");
			assert.equal(editor.getText(), "unfinished draft");
			editor.setText("");
			editor.handleInput("\x1b[A");
			assert.equal(editor.getText(), "previous prompt");
			editor.handleInput("\x1b[B");
			assert.equal(editor.getText(), "");
		});
	});
});
