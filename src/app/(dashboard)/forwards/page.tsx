"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Forward, Plus, Power, PowerOff, TestTube, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ForwardTarget {
  id: string;
  type: string;
  config: string;
}

interface ForwardRule {
  id: string;
  name: string;
  type: string;
  status: string;
  config: string;
  targets?: ForwardTarget[];
  mailbox?: { address: string } | null;
  mailboxId?: string | null;
  lastTriggered?: string | null;
}

export default function ForwardsPage() {
  const [rules, setRules] = useState<ForwardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<unknown>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/forwards");
      const data = await res.json().catch(() => []);
      setRules(res.ok ? data : []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch(`/api/forwards/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        return;
      }
      setTestRuleId(id);
      setTestResult(data);
      setTestDialogOpen(true);
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(null);
    }
  };

  const handleSendTest = async () => {
    if (!testRuleId) return;
    setSendingTest(true);
    try {
      const res = await fetch(`/api/forwards/${testRuleId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "send" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        return;
      }
      toast.success("Test sent!");
      setTestResult(data);
      fetchRules();
    } catch {
      toast.error("Test failed");
    } finally {
      setSendingTest(false);
    }
  };

  const handleToggle = async (id: string, status: string) => {
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await fetch(`/api/forwards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    const res = await fetch(`/api/forwards/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Rule deleted");
      fetchRules();
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forward Rules</h1>
          <p className="text-muted-foreground mt-1">Configure email forwarding to external services</p>
        </div>
        <Button asChild>
          <Link href="/forwards/new">
            <Plus className="mr-2 h-4 w-4" /> New Rule
          </Link>
        </Button>
      </div>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTestDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={handleSendTest} disabled={!testRuleId || sendingTest}>
              {sendingTest ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rules.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Forward className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No forward rules yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Create a rule to forward emails</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mailbox</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {(() => {
                        const types = rule.targets?.map((t) => t.type) || [];
                        const unique = Array.from(new Set(types));
                        if (unique.length === 0) return rule.type;
                        if (unique.length === 1) return unique[0];
                        return `MULTI (${types.length})`;
                      })()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        rule.status === "ACTIVE"
                          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {rule.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rule.mailbox?.address || "All"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleTest(rule.id)} disabled={testing === rule.id}>
                        <TestTube className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(rule.id, rule.status)}>
                        {rule.status === "ACTIVE" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
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

