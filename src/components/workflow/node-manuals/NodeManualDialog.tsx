"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { NodeType } from "@/lib/workflow/types";
import { getDefaultNodeManual } from "./default";

export function NodeManualDialog({
  nodeType,
  open,
  onOpenChange,
}: {
  nodeType: NodeType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const manual = getDefaultNodeManual(nodeType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{manual.title}</DialogTitle>
          <DialogDescription>{manual.summary}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="py-4 space-y-4">
            {!!manual.fields?.length && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Fields</h4>
                <div className="space-y-3">
                  {manual.fields.map((field) => (
                    <div key={field.key} className="rounded-md border p-3 bg-background space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{field.label}</p>
                        {field.required && (
                          <span className="text-[10px] text-muted-foreground">Required</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                      {field.example && (
                        <pre className="mt-2 text-xs bg-muted/40 rounded p-2 overflow-x-auto">
                          <code>{field.example}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!manual.examples?.length && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Examples</h4>
                <div className="space-y-3">
                  {manual.examples.map((example, index) => (
                    <div key={`${example.title}-${index}`} className="space-y-1">
                      <p className="text-sm font-medium">{example.title}</p>
                      <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">
                        <code>{example.example}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!manual.notes?.length && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Notes</h4>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {manual.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

