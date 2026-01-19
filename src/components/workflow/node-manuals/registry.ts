import type { NodeType } from "@/lib/workflow/types";
import type { NodeManual } from "./types";

export type NodeManualLoader = () => Promise<{ default: NodeManual }>;

export const nodeManualLoaders: Partial<Record<NodeType, NodeManualLoader>> = {
  "trigger:email": () => import("./trigger-email"),
  "trigger:schedule": () => import("./trigger-schedule"),
  "trigger:manual": () => import("./trigger-manual"),

  "condition:match": () => import("./condition-match"),
  "condition:keyword": () => import("./condition-keyword"),
  "condition:ai-classifier": () => import("./condition-ai-classifier"),
  "condition:classifier": () => import("./condition-classifier"),
  "condition:custom": () => import("./condition-custom"),
};

export async function loadNodeManual(type: NodeType): Promise<NodeManual | null> {
  const loader = nodeManualLoaders[type];
  if (!loader) return null;
  const loadedModule = await loader();
  return loadedModule.default;
}
