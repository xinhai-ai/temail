import type { NodeType, WorkflowConfig } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

export type WorkflowPolicyNormalizationResult = {
  config: unknown;
  removedTypes: string[];
  removedNodeIds: string[];
};

export function normalizeWorkflowConfigForPolicy(
  config: unknown,
  options?: { disabledTypes?: Iterable<NodeType> }
): WorkflowPolicyNormalizationResult {
  if (!isRecord(config)) {
    return {
      config,
      removedTypes: [],
      removedNodeIds: [],
    };
  }

  const nodes = config.nodes;
  const edges = config.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return {
      config,
      removedTypes: [],
      removedNodeIds: [],
    };
  }

  const disabledTypes = new Set(options?.disabledTypes ?? []);
  const removedTypes = new Set<string>();
  const removedNodeIds = new Set<string>();

  const prefilteredNodes = nodes.filter((node) => {
    if (!isRecord(node)) return true;

    const nodeType = getString(node, "type");
    const nodeId = getString(node, "id");
    if (!nodeType) return true;

    if (disabledTypes.has(nodeType as NodeType)) {
      removedTypes.add(nodeType);
      if (nodeId) removedNodeIds.add(nodeId);
      return false;
    }

    if (nodeType === "trigger:schedule" || nodeType === "trigger:manual") {
      removedTypes.add(nodeType);
      if (nodeId) removedNodeIds.add(nodeId);
      return false;
    }

    return true;
  });

  let keptEmailTrigger = false;
  const finalNodes = prefilteredNodes.filter((node) => {
    if (!isRecord(node)) return true;

    const nodeType = getString(node, "type");
    const nodeId = getString(node, "id");
    if (!nodeType || !nodeType.startsWith("trigger:")) return true;

    if (nodeType !== "trigger:email") {
      removedTypes.add(nodeType);
      if (nodeId) removedNodeIds.add(nodeId);
      return false;
    }

    if (keptEmailTrigger) {
      removedTypes.add(nodeType);
      if (nodeId) removedNodeIds.add(nodeId);
      return false;
    }

    keptEmailTrigger = true;
    return true;
  });

  const keptNodeIds = new Set<string>(
    finalNodes
      .filter(isRecord)
      .map((node) => getString(node, "id"))
      .filter((id): id is string => Boolean(id))
  );

  const finalEdges = edges.filter((edge) => {
    if (!isRecord(edge)) return false;
    const source = getString(edge, "source");
    const target = getString(edge, "target");
    if (!source || !target) return false;
    return keptNodeIds.has(source) && keptNodeIds.has(target);
  });

  return {
    config: {
      ...config,
      nodes: finalNodes,
      edges: finalEdges,
    },
    removedTypes: Array.from(removedTypes).sort(),
    removedNodeIds: Array.from(removedNodeIds).sort(),
  };
}

export function normalizeTypedWorkflowConfigForPolicy(
  config: WorkflowConfig,
  options?: { disabledTypes?: Iterable<NodeType> }
): { config: WorkflowConfig; removedTypes: string[]; removedNodeIds: string[] } {
  const normalized = normalizeWorkflowConfigForPolicy(config, options);
  return {
    config: normalized.config as WorkflowConfig,
    removedTypes: normalized.removedTypes,
    removedNodeIds: normalized.removedNodeIds,
  };
}
