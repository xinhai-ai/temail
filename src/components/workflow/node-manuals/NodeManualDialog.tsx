"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { NodeType } from "@/lib/workflow/types";
import { getDefaultNodeManual } from "./default";
import { loadNodeManual } from "./registry";
import type { NodeManual } from "./types";

export function NodeManualDialog({
  nodeType,
  open,
  onOpenChange,
}: {
  nodeType: NodeType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loaded, setLoaded] = useState<{ type: NodeType; manual: NodeManual } | null>(null);
  const manual = loaded?.type === nodeType ? loaded.manual : getDefaultNodeManual(nodeType);
  const loading = open && loaded?.type !== nodeType;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    loadNodeManual(nodeType)
      .then((loaded) => {
        if (cancelled) return;
        setLoaded({
          type: nodeType,
          manual: loaded,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({
          type: nodeType,
          manual: getDefaultNodeManual(nodeType),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [nodeType, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{manual.title}</DialogTitle>
          <DialogDescription>{manual.summary}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 w-full pr-4 -mr-4">
          <div className="py-4 space-y-4">
            {loading && (
              <p className="text-sm text-muted-foreground">
                Loading manual…
              </p>
            )}

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

            {!!manual.sections?.length && (
              <div className="space-y-4">
                {manual.sections.map((section) => (
                  <div key={section.title} className="space-y-2">
                    <h4 className="text-sm font-medium">{section.title}</h4>
                    {section.description && (
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    )}

                    {!!section.fields?.length && (
                      <div className="space-y-3">
                        {section.fields.map((field) => (
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
                    )}

                    {!!section.examples?.length && (
                      <div className="space-y-3">
                        {section.examples.map((example, index) => (
                          <div key={`${example.title}-${index}`} className="space-y-1">
                            <p className="text-sm font-medium">{example.title}</p>
                            <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">
                              <code>{example.example}</code>
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}

                    {!!section.notes?.length && (
                      <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                        {section.notes.map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
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
