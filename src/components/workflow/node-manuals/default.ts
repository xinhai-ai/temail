import { NODE_DEFINITIONS, type NodeType } from "@/lib/workflow/types";
import type { NodeManual } from "./types";

export function getDefaultNodeManual(type: NodeType): NodeManual {
  const definition = NODE_DEFINITIONS[type];

  return {
    title: definition?.label || "Node",
    summary:
      definition?.description ||
      "Use the configuration form to set this node's parameters.",
    notes: [
      "If you don't see a field here, the node likely has no additional configuration.",
      "Some fields support template variables like {{email.subject}} or {{variables.myVar}}.",
    ],
  };
}

