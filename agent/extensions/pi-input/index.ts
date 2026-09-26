import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
	type ReadonlyFooterDataProvider,
	getAgentDir,
} from "@earendil-works/pi-coding-agent";
import {
	type Component,
	type EditorTheme,
	truncateToWidth,
	type TUI,
	visibleWidth,
} from "@earendil-works/pi-tui";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { COLORS, ICONS, VERBS, fgRgb } from "./constants.js";

export type LineConfig = {
	left?: string[];
	center?: string[];
	right?: string[];
};

export type InputConfig = {
	/** Custom spinner animation frames or single glyph */
	spinner?: string | string[];
	/** Spinner animation speed in milliseconds per frame (default: 80) */
	spinnerSpeed?: number;
	glyph?: string | string[];
	glyphs?:
		| {
				spinner?: string | string[];
				inProgress?: string;
				[key: string]: unknown;
		  }
		| string
		| string[];
	/** Field separator for footer */
	separator?: string;
	/** Top border field separator */
	borderSeparator?: string;
	/** Section 1: Top left widgets (verb + glyph is automatically included) */
	topLeft?: string[];
	/** Section 2: Top right widgets (hardcoded stats automatically included) */
	topRight?: string[];
	/** Section 3: Bottom left widgets (directory & branch hardcoded automatically) */
	bottomLeft?: string[];
	/** Section 4: Bottom right widgets */
	bottomRight?: string[];
	/** Backwards-compatibility: top editor border */
	border?: LineConfig;
	/** Backwards-compatibility: footer lines below editor */
	lines?: LineConfig[];
};

export const DEFAULT_SPINNER = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏",
];

export const DEFAULT_CONFIG: InputConfig = {
	spinner: DEFAULT_SPINNER,
	spinnerSpeed: 80,
	separator: " - ",
	borderSeparator: " - ",
	topLeft: [],
	topRight: [],
	bottomLeft: [],
	bottomRight: ["sessionName", "extensionStatuses"],
};

function extractGlyphs(raw: Partial<InputConfig>): string | string[] {
	if (typeof raw.spinner === "string" || Array.isArray(raw.spinner)) {
		return raw.spinner;
	}
	if (typeof raw.glyph === "string" || Array.isArray(raw.glyph)) {
		return raw.glyph;
	}
	if (raw.glyphs && typeof raw.glyphs === "object") {
		const g = raw.glyphs as Record<string, unknown>;
		if (typeof g.spinner === "string" || Array.isArray(g.spinner)) {
			return g.spinner as string | string[];
		}
		if (typeof g.inProgress === "string") {
			return g.inProgress;
		}
	}
	return DEFAULT_SPINNER;
}

function loadConfig(): InputConfig {
	const path = join(getAgentDir(), "pi-input.json");
	const legacy = join(getAgentDir(), "extensions", "pi-input.json");
	if (!existsSync(path) && existsSync(legacy)) {
		try {
			renameSync(legacy, path);
		} catch {
			/* keep reading legacy via defaults if move fails */
		}
	}
	if (!existsSync(path)) {
		try {
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, {
				flag: "wx",
			});
		} catch {
			/* use defaults */
		}
		return DEFAULT_CONFIG;
	}
	try {
		const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<InputConfig>;
		const glyph = extractGlyphs(raw);
		const rawSpeed =
			typeof raw.spinnerSpeed === "number" && raw.spinnerSpeed > 0
				? raw.spinnerSpeed
				: typeof (raw as { speed?: number }).speed === "number" &&
					  ((raw as { speed?: number }).speed ?? 0) > 0
					? (raw as { speed: number }).speed
					: DEFAULT_CONFIG.spinnerSpeed;
		return {
			spinner: raw.spinner ?? (Array.isArray(glyph) ? glyph : [glyph]),
			spinnerSpeed: rawSpeed,
			glyph,
			glyphs: raw.glyphs,
			separator:
				typeof raw.separator === "string"
					? raw.separator
					: DEFAULT_CONFIG.separator,
			borderSeparator:
				typeof raw.borderSeparator === "string"
					? raw.borderSeparator
					: DEFAULT_CONFIG.borderSeparator,
			topLeft: Array.isArray(raw.topLeft)
				? raw.topLeft
				: (raw.border?.left ?? DEFAULT_CONFIG.topLeft),
			topRight: Array.isArray(raw.topRight)
				? raw.topRight
				: (raw.border?.right ?? DEFAULT_CONFIG.topRight),
			bottomLeft: Array.isArray(raw.bottomLeft)
				? raw.bottomLeft
				: (raw.lines?.[0]?.left ?? DEFAULT_CONFIG.bottomLeft),
			bottomRight: Array.isArray(raw.bottomRight)
				? raw.bottomRight
				: (raw.lines?.[0]?.right ?? DEFAULT_CONFIG.bottomRight),
			border: raw.border,
			lines: raw.lines,
		};
	} catch {
		/* use defaults */
	}
	return DEFAULT_CONFIG;
}

