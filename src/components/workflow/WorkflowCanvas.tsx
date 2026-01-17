"use client";

import { useCallback, useRef, DragEvent, useState, MouseEvent as ReactMouseEvent, useEffect } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { useWorkflowStore } from "@/lib/workflow/store";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges/CustomEdge";
import { NodePalette } from "./panels/NodePalette";
import { NodeConfigPanel } from "./panels/NodeConfigPanel";
import { WorkflowToolbar } from "./WorkflowToolbar";
import type { NodeType } from "@/lib/workflow/types";
import { Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowCanvasProps {
  mailboxes?: { id: string; address: string }[];
}

function WorkflowCanvasInner({ mailboxes }: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [contextMenu, setContextMenu] = useState<{
    node: Node;
    x: number;
    y: number;
  } | null>(null);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow") as NodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, [setSelectedNodeId]);

  const onNodeContextMenu = useCallback((event: ReactMouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      node,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handleDeleteNode = useCallback(() => {
    if (contextMenu) {
      deleteNode(contextMenu.node.id);
      setContextMenu(null);
    }
  }, [contextMenu, deleteNode]);

  const handleDuplicateNode = useCallback(() => {
    if (contextMenu) {
      const newPosition = {
        x: contextMenu.node.position.x + 50,
        y: contextMenu.node.position.y + 50,
      };
      addNode(contextMenu.node.type as NodeType, newPosition);
      setContextMenu(null);
    }
  }, [contextMenu, addNode]);

  return (
    <div className="flex h-full overflow-hidden relative">
      <NodePalette />
      <div className="flex-1 relative overflow-hidden" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{
            type: "default",
            animated: false,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-background !border !border-border"
          />
          <Panel position="top-center">
            <WorkflowToolbar />
          </Panel>
        </ReactFlow>
      </div>
      <NodeConfigPanel mailboxes={mailboxes} />

      {/* Custom Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDuplicateNode}
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
              "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            )}
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </button>
          <button
            onClick={handleDeleteNode}
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
              "text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
            )}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function WorkflowCanvas({ mailboxes }: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner mailboxes={mailboxes} />
    </ReactFlowProvider>
  );
}
