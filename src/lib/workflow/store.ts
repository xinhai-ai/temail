import { create } from "zustand";
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import type { NodeType, NodeData, WorkflowConfig } from "./types";
import { NODE_DEFINITIONS, createDefaultNode } from "./types";

// ==================== 类型定义 ====================

export interface WorkflowNode extends Node<NodeData> {
  type: NodeType;
}

export interface WorkflowState {
  // 工作流元数据
  id: string | null;
  name: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ERROR";
  mailboxId: string | null;

  // ReactFlow 状态
  nodes: WorkflowNode[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };

  // UI 状态
  selectedNodeId: string | null;
  isDirty: boolean;
  isSaving: boolean;

  // 操作
  setWorkflowMeta: (meta: Partial<Pick<WorkflowState, "id" | "name" | "description" | "status" | "mailboxId">>) => void;
  loadWorkflow: (id: string, name: string, description: string, status: string, mailboxId: string | null, config: WorkflowConfig) => void;
  resetWorkflow: () => void;

  // 节点操作
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;

  // 选择
  setSelectedNodeId: (nodeId: string | null) => void;

  // 视图
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  // 保存
  setIsSaving: (isSaving: boolean) => void;
  markClean: () => void;

  // 导出配置
  getConfig: () => WorkflowConfig;
}

// ==================== 初始状态 ====================

const initialState = {
  id: null,
  name: "Untitled Workflow",
  description: "",
  status: "DRAFT" as const,
  mailboxId: null,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,
  isDirty: false,
  isSaving: false,
};

// ==================== Store ====================

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,

  setWorkflowMeta: (meta) => {
    set((state) => ({
      ...meta,
      isDirty: true,
    }));
  },

  loadWorkflow: (id, name, description, status, mailboxId, config) => {
    const nodes: WorkflowNode[] = config.nodes.map((node) => ({
      ...node,
      data: {
        ...NODE_DEFINITIONS[node.type].defaultData,
        ...node.data,
      },
    }));

    set({
      id,
      name,
      description: description || "",
      status: status as WorkflowState["status"],
      mailboxId,
      nodes,
      edges: config.edges,
      viewport: config.viewport || { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
      isDirty: false,
      isSaving: false,
    });
  },

  resetWorkflow: () => {
    set(initialState);
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as WorkflowNode[],
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.sourceHandle || "default"}-${connection.target}-${Date.now()}`,
        },
        state.edges
      ),
      isDirty: true,
    }));
  },

  addNode: (type, position) => {
    const newNode = createDefaultNode(type, position);
    set((state) => ({
      nodes: [...state.nodes, newNode as WorkflowNode],
      selectedNodeId: newNode.id,
      isDirty: true,
    }));
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
      isDirty: true,
    }));
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
      isDirty: true,
    }));
  },

  setSelectedNodeId: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setViewport: (viewport) => {
    set({ viewport });
  },

  setIsSaving: (isSaving) => {
    set({ isSaving });
  },

  markClean: () => {
    set({ isDirty: false });
  },

  getConfig: () => {
    const state = get();
    return {
      version: 1,
      nodes: state.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      })),
      edges: state.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
      })),
      viewport: state.viewport,
    };
  },
}));

// ==================== 选择器 ====================

export const selectSelectedNode = (state: WorkflowState) => {
  if (!state.selectedNodeId) return null;
  return state.nodes.find((node) => node.id === state.selectedNodeId) || null;
};

export const selectNodeById = (nodeId: string) => (state: WorkflowState) => {
  return state.nodes.find((node) => node.id === nodeId) || null;
};

export const selectTriggerNodes = (state: WorkflowState) => {
  return state.nodes.filter((node) => node.type.startsWith("trigger:"));
};

export const selectHasTrigger = (state: WorkflowState) => {
  return state.nodes.some((node) => node.type.startsWith("trigger:"));
};
