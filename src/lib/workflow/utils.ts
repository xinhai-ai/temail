import type { WorkflowConfig, WorkflowNode, WorkflowEdge, NodeType } from "./types";
import { NODE_DEFINITIONS } from "./types";

// ==================== 工作流验证 ====================

export interface ValidationError {
  nodeId?: string;
  message: string;
  type: "error" | "warning";
}

export function validateWorkflow(config: WorkflowConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(config.nodes.map((n) => n.id));

  // 检查是否有触发器节点
  const triggerNodes = config.nodes.filter((n) => n.type.startsWith("trigger:"));
  if (triggerNodes.length === 0) {
    errors.push({
      message: "Workflow must have at least one trigger node",
      type: "error",
    });
  }

  // 检查边的有效性
  for (const edge of config.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        message: `Edge references non-existent source node: ${edge.source}`,
        type: "error",
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        message: `Edge references non-existent target node: ${edge.target}`,
        type: "error",
      });
    }
  }

  // 检查每个节点的连接
  for (const node of config.nodes) {
    const def = NODE_DEFINITIONS[node.type];
    if (!def) continue;

    // 触发器节点不应有入边
    if (node.type.startsWith("trigger:")) {
      const incomingEdges = config.edges.filter((e) => e.target === node.id);
      if (incomingEdges.length > 0) {
        errors.push({
          nodeId: node.id,
          message: "Trigger nodes cannot have incoming connections",
          type: "error",
        });
      }
    }

    // 非触发器节点应该有入边
    if (!node.type.startsWith("trigger:") && def.inputs > 0) {
      const incomingEdges = config.edges.filter((e) => e.target === node.id);
      if (incomingEdges.length === 0) {
        errors.push({
          nodeId: node.id,
          message: "Node has no incoming connections",
          type: "warning",
        });
      }
    }

    // 非结束节点应该有出边
    if (node.type !== "control:end" && def.outputs !== 0) {
      const outgoingEdges = config.edges.filter((e) => e.source === node.id);
      if (outgoingEdges.length === 0) {
        errors.push({
          nodeId: node.id,
          message: "Node has no outgoing connections",
          type: "warning",
        });
      }
    }
  }

  // 检查是否存在环路
  const cycles = detectCycles(config);
  if (cycles.length > 0) {
    errors.push({
      message: `Workflow contains cycles: ${cycles.join(", ")}`,
      type: "error",
    });
  }

  return errors;
}

// ==================== 环路检测 ====================

function detectCycles(config: WorkflowConfig): string[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of config.edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge.target);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path, neighbor])) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        cycles.push([...path, neighbor].join(" -> "));
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of config.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, [node.id]);
    }
  }

  return cycles;
}

// ==================== 拓扑排序 ====================

