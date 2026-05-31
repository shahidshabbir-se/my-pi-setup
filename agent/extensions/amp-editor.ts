import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

const MIN_BODY_LINES = 2;
const GIT_CACHE_MS = 2000;
const STATUS_LEFT_INSET = 1;
const STATUS_RIGHT_INSET = 1;
const WORKING_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const WORKING_LOADERS = [{ name: "braille", frames: WORKING_FRAMES }] as const;
const WORKING_VERB_CHANGE_CYCLES = 2;

const CLAUDE_THINKING_VERBS = [
	"Accomplishing",
	"Actioning",
	"Actualizing",
	"Architecting",
	"Baking",
	"Beaming",
	"Beboppin'",
	"Befuddling",
	"Billowing",
	"Blanching",
	"Bloviating",
	"Boogieing",
	"Boondoggling",
	"Booping",
	"Bootstrapping",
	"Brewing",
	"Burrowing",
	"Calculating",
	"Canoodling",
	"Caramelizing",
	"Cascading",
	"Catapulting",
	"Cerebrating",
	"Channeling",
	"Channelling",
	"Choreographing",
	"Churning",
	"Clauding",
	"Coalescing",
	"Cogitating",
	"Combobulating",
	"Composing",
	"Computing",
	"Concocting",
	"Considering",
	"Contemplating",
	"Cooking",
	"Crafting",
	"Creating",
	"Crunching",
	"Crystallizing",
	"Cultivating",
	"Deciphering",
	"Deliberating",
	"Determining",
	"Dilly-dallying",
	"Discombobulating",
	"Doing",
	"Doodling",
	"Drizzling",
	"Ebbing",
	"Effecting",
	"Elucidating",
	"Embellishing",
	"Enchanting",
	"Envisioning",
	"Evaporating",
	"Fermenting",
	"Fiddle-faddling",
	"Finagling",
	"Flambéing",
	"Flibbertigibbeting",
	"Flowing",
	"Flummoxing",
	"Fluttering",
	"Forging",
	"Forming",
	"Frolicking",
	"Frosting",
	"Gallivanting",
	"Galloping",
	"Garnishing",
	"Generating",
	"Germinating",
	"Gitifying",
	"Grooving",
	"Gusting",
	"Harmonizing",
	"Hashing",
	"Hatching",
	"Herding",
	"Honking",
	"Hullaballooing",
	"Hyperspacing",
	"Ideating",
	"Imagining",
	"Improvising",
	"Incubating",
	"Inferring",
	"Infusing",
	"Ionizing",
	"Jitterbugging",
	"Julienning",
	"Kneading",
	"Leavening",
	"Levitating",
	"Lollygagging",
	"Manifesting",
	"Marinating",
	"Meandering",
	"Metamorphosing",
	"Misting",
	"Moonwalking",
	"Moseying",
	"Mulling",
	"Mustering",
	"Musing",
	"Nebulizing",
	"Nesting",
	"Newspapering",
	"Noodling",
	"Nucleating",
	"Orbiting",
	"Orchestrating",
	"Osmosing",
	"Perambulating",
	"Percolating",
	"Perusing",
	"Philosophising",
	"Photosynthesizing",
	"Pollinating",
	"Pondering",
	"Pontificating",
	"Pouncing",
	"Precipitating",
	"Prestidigitating",
	"Processing",
	"Proofing",
	"Propagating",
	"Puttering",
	"Puzzling",
	"Quantumizing",
	"Razzle-dazzling",
	"Razzmatazzing",
	"Recombobulating",
	"Reticulating",
	"Roosting",
	"Ruminating",
	"Sautéing",
	"Scampering",
	"Schlepping",
	"Scurrying",
	"Seasoning",
	"Shenaniganing",
	"Shimmying",
	"Simmering",
	"Skedaddling",
	"Sketching",
	"Slithering",
	"Smooshing",
	"Sock-hopping",
	"Spelunking",
	"Spinning",
	"Sprouting",
	"Stewing",
	"Sublimating",
	"Swirling",
	"Swooping",
	"Symbioting",
	"Synthesizing",
	"Tempering",
	"Thinking",
	"Thundering",
	"Tinkering",
	"Tomfoolering",
	"Topsy-turvying",
	"Transfiguring",
	"Transmuting",
	"Twisting",
	"Undulating",
	"Unfurling",
	"Unravelling",
	"Vibing",
	"Waddling",
	"Wandering",
	"Warping",
	"Whatchamacalliting",
	"Whirlpooling",
	"Whirring",
	"Whisking",
	"Wibbling",
	"Working",
	"Wrangling",
	"Zesting",
	"Zigzagging",
] as const;

