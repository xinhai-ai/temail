"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Power, PowerOff, PencilLine, Trash2, Workflow, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  mailbox: { address: string } | null;
  _count: { executions: number };
  lastExecution: {
    status: string;
    startedAt: string;
  } | null;
  updatedAt: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      const data = await res.json().catch(() => []);
      setWorkflows(res.ok ? data : []);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleToggle = async (id: string, status: string) => {
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Workflow ${newStatus.toLowerCase()}`);
        fetchWorkflows();
      } else {
        toast.error("Failed to update workflow");
      }
    } catch {
      toast.error("Failed to update workflow");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Workflow deleted");
        fetchWorkflows();
      } else {
        toast.error("Failed to delete workflow");
      }
    } catch {
      toast.error("Failed to delete workflow");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Automate your email processing with visual workflows
          </p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">
            <Plus className="mr-2 h-4 w-4" /> New Workflow
          </Link>
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Workflow className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No workflows yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Create your first workflow to automate email processing
            </p>
            <Button asChild className="mt-4">
              <Link href="/workflows/new">
                <Plus className="mr-2 h-4 w-4" /> Create Workflow
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mailbox</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{workflow.name}</div>
                      {workflow.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {workflow.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        workflow.status === "ACTIVE"
                          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                          : workflow.status === "INACTIVE"
                          ? "bg-muted text-muted-foreground"
                          : "bg-blue-500/10 text-blue-600"
                      }
                    >
                      {workflow.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {workflow.mailbox?.address || "All"}
                  </TableCell>
                  <TableCell>
                    {workflow.lastExecution ? (
                      <div className="flex items-center gap-2">
                        {workflow.lastExecution.status === "SUCCESS" ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : workflow.lastExecution.status === "FAILED" ? (
                          <XCircle className="h-3 w-3 text-destructive" />
                        ) : (
                          <Clock className="h-3 w-3 text-amber-600" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(workflow.lastExecution.startedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {workflow._count.executions}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/workflows/${workflow.id}`}>
                          <PencilLine className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(workflow.id, workflow.status)}
                      >
                        {workflow.status === "ACTIVE" ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(workflow.id)}
                        className="hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
