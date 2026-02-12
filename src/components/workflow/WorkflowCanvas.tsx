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
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { useWorkflowStore } from "@/lib/workflow/store";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges/CustomEdge";
import { NodePalette } from "./panels/NodePalette";
import { NodeConfigPanel } from "./panels/NodeConfigPanel";
import { WorkflowToolbar } from "./WorkflowToolbar";
import type { NodeType } from "@/lib/workflow/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Trash2, Copy, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface WorkflowCanvasProps {
  mailboxes?: { id: string; address: string }[];
  onTestClick?: () => void;
  canTest?: boolean;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);

    onChange();

    if (media.addEventListener) {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, [query]);

  return matches;
}

function WorkflowCanvasInner({ mailboxes, onTestClick, canTest }: WorkflowCanvasProps) {
  const t = useTranslations("workflows");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const [contextMenu, setContextMenu] = useState<{
    node: Node;
    x: number;
    y: number;
  } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edge: Edge;
    x: number;
    y: number;
  } | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setEdgeContextMenu(null);
    };
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

      if (!isLgUp) {
        setConfigOpen(true);
      }
    },
    [screenToFlowPosition, addNode, isLgUp]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);

      if (!isLgUp) {
        setConfigOpen(true);
      }
    },
    [setSelectedNodeId, isLgUp]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setConfigOpen(false);
    setContextMenu(null);
    setEdgeContextMenu(null);
  }, [setSelectedNodeId]);

  const onNodeContextMenu = useCallback((event: ReactMouseEvent, node: Node) => {
    event.preventDefault();
    setEdgeContextMenu(null);
    setContextMenu({
      node,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu(null);
      setEdgeContextMenu({
        edge,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const handleDeleteNode = useCallback(() => {
    if (contextMenu) {
      if (!isLgUp && contextMenu.node.id === selectedNodeId) {
        setConfigOpen(false);
      }
      deleteNode(contextMenu.node.id);
      setContextMenu(null);
    }
  }, [contextMenu, deleteNode, isLgUp, selectedNodeId]);

  const handleDeleteEdge = useCallback(() => {
    if (edgeContextMenu) {
      deleteEdge(edgeContextMenu.edge.id);
      setEdgeContextMenu(null);
    }
  }, [edgeContextMenu, deleteEdge]);

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
      <div className="md:hidden">
        <NodePalette collapsed={true} />
      </div>
      <div className="hidden md:block">
        <NodePalette />
      </div>
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
          onEdgeContextMenu={onEdgeContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          deleteKeyCode={["Backspace", "Delete"]}
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
            <WorkflowToolbar onTestClick={onTestClick} canTest={canTest} />
          </Panel>
          <Panel position="top-right" className="lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("canvas.openNodeConfig")}
              onClick={() => setConfigOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </Panel>
        </ReactFlow>
      </div>
      <div className="hidden lg:block">
        <NodeConfigPanel mailboxes={mailboxes} />
      </div>
      <Sheet open={!isLgUp && configOpen} onOpenChange={setConfigOpen}>
        <SheetContent side="right" className="w-80 p-0 lg:hidden">
          <NodeConfigPanel mailboxes={mailboxes} onClose={() => setConfigOpen(false)} />
        </SheetContent>
      </Sheet>

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
            {t("canvas.contextMenu.duplicate")}
          </button>
          <button
            onClick={handleDeleteNode}
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
              "text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
            )}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("canvas.contextMenu.delete")}
          </button>
        </div>
      )}

      {/* Edge Context Menu */}
      {edgeContextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md"
          style={{
            left: `${edgeContextMenu.x}px`,
            top: `${edgeContextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDeleteEdge}
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
              "text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
            )}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("canvas.contextMenu.disconnect")}
          </button>
        </div>
      )}
    </div>
  );
}

export function WorkflowCanvas({ mailboxes, onTestClick, canTest }: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner mailboxes={mailboxes} onTestClick={onTestClick} canTest={canTest} />
    </ReactFlowProvider>
  );
}