const CLAUDE_STREAMING_VERBS = CLAUDE_THINKING_VERBS;
const CLAUDE_TOOL_VERBS = CLAUDE_THINKING_VERBS;

const CONFIG_RELATIVE_PATH = [
	"extensions",
	"pi-permission-system",
	"config.json",
] as const;

type WorkingState = {
	active: boolean;
	message: string;
	frame: string;
};

type WorkingPhase = "thinking" | "streaming" | "tools";

type GitInfo = {
	branch: string | null;
	changedFiles: number;
	added: number;
	modified: number;
	removed: number;
};

type UsageCost = {
	total: number;
	hasCost: boolean;
	usingSubscription: boolean;
};

type PermissionConfig = {
	yoloMode?: boolean;
	[key: string]: unknown;
};

type WidgetContent = string[] | ((...args: any[]) => any) | undefined;

type UiWithSetWidget = ExtensionContext["ui"] & {
	setWidget: (key: string, content: WidgetContent, options?: unknown) => void;
	__ampEditorAgentWidgetBridgeInstalled?: boolean;
};

let gitCache: { cwd: string; at: number; info: GitInfo } | undefined;

function agentDir(): string {
	return (
		process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent")
	);
}

function configPath(): string {
	return join(agentDir(), ...CONFIG_RELATIVE_PATH);
}

function readYoloConfig(): PermissionConfig {
	const path = configPath();
	if (!existsSync(path)) {
		return {
			$schema:
				"https://raw.githubusercontent.com/gotgenes/pi-permission-system/main/schemas/permissions.schema.json",
			debugLog: false,
			permissionReviewLog: true,
			yoloMode: false,
			permission: { "*": "ask" },
		};
	}

	return JSON.parse(readFileSync(path, "utf8")) as PermissionConfig;
}

function writeYoloConfig(config: PermissionConfig): void {
	const path = configPath();
	mkdirSync(dirname(path), { recursive: true });
	const tmpPath = `${path}.tmp-${process.pid}`;
	writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
	renameSync(tmpPath, path);
}

function isYoloEnabled(): boolean {
	try {
		return readYoloConfig().yoloMode === true;
	} catch {
		return false;
	}
}

function setYolo(enabled: boolean): void {
	const config = readYoloConfig();
	config.yoloMode = enabled;
	writeYoloConfig(config);
}

function getWorkingFrames(loaderIndex: number): readonly string[] {
	return (
		WORKING_LOADERS[loaderIndex % WORKING_LOADERS.length]?.frames ??
		WORKING_LOADERS[0].frames
	);
}

function getWorkingMessage(phase: WorkingPhase, verbIndex: number): string {
	if (phase === "streaming") {
		const verb =
			CLAUDE_STREAMING_VERBS[verbIndex % CLAUDE_STREAMING_VERBS.length];
		return `${verb}`;
	}
	if (phase === "tools") {
		const verb = CLAUDE_TOOL_VERBS[verbIndex % CLAUDE_TOOL_VERBS.length];
		return `${verb} tools`;
	}
	const verb = CLAUDE_THINKING_VERBS[verbIndex % CLAUDE_THINKING_VERBS.length];
	return `${verb}`;
}

function stripAnsi(value: string): string {
	return value
		.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
		.replace(/\x1B\][^\x07]*(\x07|\x1B\\)/g, "");
}

