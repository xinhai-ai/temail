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
import { enUS, zhCN } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";

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
  const locale = useLocale();
  const t = useTranslations("workflows");
  const distanceLocale = locale === "zh" ? zhCN : enUS;

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [disabledMessage, setDisabledMessage] = useState("");

  const getWorkflowStatusLabel = (value: WorkflowItem["status"]) => {
    if (value === "ACTIVE") return t("status.active");
    if (value === "INACTIVE") return t("status.inactive");
    return value;
  };

  const fetchWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setWorkflows([]);
        if (res.status === 403 && data && typeof data === "object" && "error" in data) {
          setDisabled(true);
          setDisabledMessage(String((data as { error?: unknown }).error || ""));
        } else {
          setDisabled(false);
          setDisabledMessage("");
        }
        return;
      }
      setDisabled(false);
      setDisabledMessage("");
      setWorkflows(Array.isArray(data) ? (data as WorkflowItem[]) : []);
    } catch {
      setWorkflows([]);
      setDisabled(false);
      setDisabledMessage("");
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
        toast.success(newStatus === "ACTIVE" ? t("toast.activated") : t("toast.deactivated"));
        fetchWorkflows();
      } else {
        toast.error(t("toast.updateFailed"));
      }
    } catch {
      toast.error(t("toast.updateFailed"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirm.delete"))) return;
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("toast.deleted"));
        fetchWorkflows();
      } else {
        toast.error(t("toast.deleteFailed"));
      }
    } catch {
      toast.error(t("toast.deleteFailed"));
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
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        {!disabled && (
          <Button asChild>
            <Link href="/workflows/new">
              <Plus className="mr-2 h-4 w-4" /> {t("actions.newWorkflow")}
            </Link>
          </Button>
        )}
      </div>

      {disabled ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Workflow className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{disabledMessage || t("toast.updateFailed")}</p>
          </CardContent>
        </Card>
      ) : workflows.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Workflow className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {t("empty.description")}
            </p>
            <Button asChild className="mt-4">
              <Link href="/workflows/new">
                <Plus className="mr-2 h-4 w-4" /> {t("actions.createWorkflow")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.mailbox")}</TableHead>
                <TableHead>{t("table.lastRun")}</TableHead>
                <TableHead>{t("table.executions")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
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
                      {getWorkflowStatusLabel(workflow.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {workflow.mailbox?.address || t("mailboxAll")}
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
                            locale: distanceLocale,
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t("lastRunNever")}</span>
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
