"use client";

import { useWorkflowStore, selectHasTrigger } from "@/lib/workflow/store";
import { validateWorkflow } from "@/lib/workflow/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { useMemo } from "react";

interface WorkflowToolbarProps {
  onTestClick?: () => void;
  canTest?: boolean;
}

export function WorkflowToolbar({ onTestClick, canTest = false }: WorkflowToolbarProps) {
  const name = useWorkflowStore((s) => s.name);
  const status = useWorkflowStore((s) => s.status);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const hasTrigger = useWorkflowStore(selectHasTrigger);
  const getConfig = useWorkflowStore((s) => s.getConfig);
  const nodes = useWorkflowStore((s) => s.nodes);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);

  const validationErrors = useMemo(() => {
    const config = getConfig();
    const errors = validateWorkflow(config);
    return errors.filter((e) => e.type === "error").length;
  }, [nodes, getConfig]);

  const canRunTest = canTest && hasTrigger && validationErrors === 0;

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4 bg-background border rounded-lg shadow-sm max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-medium text-sm truncate">{name}</span>
        {status === "ACTIVE" && (
          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
            Active
          </Badge>
        )}
        {status === "INACTIVE" && (
          <Badge variant="outline" className="text-muted-foreground">
            Inactive
          </Badge>
        )}
        {status === "DRAFT" && (
          <Badge variant="outline">Draft</Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:ml-auto">
        {/* Validation Status */}
        {!hasTrigger && (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="h-3 w-3" />
            <span className="hidden sm:inline">No trigger</span>
          </div>
        )}
        {validationErrors > 0 && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span className="hidden sm:inline">
              {validationErrors} error{validationErrors !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {hasTrigger && validationErrors === 0 && nodes.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Valid</span>
          </div>
        )}

        {/* Save Indicator */}
        {isDirty && (
          <span className="hidden sm:inline text-xs text-muted-foreground">Unsaved changes</span>
        )}

        {/* Actions */}
        <Button
          variant="outline"
          size="sm"
          disabled={!canRunTest}
          onClick={onTestClick}
          title={!canTest ? "Save workflow first" : !hasTrigger ? "Add a trigger node" : validationErrors > 0 ? "Fix validation errors" : "Test workflow"}
        >
          <Play className="h-3 w-3 sm:mr-1.5" />
          <span className="hidden sm:inline">Test</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetWorkflow}
          disabled={nodes.length === 0}
        >
          <Trash2 className="h-3 w-3 sm:mr-1.5" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      </div>
    </div>
  );
}