function runGit(cwd: string, args: string[]): string {
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 500,
		}).trim();
	} catch {
		return "";
	}
}

function getGitInfo(cwd: string): GitInfo {
	const now = Date.now();
	if (gitCache && gitCache.cwd === cwd && now - gitCache.at < GIT_CACHE_MS)
		return gitCache.info;

	const branch = runGit(cwd, ["branch", "--show-current"]) || null;
	// const porcelain = runGit(cwd, ["status", "--short"]);
	// const changedFiles = porcelain
	//   ? porcelain.split("\n").filter(Boolean).length
	//   : 0;
	// const numstat = runGit(cwd, ["diff", "--numstat"]);
	const added = 0;
	const removed = 0;

	// for (const line of numstat.split("\n")) {
	//   const [a, r] = line.split("\t");
	//   const add = Number(a);
	//   const rem = Number(r);
	//   if (Number.isFinite(add)) added += add;
	//   if (Number.isFinite(rem)) removed += rem;
	// }

	const changedFiles = 0;
	const modified = 0;
	const info = {
		branch,
		changedFiles,
		added: 0,
		modified,
		removed: 0,
	};
	gitCache = { cwd, at: now, info };
	return info;
}

function formatCount(value: number | null | undefined): string {
	if (value == null) return "?";
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
	return String(value);
}

function formatCost(value: number): string {
	if (value === 0) return "$0.000";
	if (value >= 1) return `$${value.toFixed(2)}`;
	if (value >= 0.01) return `$${value.toFixed(3)}`;
	return `$${value.toFixed(4)}`;
}

function compactModelId(modelId: string, maxWidth: number): string {
	if (visibleWidth(modelId) <= maxWidth) return modelId;

	const simplified = modelId
		.replace(/^claude-/, "")
		.replace(/^gpt-/, "")
		.replace(/-20\d{6}$/, "")
		.replace(/-\d{4}-\d{2}-\d{2}$/, "");

	if (visibleWidth(simplified) <= maxWidth) return simplified;
	return truncateToWidth(simplified, maxWidth, "…");
}

function compactPath(cwd: string): string {
	const home = homedir();
	if (cwd === home) return "~";
	if (cwd.startsWith(`${home}/`)) return `~/${relative(home, cwd)}`;
	return cwd;
}

function getAgentColor(agentName: string): ThemeColor {
	const namedColors: Record<string, ThemeColor> = {
		auto: "accent",
		build: "success",
		plan: "thinkingHigh",
		fixer: "toolDiffAdded",
		"code-reviewer": "warning",
		"security-reviewer": "error",
		"e2e-runner": "thinkingMedium",
		"doc-updater": "muted",
		"web-search-researcher": "thinkingLow",
	};

	if (namedColors[agentName]) return namedColors[agentName];

	const palette: ThemeColor[] = [
		"accent",
		"success",
		"warning",
		"thinkingLow",
		"thinkingMedium",
		"thinkingHigh",
		"toolDiffAdded",
	];
	let hash = 0;
	for (const char of agentName) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return palette[hash % palette.length] ?? "warning";
}

function isEditorRule(line: string): boolean {
	const plain = stripAnsi(line).trim();
	return (
		plain.includes("─") &&
		[...plain].every((char) => "─↑↓ 0123456789more".includes(char))
	);
}

function splitEditorRender(lines: string[]): {
	editorLines: string[];
	popupLines: string[];
} {
	const withoutTop = lines.slice(1);
	const bottomRuleIndex = withoutTop.findIndex(isEditorRule);

	if (bottomRuleIndex === -1) {
		return { editorLines: withoutTop, popupLines: [] };
	}

	return {
		editorLines: withoutTop.slice(0, bottomRuleIndex),
		popupLines: withoutTop.slice(bottomRuleIndex + 1),
	};
}

