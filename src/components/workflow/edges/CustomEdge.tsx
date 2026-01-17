"use client";

import { memo } from "react";
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from "reactflow";
import { cn } from "@/lib/utils";

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 根据 sourceHandle 确定边的颜色（用于条件分支）
  const isTrue = sourceHandleId === "true";
  const isFalse = sourceHandleId === "false";

  return (
    <>
      <path
        id={id}
        className={cn(
          "react-flow__edge-path transition-all",
          selected && "!stroke-primary",
          isTrue && "!stroke-green-500",
          isFalse && "!stroke-red-500"
        )}
        d={edgePath}
        strokeWidth={selected ? 2 : 1.5}
        markerEnd={markerEnd}
        style={{
          stroke: isTrue ? "#22c55e" : isFalse ? "#ef4444" : undefined,
        }}
      />
      {/* 条件边的标签 */}
      {(isTrue || isFalse) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              isTrue && "bg-green-100 text-green-700",
              isFalse && "bg-red-100 text-red-700"
            )}
          >
            {isTrue ? "Yes" : "No"}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);

export const edgeTypes = {
  default: CustomEdge,
};