export function topologicalSort(config: WorkflowConfig): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // 初始化
  for (const node of config.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // 构建邻接表和入度
  for (const edge of config.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn 算法
  const queue: string[] = [];
  const result: string[] = [];

  // 从入度为 0 的节点开始（触发器节点）
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}

// ==================== 节点工具函数 ====================

export function getConnectedNodes(
  nodeId: string,
  edges: WorkflowEdge[],
  direction: "incoming" | "outgoing" | "both" = "both"
): string[] {
  const connected: string[] = [];

  for (const edge of edges) {
    if (direction !== "outgoing" && edge.target === nodeId) {
      connected.push(edge.source);
    }
    if (direction !== "incoming" && edge.source === nodeId) {
      connected.push(edge.target);
    }
  }

  return connected;
}

export function getNodesByType(
  nodes: WorkflowNode[],
  types: NodeType[]
): WorkflowNode[] {
  return nodes.filter((node) => types.includes(node.type));
}

export function getNextNodes(
  nodeId: string,
  edges: WorkflowEdge[],
  sourceHandle?: string
): string[] {
  return edges
    .filter(
      (edge) =>
        edge.source === nodeId &&
        (sourceHandle === undefined || edge.sourceHandle === sourceHandle)
    )
    .map((edge) => edge.target);
}

// ==================== 模板变量替换 ====================

export interface TemplateContext {
  email?: {
    id?: string;
    messageId?: string;
    fromAddress: string;
    fromName?: string;
    toAddress: string;
    replyTo?: string;
    subject: string;
    textBody?: string;
    htmlBody?: string;
    previewUrl?: string;
    receivedAt: Date | string;
  };
  mailbox?: {
    id?: string;
    address?: string;
  };
  variables: Record<string, unknown>;
}

export function replaceTemplateVariables(
  template: string,
  context: TemplateContext | Record<string, unknown>
): string {
  let result = template;

  // 支持两种格式的上下文
  const ctx = context as TemplateContext;

  // 替换邮件变量
  if (ctx.email) {
    const email = ctx.email;
    const receivedAt = email.receivedAt instanceof Date
      ? email.receivedAt.toISOString()
      : String(email.receivedAt || "");

    result = result.replace(/\{\{email\.id\}\}/g, email.id || "");
    result = result.replace(/\{\{email\.messageId\}\}/g, email.messageId || "");
    result = result.replace(/\{\{email\.fromAddress\}\}/g, email.fromAddress || "");
    result = result.replace(/\{\{email\.fromName\}\}/g, email.fromName || "");
    result = result.replace(/\{\{email\.toAddress\}\}/g, email.toAddress || "");
    result = result.replace(/\{\{email\.replyTo\}\}/g, email.replyTo || "");
    result = result.replace(/\{\{email\.subject\}\}/g, email.subject || "");
    result = result.replace(/\{\{email\.textBody\}\}/g, email.textBody || "");
    result = result.replace(/\{\{email\.htmlBody\}\}/g, email.htmlBody || "");
    result = result.replace(/\{\{email\.previewUrl\}\}/g, email.previewUrl || "");
    result = result.replace(/\{\{email\.receivedAt\}\}/g, receivedAt);
  }

  // 替换邮箱变量
  if (ctx.mailbox) {
    result = result.replace(/\{\{mailbox\.id\}\}/g, ctx.mailbox.id || "");
    result = result.replace(/\{\{mailbox\.address\}\}/g, ctx.mailbox.address || "");
  }

  // 替换自定义变量
  const vars = ctx.variables || (context as Record<string, unknown>).variables;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{variables\\.${key}\\}\\}`, "g");
      result = result.replace(regex, String(value ?? ""));
    }
  }

  // 通用替换模式 - 处理任意嵌套对象
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.split(".");
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return match; // 保留原始模板变量
      }
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return value !== undefined && value !== null ? String(value) : "";
  });

  return result;
}

// ==================== ID 生成 ====================

export function generateNodeId(type: NodeType): string {
  return `${type.replace(":", "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateEdgeId(source: string, target: string, sourceHandle?: string): string {
  const handlePart = sourceHandle ? `-${sourceHandle}` : "";
  return `edge-${source}${handlePart}-${target}-${Date.now()}`;
}

// ==================== 节点位置计算 ====================

export function calculateNewNodePosition(
  nodes: WorkflowNode[],
  basePosition?: { x: number; y: number }
): { x: number; y: number } {
  if (basePosition) {
    return basePosition;
  }

  if (nodes.length === 0) {
    return { x: 100, y: 100 };
  }

  // 找到最右下角的节点
  let maxX = 0;
  let maxY = 0;

  for (const node of nodes) {
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  }

  return { x: maxX + 200, y: maxY };
}

// ==================== 导出节点分组 ====================

export function groupNodesByCategory(types: NodeType[]): Record<string, NodeType[]> {
  const groups: Record<string, NodeType[]> = {
    trigger: [],
    condition: [],
    action: [],
    forward: [],
    control: [],
  };

  for (const type of types) {
    const category = type.split(":")[0];
    if (category in groups) {
      groups[category].push(type);
    }
  }

  return groups;
}