function getSessionCost(ctx: ExtensionContext): UsageCost {
	let total = 0;
	let hasCost = false;

	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type !== "message" || entry.message.role !== "assistant")
			continue;

		const cost = entry.message.usage?.cost?.total;
		if (typeof cost !== "number" || !Number.isFinite(cost)) continue;

		total += cost;
		if (cost > 0) hasCost = true;
	}

	const usingSubscription = ctx.model
		? Boolean(
				(
					ctx.modelRegistry as {
						isUsingOAuth?: (
							model: NonNullable<ExtensionContext["model"]>,
						) => boolean;
					}
				).isUsingOAuth?.(ctx.model),
			)
		: false;

	return { total, hasCost, usingSubscription };
}

function getActiveAgentName(ctx: ExtensionContext): string | undefined {
	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry = entries[i] as {
			type?: string;
			customType?: string;
			data?: { name?: string };
		};
		if (entry.type === "custom" && entry.customType === "agent-state") {
			return entry.data?.name || undefined;
		}
	}
	return undefined;
}

function parseAgentWidgetName(content: WidgetContent): string | undefined {
	if (!Array.isArray(content) || content.length === 0) return undefined;
	const plain = stripAnsi(content.join(" ")).trim();
	if (!plain || plain.startsWith("[No agent selected")) return "";
	const match = plain.match(/^▸\s+(.+?)(?:\s+—|\s+\[|\s+\{|$)/);
	return match?.[1]?.trim();
}

function hideAgentModeTopWidget(ctx: ExtensionContext, pi: ExtensionAPI): void {
	const ui = ctx.ui as UiWithSetWidget;
	if (ui.__ampEditorAgentWidgetBridgeInstalled) return;
	ui.__ampEditorAgentWidgetBridgeInstalled = true;

	const originalSetWidget = ui.setWidget.bind(ui);
	ui.setWidget = (key, content, options) => {
		if (key === "agent-mode-banner") {
			const agentName = parseAgentWidgetName(content);
			if (agentName !== undefined) {
				pi.appendEntry("agent-state", { name: agentName });
			}
			originalSetWidget(key, undefined, options);
			return;
		}

		originalSetWidget(key, content, options);
	};

	originalSetWidget("agent-mode-banner", undefined);
}

function hideBuiltInWorking(ctx: ExtensionContext): void {
	(
		ctx.ui as typeof ctx.ui & { setWorkingVisible?: (visible: boolean) => void }
	).setWorkingVisible?.(false);
}

class AmpEditor extends CustomEditor {
	constructor(
		tui: any,
		theme: any,
		keybindings: any,
		private readonly getCtx: () => ExtensionContext,
		private readonly getThinkingLevel: () => string,
		private readonly getWorkingState: () => WorkingState,
		private readonly getYoloEnabled: () => boolean,
	) {
		super(tui, theme, keybindings, { paddingX: 1 });
	}

	private get ctx(): ExtensionContext {
		return this.getCtx();
	}

	render(width: number): string[] {
		if (width < 12) return super.render(width);

		const innerWidth = Math.max(1, width - 2);
		const base = super.render(innerWidth);
		const { editorLines, popupLines } = splitEditorRender(base);
		const body = [...editorLines];

		while (body.length < MIN_BODY_LINES) {
			body.push(" ".repeat(innerWidth));
		}

		const leftTop = this.getUsageLabel();
		const rightTop = this.getModelLabel(
			Math.max(8, Math.floor(innerWidth * 0.48)),
		);
		const cwdLabel = this.getCwdLabel();
		const workingLabel = this.getWorkingLabel();
		const gitChangesLabel = this.getGitChangesLabel();

		return [
			this.borderWithLabels(width, leftTop, rightTop),
			...body.map((line) => this.wrapBody(line, innerWidth)),
			this.borderWithRightLabel(width, cwdLabel),
			...this.statusRows(width, workingLabel, gitChangesLabel),
			...this.wrapPopupBlock(popupLines, width),
		];
	}

	private getUsageLabel(): string {
		const usage = this.ctx.getContextUsage();
		const pct =
			usage?.percent == null
				? "?"
				: `${Math.max(0, Math.floor(usage.percent))}%`;
		const contextWindow =
			usage?.contextWindow ?? this.ctx.model?.contextWindow ?? null;
		const parts = [` ${pct} of ${formatCount(contextWindow)}`];

		const cost = getSessionCost(this.ctx);
		if (cost.hasCost || cost.usingSubscription) {
			parts.push(
				`${formatCost(cost.total)}${cost.usingSubscription ? " (sub)" : ""}`,
			);
		}

		return `${parts.join(" · ")} `;
	}

	private getModelLabel(maxWidth: number): string {
		const modelId = this.ctx.model?.id ?? "model unknown";
		const activeAgentName = getActiveAgentName(this.ctx);
		const thinkingLevel = this.getThinkingLevel();
		const yoloEnabled = this.getYoloEnabled();
		const yoloText = yoloEnabled ? "YOLO ON" : "YOLO off";
		const thinkingWidth = visibleWidth(thinkingLevel);
		const yoloWidth = visibleWidth(yoloText);
		const separatorWidth = activeAgentName ? 9 : 6;
		const modelWidth = Math.max(
			1,
			Math.floor(
				(maxWidth - thinkingWidth - yoloWidth - separatorWidth) * 0.45,
			),
		);
		const agentWidth = Math.max(
			1,
			maxWidth - thinkingWidth - yoloWidth - separatorWidth - modelWidth,
		);
		const model = this.fg("text", compactModelId(modelId, modelWidth));
		const agent = activeAgentName
			? this.fg(
					getAgentColor(activeAgentName),
					truncateToWidth(activeAgentName, agentWidth, "…"),
				)
			: undefined;
		const thinking = this.fg(this.getThinkingColor(), thinkingLevel);
		const yolo = this.fg(yoloEnabled ? "warning" : "muted", yoloText);
		return activeAgentName
			? ` ${model} ${this.fg("dim", "·")} ${agent} ${this.fg("dim", "·")} ${thinking} ${this.fg("dim", "·")} ${yolo} `
			: ` ${model} ${this.fg("dim", "·")} ${thinking} ${this.fg("dim", "·")} ${yolo} `;
	}

	private getThinkingColor(): ThemeColor {
		switch (this.getThinkingLevel()) {
			case "minimal":
				return "thinkingMinimal";
			case "low":
				return "thinkingLow";
			case "medium":
				return "thinkingMedium";
			case "high":
				return "thinkingHigh";
			case "xhigh":
				return "thinkingXhigh";
			case "off":
			default:
				return "thinkingOff";
		}
	}

	private getCwdLabel(): string {
		const git = getGitInfo(this.ctx.cwd);
		return ` ${compactPath(this.ctx.cwd)}${git.branch ? ` (${git.branch})` : ""} `;
	}

	private getWorkingLabel(): string {
		const working = this.getWorkingState();
		if (!working.active) return "";

		const cancelHint = `${this.fg("accent", "Esc")}${this.fg("muted", " to cancel")}`;
		return `${this.fg("accent", working.frame)} ${this.fg("text", working.message)}  ${cancelHint}`;
	}

	private getGitChangesLabel(): string {
		const git = getGitInfo(this.ctx.cwd);
		if (git.changedFiles === 0) return "";

		const fileLabel = this.fg(
			"muted",
			`${git.changedFiles} ${git.changedFiles === 1 ? "file" : "files"} changed`,
		);
		const added =
			git.added > 0 ? ` ${this.fg("toolDiffAdded", `+${git.added}`)}` : "";
		const modified =
			git.modified > 0 ? ` ${this.fg("warning", `~${git.modified}`)}` : "";
		const removed =
			git.removed > 0
				? ` ${this.fg("toolDiffRemoved", `-${git.removed}`)}`
				: "";
		return `${fileLabel}${added}${modified}${removed}`;
	}

	private fg(color: ThemeColor, text: string): string {
		return this.ctx.ui.theme.fg(color, text);
	}

	private wrapBody(line: string, innerWidth: number): string {
		const clipped = truncateToWidth(line, innerWidth, "");
		const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(clipped)));
		const content = clipped ? this.fg("text", clipped) : clipped;
		return this.sideBorder() + content + padding + this.sideBorder();
	}

	private wrapPopupBlock(lines: string[], width: number): string[] {
		if (lines.length === 0) return [];

		return lines.map((line) => {
			const clipped = truncateToWidth(line, width, "");
			const padding = " ".repeat(Math.max(0, width - visibleWidth(clipped)));
			return clipped + padding;
		});
	}

	private statusRows(
		width: number,
		leftLabel: string,
		rightLabel: string,
	): string[] {
		if (!leftLabel && !rightLabel) return [];

		const contentWidth = Math.max(
			1,
			width - STATUS_LEFT_INSET - STATUS_RIGHT_INSET,
		);
		const maxLeft = Math.max(0, Math.floor(contentWidth * 0.44));
		const maxRight = Math.max(0, contentWidth - maxLeft - 2);
		const left = truncateToWidth(leftLabel, maxLeft, "…");
		const right = truncateToWidth(rightLabel, maxRight, "…");
		const gap = " ".repeat(
			Math.max(1, contentWidth - visibleWidth(left) - visibleWidth(right)),
		);
		const leftPadding = " ".repeat(
			Math.min(STATUS_LEFT_INSET, Math.max(0, width - contentWidth)),
		);
		const rightPadding = " ".repeat(
			Math.min(
				STATUS_RIGHT_INSET,
				Math.max(0, width - contentWidth - visibleWidth(leftPadding)),
			),
		);
		return [`${leftPadding}${left}${gap}${right}${rightPadding}`];
	}

	private borderWithLabels(
		width: number,
		leftLabel: string,
		rightLabel: string,
	): string {
		const innerWidth = Math.max(0, width - 2);
		const maxLeft = Math.max(0, Math.floor(innerWidth * 0.44));
		const maxRight = Math.max(0, innerWidth - maxLeft - 2);
		const left = this.fg("muted", truncateToWidth(leftLabel, maxLeft, "…"));
		const right = truncateToWidth(rightLabel, maxRight, "…");
		const used = visibleWidth(left) + visibleWidth(right);
		const fill = Math.max(0, innerWidth - used);
		return (
			this.borderColor("╭") +
			left +
			this.borderColor("─".repeat(fill)) +
			right +
			this.borderColor("╮")
		);
	}

	private sideBorder(): string {
		return this.borderColor("│");
	}

	private borderWithRightLabel(width: number, label: string): string {
		const innerWidth = Math.max(0, width - 2);
		const right = this.fg(
			"muted",
			truncateToWidth(label, Math.max(0, innerWidth - 2), "…"),
		);
		const fill = Math.max(0, innerWidth - visibleWidth(right));
		return (
			this.borderColor("╰") +
			this.borderColor("─".repeat(fill)) +
			right +
			this.borderColor("╯")
		);
	}
}

