import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	SessionShutdownEvent,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CONFIG_RELATIVE_PATH = [
	"extensions",
	"pi-permission-system",
	"config.json",
] as const;

type PermissionConfig = {
	yoloMode?: boolean;
	[key: string]: unknown;
};

function agentDir(): string {
	return (
		process.env.PI_CODING_AGENT_DIR?.trim() || join(homedir(), ".pi", "agent")
	);
}

function configPath(): string {
	return join(agentDir(), ...CONFIG_RELATIVE_PATH);
}

function readConfig(): PermissionConfig {
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

function writeConfig(config: PermissionConfig): void {
	const path = configPath();
	mkdirSync(dirname(path), { recursive: true });
	const tmpPath = `${path}.tmp-${process.pid}`;
	writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
	renameSync(tmpPath, path);
}

function isYoloEnabled(): boolean {
	try {
		return readConfig().yoloMode === true;
	} catch {
		return false;
	}
}

function setYolo(enabled: boolean): void {
	const config = readConfig();
	config.yoloMode = enabled;
	writeConfig(config);
}

function statusText(): string {
	return isYoloEnabled() ? "YOLO:ON" : "YOLO:off";
}

function setStatus(ctx: ExtensionContext | ExtensionCommandContext): void {
	ctx.ui.setStatus("yolo", statusText());
}

async function handleYoloCommand(
	args: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const mode = args.trim().toLowerCase();

	if (["on", "enable", "1", "true"].includes(mode)) {
		setYolo(true);
		setStatus(ctx);
		ctx.ui.notify(
			"YOLO mode enabled — ask permissions auto-approve; hard denies still apply.",
			"info",
		);
		return;
	}

	if (
		["off", "disable", "0", "false", "force-off", "force-restore"].includes(
			mode,
		)
	) {
		setYolo(false);
		setStatus(ctx);
		ctx.ui.notify(
			"YOLO mode disabled — ask permissions will prompt again.",
			"info",
		);
		return;
	}

	if (mode === "status") {
		ctx.ui.notify(
			`YOLO mode: ${isYoloEnabled() ? "ON" : "off"} | Config: ${configPath()}`,
			"info",
		);
		setStatus(ctx);
		return;
	}

	setYolo(!isYoloEnabled());
	setStatus(ctx);
	ctx.ui.notify(
		isYoloEnabled()
			? "YOLO mode enabled — ask permissions auto-approve; hard denies still apply."
			: "YOLO mode disabled — ask permissions will prompt again.",
		"info",
	);
}

export default function piYoloSession(pi: ExtensionAPI): void {
	pi.registerCommand("yolo", {
		description: "Toggle permission-system YOLO mode (on/off/status/force-off)",
		handler: handleYoloCommand,
	});

	pi.registerCommand("yolo-session", {
		description: "Alias for /yolo",
		handler: handleYoloCommand,
	});

	pi.registerShortcut("ctrl+shift+y", {
		description: "Toggle permission-system YOLO mode",
		handler: async (ctx) => {
			setYolo(!isYoloEnabled());
			setStatus(ctx);
			ctx.ui.notify(isYoloEnabled() ? "YOLO mode ON" : "YOLO mode off", "info");
		},
	});

	pi.on("session_start", (event: SessionStartEvent, ctx: ExtensionContext) => {
		// YOLO is intentionally session-scoped. Keep it across /reload, but turn it
		// off for new/resumed/forked sessions so a previous risky mode does not leak.
		if (event.reason !== "reload" && isYoloEnabled()) {
			setYolo(false);
			ctx.ui.notify("YOLO mode reset to off for new session.", "info");
		}
		setStatus(ctx);
	});

	pi.on("turn_start", (_event: unknown, ctx: ExtensionContext) => {
		setStatus(ctx);
	});

	pi.on(
		"session_shutdown",
		(event: SessionShutdownEvent, _ctx: ExtensionContext) => {
			if (event.reason !== "reload" && isYoloEnabled()) {
				setYolo(false);
			}
		},
	);
}
