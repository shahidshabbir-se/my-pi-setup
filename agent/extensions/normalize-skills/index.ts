import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Normalizes frontmatter name in a SKILL.md file if it contains invalid characters.
 * Agent Skills spec requires skill names to be lowercase a-z, 0-9, and hyphens only (/^[a-z0-9-]+$/).
 */
export function normalizeSkillFile(filePath: string): { oldName: string; newName: string } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.startsWith("---")) return null;
    const endMatch = content.indexOf("\n---", 3);
    if (endMatch === -1) return null;

    const frontmatterText = content.slice(0, endMatch + 4);
    const body = content.slice(endMatch + 4);

    const nameMatch = frontmatterText.match(/^name:\s*(.+)$/m);
    if (!nameMatch) return null;

    const rawName = nameMatch[1].trim().replace(/^['"]|['"]$/g, "");
    // If it's already spec-compliant, leave it alone
    if (/^[a-z0-9-]+$/.test(rawName)) {
      return null;
    }

    // Attempt to normalize to kebab-case
    let normalized = rawName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/--+/g, "-");

    // If still not valid, fall back to directory name
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      normalized = path
        .basename(path.dirname(filePath))
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/--+/g, "-");
    }

    if (!/^[a-z0-9-]+$/.test(normalized)) {
      return null;
    }

    const updatedFrontmatter = frontmatterText.replace(
      /^name:\s*.+$/m,
      `name: ${normalized}`
    );

    fs.writeFileSync(filePath, updatedFrontmatter + body, "utf-8");
    return { oldName: rawName, newName: normalized };
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug(`[normalize-skills] Failed to normalize ${filePath}:`, error);
    }
    return null;
  }
}

/**
 * Recursively find all SKILL.md files under a directory.
 */
function findSkillFiles(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findSkillFiles(fullPath, results);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(fullPath);
      }
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug(`[normalize-skills] Error scanning ${dir}:`, error);
    }
  }
  return results;
}

/**
 * Scan configured directories and normalize any invalid skill names.
 */
export function normalizeAllSkills(extraDirs: string[] = []): Array<{ path: string; oldName: string; newName: string }> {
  const home = os.homedir();
  const searchDirs = [
    path.join(home, ".pi/agent/git"),
    path.join(home, ".pi/agent/skills"),
    path.join(home, ".agents/skills"),
    ...extraDirs,
  ];

  const normalized: Array<{ path: string; oldName: string; newName: string }> = [];

  for (const dir of searchDirs) {
    const skillFiles = findSkillFiles(dir);
    for (const file of skillFiles) {
      const res = normalizeSkillFile(file);
      if (res) {
        normalized.push({ path: file, ...res });
      }
    }
  }

  return normalized;
}

/**
 * Hook DefaultResourceLoader to suppress [Skill conflicts] collision warnings
 * when project skills override user skills or name collisions occur.
 */
function hookResourceLoaderProto(proto: { getSkills?: (...args: unknown[]) => { skills: unknown[]; diagnostics: Array<{ type: string }> } }): void {
  const target = proto as { __collisionFilterHooked?: boolean; getSkills: (...args: unknown[]) => { skills: unknown[]; diagnostics: Array<{ type: string }> } };
  if (!target || target.__collisionFilterHooked || typeof target.getSkills !== "function") return;
  target.__collisionFilterHooked = true;

  const originalGetSkills = target.getSkills;
  target.getSkills = function (this: unknown, ...args: unknown[]) {
    const result = originalGetSkills.apply(this, args);
    if (!result || !Array.isArray(result.diagnostics)) {
      return result;
    }
    // Filter out collision diagnostics to hide [Skill conflicts]
    return {
      ...result,
      diagnostics: result.diagnostics.filter((d) => d.type !== "collision"),
    };
  };
}

async function installCollisionFilter(): Promise<void> {
  const candidatePaths = [
    path.join(os.homedir(), ".npm-global/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/index.js"),
    path.join(os.homedir(), ".npm-global/lib/node_modules/@earendil-works/pi-coding-agent/dist/index.js"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const mod = await import(candidate);
        if (mod.DefaultResourceLoader?.prototype) {
          hookResourceLoaderProto(mod.DefaultResourceLoader.prototype);
        }
      } catch (error) {
        if (process.env.DEBUG) {
          console.debug(`[normalize-skills] Failed to hook ${candidate}:`, error);
        }
      }
    }
  }
}

// 1. Run normalization on module load (before Pi loads skills from disk)
try {
  normalizeAllSkills();
} catch (error) {
  if (process.env.DEBUG) {
    console.debug("[normalize-skills] Initial scan failed:", error);
  }
}

// 2. Install collision filter to hide [Skill conflicts]
void installCollisionFilter();

export default function (pi: ExtensionAPI) {
  // Re-run on session start / reload to ensure collision filter and skill names stay clean
  pi.on("session_start", async (_event, ctx) => {
    try {
      await installCollisionFilter();
      const normalized = normalizeAllSkills([
        path.join(ctx.cwd, ".pi/skills"),
        path.join(ctx.cwd, ".agents/skills"),
      ]);
      if (normalized.length > 0 && ctx.hasUI) {
        for (const item of normalized) {
          ctx.ui.notify(
            `Normalized skill "${item.oldName}" -> "${item.newName}" in ${path.basename(path.dirname(item.path))}`,
            "info"
          );
        }
      }
    } catch (error) {
      if (process.env.DEBUG) {
        console.debug("[normalize-skills] Session start scan failed:", error);
      }
    }
  });

  // Register command so user can manually run at any time
  pi.registerCommand("normalize-skills", {
    description: "Scan and normalize invalid skill names and hide collision diagnostics",
    handler: async (_args, ctx) => {
      await installCollisionFilter();
      const normalized = normalizeAllSkills([
        path.join(ctx.cwd, ".pi/skills"),
        path.join(ctx.cwd, ".agents/skills"),
      ]);
      if (normalized.length === 0) {
        ctx.ui.notify("All skill names are valid. Skill collision filter is active.", "info");
      } else {
        const msg = normalized
          .map((n) => `• ${n.oldName} → ${n.newName} (${path.relative(os.homedir(), n.path)})`)
          .join("\n");
        ctx.ui.notify(`Normalized ${normalized.length} skill(s):\n${msg}`, "info");
      }
    },
  });
}