function statusKey(element: string): string | undefined {
	return element.startsWith("status:") ? element.slice(7) : undefined;
}

function sanitize(text: string): string {
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

function formatTokens(tokens: number): string {
	if (tokens >= 1_000_000) {
		const m = tokens / 1_000_000;
		return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
	}
	if (tokens >= 1_000) {
		const k = tokens / 1_000;
		return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}k`;
	}
	return String(tokens);
}

function formatCwd(cwd: string, home: string | undefined): string {
	if (!home) return cwd;
	const rel = relative(resolve(home), resolve(cwd));
	const inside =
		rel === "" ||
		(rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
	if (!inside) return cwd;
	if (rel === "") return "~";
	const segments = rel.split(sep);
	const dirs = segments
		.slice(0, -1)
		.map((s) => (s.startsWith(".") ? s.slice(0, 2) : s.slice(0, 1)));
	return ["~", ...dirs, segments.at(-1)].join(sep);
}

type Totals = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	latestCacheHitRate: number | undefined;
};

function collectStats(ctx: ExtensionContext): Totals {
	const totals: Totals = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		latestCacheHitRate: undefined,
	};
	for (const entry of ctx.sessionManager.getEntries()) {
		const usage =
			entry.type === "message" && entry.message.role === "assistant"
				? entry.message.usage
				: entry.type === "message" && entry.message.role === "toolResult"
					? entry.message.usage
					: entry.type === "branch_summary" || entry.type === "compaction"
						? entry.usage
						: undefined;
		if (!usage) continue;
		totals.input += usage.input;
		totals.output += usage.output;
		totals.cacheRead += usage.cacheRead;
		totals.cacheWrite += usage.cacheWrite;
		totals.cost += usage.cost.total;
		if (entry.type === "message" && entry.message.role === "assistant") {
			const prompt = usage.input + usage.cacheRead + usage.cacheWrite;
			totals.latestCacheHitRate =
				prompt > 0 ? (usage.cacheRead / prompt) * 100 : undefined;
		}
	}
	return totals;
}

function fitBorder(
	left: string,
	right: string,
	width: number,
	borderColor?: (str: string) => string,
): string {
	if (width <= 0) return "";
	const color = borderColor ?? ((s: string) => s);
	if (width === 1) return color("─");

	let leftText = left;
	let rightText = right;
	while (
		2 + visibleWidth(leftText) + visibleWidth(rightText) + 3 > width &&
		visibleWidth(rightText) > 0
	) {
		rightText = truncateToWidth(
			rightText,
			Math.max(0, visibleWidth(rightText) - 1),
			"",
		);
	}
	while (
		2 + visibleWidth(leftText) + visibleWidth(rightText) + 3 > width &&
		visibleWidth(leftText) > 0
	) {
		leftText = truncateToWidth(
			leftText,
			Math.max(0, visibleWidth(leftText) - 1),
			"",
		);
	}
	const gap = Math.max(
		0,
		width - 2 - visibleWidth(leftText) - visibleWidth(rightText),
	);
	return `${color("─")}${leftText}${color("─".repeat(gap))}${rightText}${color("─")}`;
}

function stripAnsi(s: string): string {
	return s.replace(/\u001b\[[0-9;]*m/g, "");
}

function pickVerb(): string {
	return `${VERBS[Math.floor(Math.random() * VERBS.length)]}…`;
}

class CompactEditor extends CustomEditor {
	private isWorking = false;
	private verb = "";
	private rotateVerbs = false;
	private spinnerIndex = 0;
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		private config: InputConfig,
		private getBorderParts: () => Record<string, string>,
	) {
		super(tui, theme, keybindings);
	}

	getIsWorking(): boolean {
		return this.isWorking;
	}

	getVerb(): string {
		return this.verb;
	}

	getSpinnerIndex(): number {
		return this.spinnerIndex;
	}

	private stopTimer() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	private getSpinnerFrames(): string[] {
		const s = this.config.spinner ?? this.config.glyph;
		if (Array.isArray(s)) return s;
		if (typeof s === "string") return [s];
		return DEFAULT_SPINNER;
	}

	startWorking(message?: string) {
		const fixed = message !== undefined;
		const next = message ?? pickVerb();
		if (this.isWorking && fixed && this.verb === next && !this.rotateVerbs) {
			return;
		}
		this.isWorking = true;
		this.verb = next;
		this.rotateVerbs = !fixed;
		this.spinnerIndex = 0;
		let verbTicks = 0;
		this.stopTimer();
		const frames = this.getSpinnerFrames();
		const speed =
			typeof this.config.spinnerSpeed === "number" &&
			this.config.spinnerSpeed > 0
				? this.config.spinnerSpeed
				: 80;
		const ticksPerVerb = Math.max(1, Math.round(4000 / speed));
		this.timer = setInterval(() => {
			this.spinnerIndex = (this.spinnerIndex + 1) % frames.length;
			verbTicks++;
			if (this.rotateVerbs && verbTicks % ticksPerVerb === 0) {
				let next = pickVerb();
				while (next === this.verb) next = pickVerb();
				this.verb = next;
			}
			this.tui.requestRender();
		}, speed);
		this.tui.requestRender();
	}

	stopWorking() {
		if (!this.isWorking) return;
		this.isWorking = false;
		this.verb = "";
		this.stopTimer();
		this.tui.requestRender();
	}

	render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length < 2) return lines;
		const borderParts = this.getBorderParts();
		const frames = this.getSpinnerFrames();
		const glyph = frames[this.spinnerIndex % frames.length] ?? "✽";

		const borderFn = (s: string) => this.borderColor(s);

		// Section 1: Top Left - status (verb + glyph when working)
		const statusText = this.isWorking
			? borderFn(`${glyph} ${this.verb}`)
			: "";
		borderParts.agent = statusText;
		borderParts.status = statusText;
		borderParts.working = statusText;
		borderParts.verb = statusText;

		if (borderParts.variant && borderParts.variant !== "off") {
			borderParts.variant = borderFn(borderParts.variant);
		} else {
			borderParts.variant = "";
		}

		const resolveBorder = (el: string) => {
			const key = statusKey(el);
			if (key !== undefined) return sanitize(borderParts[key] ?? "");
			return borderParts[el] ?? "";
		};

		// 1. Top Left: verb + glyph (when working) plus user widgets
		const customTopLeft = (this.config.topLeft ?? [])
			.filter(
				(k) =>
					k !== "status" &&
					k !== "working" &&
					k !== "verb" &&
					k !== "agent",
			)
			.map(resolveBorder)
			.filter(Boolean);
		const topLeftParts = [statusText, ...customTopLeft].filter(Boolean);
		const sep = this.config.borderSeparator ?? " - ";
		const topLeft = topLeftParts.join(sep);

		// 2. Top Right: hardcoded (cost, model, variant, context) plus user widgets
		const hardcodedParts: Record<string, string> = {
			cost: borderParts.cost,
			model: borderParts.model,
			variant: borderParts.variant,
			context: borderParts.context,
		};
		const hardcodedTopRight = ["cost", "model", "variant", "context"]
			.map((k) => hardcodedParts[k])
			.filter(Boolean);
		const customTopRight = (this.config.topRight ?? [])
			.filter((k) => !["cost", "model", "variant", "context"].includes(k))
			.map(resolveBorder)
			.filter(Boolean);
		const topRightParts = [...customTopRight, ...hardcodedTopRight].filter(
			Boolean,
		);
		const topRight = topRightParts.join(sep);

		lines[0] = fitBorder(
			topLeft ? ` ${topLeft} ` : "",
			topRight ? ` ${topRight} ` : "",
			width,
			borderFn,
		);

		// Editor layout is: top border, visible input lines, bottom border,
		// then autocomplete rows. Never overwrite the last line — that hides
		// the only remaining items when the list is short.
		// SAFETY: pi-tui marks renderedVisibleLineCount private; it is set in Editor.render().
		const visibleCount =
			(this as unknown as { renderedVisibleLineCount?: number })
				.renderedVisibleLineCount ?? 1;
		const bottomBorderIndex = 1 + visibleCount;
		const borderIndex =
			bottomBorderIndex >= 0 && bottomBorderIndex < lines.length
				? bottomBorderIndex
				: lines.length - 1;
		lines[borderIndex] = borderFn("─".repeat(Math.max(0, width)));

		return lines;
	}
}

class CompactFooter implements Component {
	constructor(
		private config: InputConfig,
		private getBuiltStatuses: () => Record<string, string>,
		private footerData: ReadonlyFooterDataProvider,
		private onStatuses?: (statuses: ReadonlyMap<string, string>) => void,
	) {}

	invalidate(): void {}
	dispose(): void {}

	render(width: number): string[] {
		const statuses = this.footerData.getExtensionStatuses();
		this.onStatuses?.(statuses);
		const built = this.getBuiltStatuses();
		const sep = this.config.separator ?? " - ";
		const resolve = (el: string): string => {
			const key = statusKey(el);
			if (key !== undefined) return sanitize(statuses.get(key) ?? "");
			if (built[el] !== undefined) return built[el];
			return sanitize(statuses.get(el) ?? "");
		};

		// 3. Bottom Left: directory and git branch hardcoded, plus custom widgets
		const locationText = built.location ?? "";
		const customBottomLeft = (this.config.bottomLeft ?? [])
			.filter(
				(k) =>
					k !== "location" &&
					k !== "pwd" &&
					k !== "cwd" &&
					k !== "branch",
			)
			.map(resolve)
			.filter(Boolean);
		const left = [locationText, ...customBottomLeft].filter(Boolean).join(sep);

		// 4. Bottom Right: custom widgets (defaults to sessionName and extensionStatuses)
		const rightWidgets =
			this.config.bottomRight ??
			this.config.lines?.[0]?.right ?? [
				"sessionName",
				"extensionStatuses",
			];
		const right = rightWidgets.map(resolve).filter(Boolean).join(sep);

		if (!left && !right) return [];
		return [this.compose(left, right, width)];
	}

	private compose(left: string, right: string, width: number): string {
		const lw = visibleWidth(left);
		const rw = visibleWidth(right);
		if (!right) return truncateToWidth(left, width, "...");
		if (!left) {
			if (rw >= width) return truncateToWidth(right, width, "");
			return " ".repeat(width - rw) + right;
		}
		if (lw + 2 + rw <= width) return left + " ".repeat(width - lw - rw) + right;
		const avail = width - lw - 2;
		if (avail > 0) {
			const truncated = truncateToWidth(right, avail, "");
			return (
				left +
				" ".repeat(Math.max(0, width - lw - visibleWidth(truncated))) +
				truncated
			);
		}
		return truncateToWidth(left, width, "...");
	}
}

export default function (pi: ExtensionAPI) {
	let editor: CompactEditor | undefined;
	let phase: "idle" | "agent" | "summary" = "idle";
	let showingReview = false;
	let latestFooterData: ReadonlyFooterDataProvider | undefined;

	const refresh = () => {
		try {
			(
				editor as { tui?: { requestRender: () => void } } | undefined
			)?.tui?.requestRender();
		} catch {
			/* ignore */
		}
	};

	const borderParts = (
		ctx: ExtensionContext,
		footerData?: ReadonlyFooterDataProvider,
	) => {
		const stats = collectStats(ctx);
		const contextUsage = ctx.getContextUsage();
		const pct = contextUsage?.percent ?? 0;
		const pctText = contextUsage?.percent == null ? "0.0%" : `${pct.toFixed(1)}%`;
		const pctColor =
			pct > 90 ? COLORS.error : pct > 70 ? COLORS.warning : COLORS.pct;
		const thinking = (pi.getThinkingLevel() || "").toLowerCase();

		const maxContext = contextUsage?.contextWindow ?? ctx.model?.contextWindow;
		const contextFormatted = maxContext
			? `${fgRgb(pctColor, pctText)}${fgRgb(COLORS.dim, "/")}${fgRgb(pctColor, formatTokens(maxContext))}`
			: fgRgb(pctColor, pctText);

		const parts: Record<string, string> = {
			agent: "",
			status: "",
			working: "",
			verb: "",
			cost: fgRgb(COLORS.cost, `$${stats.cost.toFixed(2)}`),
			model: ctx.model
				? fgRgb(COLORS.model, ctx.model.id.toLowerCase())
				: fgRgb(COLORS.dim, "no-model"),
			variant: thinking === "off" ? "" : thinking,
			context: contextFormatted,
		};

		if (footerData) {
			for (const [k, v] of footerData.getExtensionStatuses().entries()) {
				parts[k] = sanitize(v);
				parts[`status:${k}`] = sanitize(v);
			}
		}

		return parts;
	};

	const footerParts = (
		ctx: ExtensionContext,
		footerData: ReadonlyFooterDataProvider,
		positionedKeys: Set<string>,
	) => {
		const pwd = formatCwd(
			ctx.sessionManager.getCwd(),
			process.env.HOME || process.env.USERPROFILE,
		);
		const branch = footerData.getGitBranch();
		const sessionName = ctx.sessionManager.getSessionName();

		const cwdPart = fgRgb(COLORS.cwd, pwd);
		let locationText = cwdPart;
		if (branch) {
			const onPart = fgRgb(COLORS.dim, "on");
			const branchPart = fgRgb(COLORS.branch, `${ICONS.git} ${branch}`);
			locationText += ` ${onPart} ${branchPart}`;
		}

		const statuses = footerData.getExtensionStatuses();
		const extra = Array.from(statuses.entries())
			.filter(([key]) => {
				if (positionedKeys.has(key)) return false;
				if (key.startsWith("pi-lens")) return false;
				if (
					key === "summaries" ||
					key === "auto-reviewer" ||
					key === "primary-agent" ||
					key === "caffeinate"
				)
					return false;
				return true;
			})
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, text]) => sanitize(text))
			.join(" ");

		return {
			location: locationText,
			pwd: cwdPart,
			branch: branch ? fgRgb(COLORS.branch, `${ICONS.git} ${branch}`) : "",
			sessionName: sessionName ? fgRgb(COLORS.dim, sessionName) : "",
			extensionStatuses: extra,
		};
	};

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;

		// Hide open-agents banner if present
		const ui = ctx.ui as {
			setWidget: (
				key: string,
				content: string[] | undefined | ((tui: TUI, theme: unknown) => unknown),
				opts?: unknown,
			) => void;
		};
		const origSetWidget = ui.setWidget.bind(ui);
		ui.setWidget = (key, content, opts) => {
			if (key === "open-agents-banner") {
				origSetWidget(key, undefined, opts);
				queueMicrotask(refresh);
				return;
			}
			origSetWidget(key, content, opts);
		};

		const config = loadConfig();
		ctx.ui.setWorkingVisible(false);

		const positioned = new Set<string>();
		for (const section of [
			config.topLeft,
			config.topRight,
			config.bottomLeft,
			config.bottomRight,
			...(config.lines?.flatMap((l) => [
				...(l.left ?? []),
				...(l.right ?? []),
			]) ?? []),
		]) {
			for (const item of section ?? []) {
				const k = statusKey(item) ?? item;
				positioned.add(k);
			}
		}

		// pi-rewind loads after us and wraps getEditorComponent() — good.
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			editor = new CompactEditor(
				tui,
				theme,
				keybindings,
				config,
				() => borderParts(ctx, latestFooterData),
			);
			return editor;
		});

		ctx.ui.setFooter(
			(tui: TUI, _theme: unknown, footerData: ReadonlyFooterDataProvider) => {
				latestFooterData = footerData;
				const unsub = footerData.onBranchChange(() => tui.requestRender());
				const footer = new CompactFooter(
					config,
					() => footerParts(ctx, footerData, positioned),
					footerData,
					() => {
						const statuses = footerData.getExtensionStatuses();
						const summarizing = statuses.has("summaries");
						const reviewing = statuses.get("auto-reviewer");
						if (reviewing) {
							showingReview = true;
							editor?.startWorking(stripAnsi(reviewing) || "Reviewing…");
							return;
						}
						if (showingReview) {
							showingReview = false;
							if (phase === "agent") editor?.startWorking();
							else editor?.stopWorking();
						}
						if (summarizing && phase === "idle") {
							phase = "summary";
							editor?.startWorking("Summarizing…");
						} else if (!summarizing && phase === "summary") {
							phase = "idle";
							editor?.stopWorking();
						}
					},
				);
				footer.dispose = unsub;
				return footer;
			},
		);
	});

	pi.on("model_select", refresh);
	pi.on("thinking_level_select", refresh);

	pi.on("agent_start", () => {
		phase = "agent";
		editor?.startWorking();
	});

	pi.on("agent_settled", () => {
		if (phase !== "agent") return;
		phase = "idle";
		editor?.stopWorking();
	});

	pi.on("session_shutdown", (_event, ctx) => {
		phase = "idle";
		editor?.stopWorking();
		editor = undefined;
		if (!ctx.hasUI) return;
		ctx.ui.setFooter(undefined);
		ctx.ui.setEditorComponent(undefined);
	});
}