export default function (pi: ExtensionAPI) {
	const activeToolExecutions = new Set<string>();
	let activeThinkingLevel = "off";
	let activeCtx: ExtensionContext | undefined;
	let activeTui: { requestRender(): void } | undefined;
	let isWorking = false;
	let workingPhase: WorkingPhase = "thinking";
	let workingFrameIndex = 0;
	let workingFrameCycleIndex = 0;
	let workingVerbIndex = 0;
	let workingLoaderIndex = 0;
	let workingTimer: ReturnType<typeof setInterval> | undefined;

	const requestRender = () => activeTui?.requestRender();

	const toggleYolo = (ctx: ExtensionContext): void => {
		setYolo(!isYoloEnabled());
		ctx.ui.setStatus("yolo", isYoloEnabled() ? "YOLO:ON" : "YOLO:off");
		ctx.ui.notify(isYoloEnabled() ? "YOLO mode ON" : "YOLO mode off", "info");
		requestRender();
	};

	pi.registerShortcut("ctrl+alt+y", {
		description: "Toggle permission-system YOLO mode",
		handler: async (ctx) => {
			toggleYolo(ctx);
		},
	});

	const stopWorkingTimer = () => {
		if (!workingTimer) return;
		clearInterval(workingTimer);
		workingTimer = undefined;
	};

	const startWorkingTimer = () => {
		stopWorkingTimer();
		workingTimer = setInterval(() => {
			const frames = getWorkingFrames(workingLoaderIndex);
			workingFrameIndex = (workingFrameIndex + 1) % frames.length;
			if (workingFrameIndex === 0) {
				workingFrameCycleIndex += 1;
				if (workingFrameCycleIndex % WORKING_VERB_CHANGE_CYCLES === 0) {
					workingVerbIndex += 1;
					activeCtx?.ui.setWorkingMessage(
						getWorkingMessage(workingPhase, workingVerbIndex),
					);
				}
			}
			requestRender();
		}, 160);
	};

	const setWorkingPhase = (phase: WorkingPhase, ctx?: ExtensionContext) => {
		workingPhase = phase;
		ctx?.ui.setWorkingMessage(getWorkingMessage(phase, workingVerbIndex));
		requestRender();
	};

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;

		hideAgentModeTopWidget(ctx, pi);

		activeCtx = ctx;
		activeThinkingLevel = pi.getThinkingLevel();

		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			activeTui = tui;
			return new AmpEditor(
				tui,
				theme,
				keybindings,
				() => activeCtx ?? ctx,
				() => activeThinkingLevel,
				() => {
					const frames = getWorkingFrames(workingLoaderIndex);
					return {
						active: isWorking,
						message: getWorkingMessage(workingPhase, workingVerbIndex),
						frame: frames[workingFrameIndex] ?? frames[0] ?? "·",
					};
				},
				isYoloEnabled,
			);
		});

		hideBuiltInWorking(ctx);

		ctx.ui.setFooter(() => ({
			invalidate() {},
			render() {
				return [];
			},
		}));
	});

	pi.on("thinking_level_select", (event, ctx) => {
		activeThinkingLevel = event.level;
		if (ctx.hasUI) requestRender();
	});

	pi.on("before_agent_start", (_event, ctx) => {
		activeThinkingLevel = pi.getThinkingLevel();
		activeToolExecutions.clear();
		isWorking = true;
		workingPhase = "thinking";
		workingFrameIndex = 0;
		workingFrameCycleIndex = 0;
		workingVerbIndex = Math.floor(Math.random() * CLAUDE_THINKING_VERBS.length);
		workingLoaderIndex = (workingLoaderIndex + 1) % WORKING_LOADERS.length;
		startWorkingTimer();
		if (!ctx.hasUI) return;
		hideBuiltInWorking(ctx);
		setWorkingPhase("thinking", ctx);
	});

	pi.on("agent_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		hideBuiltInWorking(ctx);
	});

	pi.on("message_update", (event, ctx) => {
		if (!ctx.hasUI || event.message.role !== "assistant") return;
		if (activeToolExecutions.size > 0) return;
		setWorkingPhase("streaming", ctx);
	});

	pi.on("tool_execution_start", (event, ctx) => {
		activeToolExecutions.add(event.toolCallId);
		if (!ctx.hasUI) return;
		setWorkingPhase("tools", ctx);
	});

	pi.on("tool_execution_update", (_event, ctx) => {
		if (!ctx.hasUI) return;
		setWorkingPhase("tools", ctx);
	});

	pi.on("tool_execution_end", (event, ctx) => {
		activeToolExecutions.delete(event.toolCallId);
		if (!ctx.hasUI) return;
		if (activeToolExecutions.size === 0) {
			setWorkingPhase("thinking", ctx);
		}
	});

	pi.on("agent_end", (_event, _ctx) => {
		isWorking = false;
		activeToolExecutions.clear();
		stopWorkingTimer();
		requestRender();
	});

	pi.on("session_shutdown", () => {
		stopWorkingTimer();
		activeTui = undefined;
	});
}
