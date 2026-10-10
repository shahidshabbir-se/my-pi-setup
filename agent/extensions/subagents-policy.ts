import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import subagents from "../npm/node_modules/@tintinweb/pi-subagents/src/index.ts";

// Keep the upstream runtime; adapt only its workflow selection policy to the
// user's explicit approval of automatic delegation. Do not patch npm files.
export default function (pi: ExtensionAPI) {
  return subagents({
    ...pi,
    registerTool(tool) {
      if (tool.name !== "SubagentWorkflow") {
        pi.registerTool(tool);
        return;
      }

      const start = tool.description.indexOf("ONLY call this tool when the user has explicitly opted");
      const end = tool.description.indexOf("When you do call it, the right move is often", start);
      if (start < 0 || end < 0) {
        throw new Error("pi-subagents workflow policy changed; review subagents-policy.ts before loading it.");
      }

      const policy = "The user has authorized automatic workflow selection. Use SubagentWorkflow for substantial multi-stage orchestration or runtime-discovered fan-out. Use Agent for one delegated task or a small set of independent tasks. Keep the workload bounded; ask before unusually expensive fan-outs. Scheduling and security-sensitive actions still require explicit approval.\n\n";
      // Upstream compares workflowTool.description with the registry on
      // session_start. Keep the same object so it recognizes its own tool.
      tool.description = tool.description.slice(0, start) + policy + tool.description.slice(end);
      pi.registerTool(tool);
    },
  });
}
