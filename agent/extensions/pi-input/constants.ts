import type { Theme } from "@earendil-works/pi-coding-agent";

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

export type RGB = readonly [number, number, number];

export const COLORS = {
  agent: [150, 175, 230] as const,
  cwd: [130, 190, 220] as const,
  branch: [140, 200, 140] as const,
  cost: [220, 190, 110] as const,
  model: [255, 158, 100] as const, // warm orange (#ff9e64)
  pct: [116, 219, 203] as const, // turquoise / cyan (#74dbc7) from screenshot
  contextMax: [116, 219, 203] as const,
  dim: [110, 120, 140] as const,
  error: [247, 118, 142] as const, // tokyo night red (#f7768e)
  warning: [224, 175, 104] as const, // tokyo night orange/yellow (#e0af68)
} as const;

export function fgRgb(rgb: RGB, text: string, bold = false): string {
  return `${bold ? BOLD : ""}\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}${RESET}`;
}

export function hexRgb(spec: string): [number, number, number] | undefined {
  const m = spec.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const ICONS = {
  git: "",
  separator: " - ",
  spinnerFrames: ["✽", "✼", "✻", "✺", "✻", "✼", "✽", "✼", "✻"],
} as const;

export function formatThinking(level?: string, theme?: Theme): string {
  if (!level || level === "off") return "";
  const lower = level.toLowerCase();
  if (theme) {
    if (lower === "xhigh" || lower === "high" || lower === "max") {
      // Uses the exact theme accent / bar color (no hardcoded color)
      return theme.fg("accent", lower);
    }
    if (lower === "medium") {
      return theme.fg("warning", lower);
    }
    return theme.fg("success", lower);
  }
  return lower;
}

export const SHIMMER_BAND_WIDTH = 1; // ±1 from center = 3 chars wide

export function shimmer(text: string, frame: number, base: RGB): string {
  const chars = [...text];
  const len = chars.length;
  // Left-to-right sweep
  const cycleLength = len + 20;
  const glimmerIndex = (frame % cycleLength) - 10;
  const shimmerStart = glimmerIndex - SHIMMER_BAND_WIDTH;
  const shimmerEnd = glimmerIndex + SHIMMER_BAND_WIDTH;
  const bright: RGB = [255, 255, 255];
  let out = "";
  for (let i = 0; i < len; i++) {
    const inShimmer = i >= shimmerStart && i <= shimmerEnd;
    const c = inShimmer ? bright : base;
    out += `\x1b[38;2;${c[0]};${c[1]};${c[2]}m${chars[i]}`;
  }
  return out + RESET;
}

export const VERBS = [
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
  "Flambeing",
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
  "Juggling",
  "Kindling",
  "Knitting",
  "Leavening",
  "Levitating",
  "Lollygagging",
  "Manifesting",
  "Marinating",
  "Meandering",
  "Moseying",
  "Mulling",
  "Musing",
  "Mustering",
  "Noodling",
  "Orchestrating",
  "Perambulating",
  "Percolating",
  "Permeating",
  "Philosophizing",
  "Pondering",
  "Pontificating",
  "Positing",
  "Postulating",
  "Pottering",
  "Processing",
  "Puttering",
  "Quantumizing",
  "Quickstepping",
  "Ratiocinating",
  "Reasoning",
  "Reflecting",
  "Resolving",
  "Reticulating",
  "Rhapsodizing",
  "Roasting",
  "Rolling",
  "Ruminating",
  "Sauntering",
  "Scaffolding",
  "Sculpting",
  "Seasoning",
  "Searing",
  "Shaping",
  "Shimmying",
  "Simmering",
  "Simulating",
  "Skedaddling",
  "Sketching",
  "Smooth-talking",
  "Sojourning",
  "Solving",
  "Spelunking",
  "Spinning",
  "Steaming",
  "Stewing",
  "Structuring",
  "Surcolating",
  "Synthesizing",
  "Tailoring",
  "Tinkering",
  "Toasting",
  "Transmuting",
  "Traversing",
  "Twiddling",
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
];
