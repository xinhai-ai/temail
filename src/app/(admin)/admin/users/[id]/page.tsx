"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Shield,
  User,
  Lock,
  Inbox,
  MailOpen,
  Forward,
  Trash2,
  Save,
  TestTube,
  Power,
  PowerOff,
  Plus,
  Eye,
  Workflow,
  Pencil,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  isActive: boolean;
  emailVerified: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { mailboxes: number; domains: number; forwardRules: number; workflows: number; emails: number };
}

interface Mailbox {
  id: string;
  address: string;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  note?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  domain: { name: string };
  _count: { emails: number };
}

interface Email {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  status: "UNREAD" | "READ" | "ARCHIVED" | "DELETED";
  receivedAt: string;
  mailbox: { id: string; address: string };
}

interface EmailDetail extends Email {
  textBody?: string | null;
  htmlBody?: string | null;
  headers: { id: string; name: string; value: string }[];
  attachments: { id: string; filename: string; contentType: string; size: number; path: string }[];
}

interface ForwardRule {
  id: string;
  name: string;
  type: "EMAIL" | "TELEGRAM" | "DISCORD" | "SLACK" | "WEBHOOK";
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  mailboxId?: string | null;
  mailbox?: { id: string; address: string } | null;
  lastTriggered?: string | null;
  createdAt: string;
}

interface WorkflowItem {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ERROR";
  mailbox?: { id: string; address: string } | null;
  createdAt: string;
  updatedAt: string;
  _count: { executions: number; dispatchLogs: number };
}

const forwardTypes = [
  { value: "EMAIL", label: "Email" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "DISCORD", label: "Discord" },
  { value: "SLACK", label: "Slack" },
  { value: "WEBHOOK", label: "Webhook" },
] as const;

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const ALL_MAILBOXES_SELECT_VALUE = "__all__";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Profile form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserDetail["role"]>("USER");
  const [isActive, setIsActive] = useState(true);
  const [emailVerified, setEmailVerified] = useState<string>("");

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Mailboxes
  const [mailboxSearch, setMailboxSearch] = useState("");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(false);

  // Emails
  const [emailSearch, setEmailSearch] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailDetail, setEmailDetail] = useState<EmailDetail | null>(null);
  const [emailDetailOpen, setEmailDetailOpen] = useState(false);

  // Forwards
  const [forwards, setForwards] = useState<ForwardRule[]>([]);
  const [forwardsLoading, setForwardsLoading] = useState(false);
  const [testingForwardId, setTestingForwardId] = useState<string | null>(null);

  // Workflows
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [renameWorkflowOpen, setRenameWorkflowOpen] = useState(false);
  const [renameWorkflowId, setRenameWorkflowId] = useState<string | null>(null);
  const [renameWorkflowName, setRenameWorkflowName] = useState("");
  const [renamingWorkflow, setRenamingWorkflow] = useState(false);

  // Create forward dialog
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardName, setForwardName] = useState("");
  const [forwardType, setForwardType] = useState<ForwardRule["type"]>("WEBHOOK");
  const [forwardMailboxId, setForwardMailboxId] = useState<string>("");
  const [emailTo, setEmailTo] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookHeaders, setWebhookHeaders] = useState("");

  const roleBadgeVariant = useMemo(() => {
    if (!user) return "secondary";
    return user.role === "SUPER_ADMIN"
      ? "destructive"
      : user.role === "ADMIN"
      ? "default"
      : "secondary";
  }, [user]);

  const fetchUser = async () => {
    const res = await fetch(`/api/admin/users/${id}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to load user");
      return;
    }

    const data: UserDetail = await res.json();
    setUser(data);
    setEmail(data.email);
    setName(data.name || "");
    setRole(data.role);
    setIsActive(data.isActive);
    setEmailVerified(data.emailVerified || "");
  };

  const fetchMailboxes = async () => {
    setMailboxesLoading(true);
    const res = await fetch(
      `/api/admin/users/${id}/mailboxes?search=${encodeURIComponent(mailboxSearch)}&limit=100`
    );
    const data = await res.json();
    setMailboxes(res.ok ? data.mailboxes : []);
    setMailboxesLoading(false);
  };

  const fetchEmails = async () => {
    setEmailsLoading(true);
    const res = await fetch(
      `/api/admin/users/${id}/emails?search=${encodeURIComponent(emailSearch)}&limit=50`
    );
    const data = await res.json();
    setEmails(res.ok ? data.emails : []);
    setEmailsLoading(false);
  };

  const fetchForwards = async () => {
    setForwardsLoading(true);
    const res = await fetch(`/api/admin/users/${id}/forwards`);
    const data = await res.json();
    setForwards(res.ok ? data : []);
    setForwardsLoading(false);
  };

  const fetchWorkflows = async () => {
    setWorkflowsLoading(true);
    const res = await fetch(`/api/admin/users/${id}/workflows`);
    const data = await res.json();
    setWorkflows(res.ok ? data : []);
    setWorkflowsLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await Promise.all([fetchUser(), fetchMailboxes(), fetchEmails(), fetchForwards(), fetchWorkflows()]);
      setLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchMailboxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxSearch]);

  useEffect(() => {
    fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailSearch]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);

    const payload: Record<string, unknown> = {};
    if (email !== user.email) payload.email = email;
    if (name !== (user.name || "")) payload.name = name || null;
    if (role !== user.role) payload.role = role;
    if (isActive !== user.isActive) payload.isActive = isActive;
    if ((emailVerified || null) !== (user.emailVerified || null)) {
      payload.emailVerified = emailVerified ? new Date(emailVerified).toISOString() : null;
    }

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success("User updated");
      await fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to update user");
    }

    setSavingProfile(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    setResettingPassword(true);
    const res = await fetch(`/api/admin/users/${id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });

    if (res.ok) {
      toast.success("Password reset");
      setNewPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to reset password");
    }
    setResettingPassword(false);
  };

  const handleToggleMailbox = async (mailboxId: string, status: Mailbox["status"]) => {
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/admin/mailboxes/${mailboxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      toast.success("Mailbox updated");
      fetchMailboxes();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to update mailbox");
    }
  };

  const handleDeleteMailbox = async (mailboxId: string) => {
    if (!confirm("Delete this mailbox? This will delete all emails under it.")) return;
    const res = await fetch(`/api/admin/mailboxes/${mailboxId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Mailbox deleted");
      fetchMailboxes();
      fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to delete mailbox");
    }
  };

  const handleViewEmail = async (emailId: string) => {
    const res = await fetch(`/api/admin/emails/${emailId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to load email");
      return;
    }
    const data: EmailDetail = await res.json();
    setEmailDetail(data);
    setEmailDetailOpen(true);
  };

  const handleDeleteEmail = async (emailId: string) => {
    if (!confirm("Delete this email?")) return;
    const res = await fetch(`/api/admin/emails/${emailId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Email deleted");
      fetchEmails();
      fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to delete email");
    }
  };

  const handleToggleForward = async (forwardId: string, status: ForwardRule["status"]) => {
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/admin/forwards/${forwardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast.success("Forward updated");
      fetchForwards();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to update forward");
    }
  };

  const handleDeleteForward = async (forwardId: string) => {
    if (!confirm("Delete this forward rule?")) return;
    const res = await fetch(`/api/admin/forwards/${forwardId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Forward deleted");
      fetchForwards();
      fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to delete forward");
    }
  };

  const openRenameWorkflow = (workflow: WorkflowItem) => {
    setRenameWorkflowId(workflow.id);
    setRenameWorkflowName(workflow.name);
    setRenameWorkflowOpen(true);
  };

  const handleRenameWorkflow = async () => {
    if (!renameWorkflowId) return;
    const trimmed = renameWorkflowName.trim();
    if (!trimmed) {
      toast.error("Please enter a workflow name");
      return;
    }

    setRenamingWorkflow(true);
    const res = await fetch(`/api/admin/workflows/${renameWorkflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    if (res.ok) {
      toast.success("Workflow renamed");
      setRenameWorkflowOpen(false);
      setRenameWorkflowId(null);
      setRenameWorkflowName("");
      fetchWorkflows();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to rename workflow");
    }

    setRenamingWorkflow(false);
  };

  const handleToggleWorkflow = async (workflowId: string, status: WorkflowItem["status"]) => {
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/admin/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      toast.success("Workflow updated");
      fetchWorkflows();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to update workflow");
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm("Delete this workflow? This will delete its execution history.")) return;
    const res = await fetch(`/api/admin/workflows/${workflowId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Workflow deleted");
      fetchWorkflows();
      fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to delete workflow");
    }
  };

  const handleTestForward = async (forwardId: string) => {
    setTestingForwardId(forwardId);
    const res = await fetch(`/api/admin/forwards/${forwardId}/test`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Test notification sent!");
    } else {
      toast.error(data.error || "Test failed");
    }
    setTestingForwardId(null);
  };

  const buildForwardConfig = () => {
    switch (forwardType) {
      case "EMAIL":
        return JSON.stringify({ to: emailTo });
      case "TELEGRAM":
        return JSON.stringify({ token: telegramToken, chatId: telegramChatId });
      case "DISCORD":
      case "SLACK":
      case "WEBHOOK":
        return JSON.stringify({
          url: webhookUrl,
          headers: webhookHeaders ? JSON.parse(webhookHeaders) : {},
        });
      default:
        return "{}";
    }
  };

  const resetForwardForm = () => {
    setForwardName("");
    setForwardType("WEBHOOK");
    setForwardMailboxId("");
    setEmailTo("");
    setTelegramToken("");
    setTelegramChatId("");
    setWebhookUrl("");
    setWebhookHeaders("");
  };

  const handleCreateForward = async () => {
    if (!forwardName) {
      toast.error("Please enter a rule name");
      return;
    }

    try {
      const config = buildForwardConfig();
      const res = await fetch(`/api/admin/users/${id}/forwards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: forwardName,
          type: forwardType,
          config,
          mailboxId: forwardMailboxId || null,
        }),
      });

      if (res.ok) {
        toast.success("Forward rule created");
        setForwardOpen(false);
        resetForwardForm();
        fetchForwards();
        fetchUser();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create rule");
      }
    } catch {
      toast.error("Invalid configuration format");
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{user.email}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={roleBadgeVariant}>{user.role}</Badge>
              <Badge variant={user.isActive ? "default" : "secondary"}>
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Created {format(new Date(user.createdAt), "PP")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Inbox className="h-3 w-3" /> {user._count.mailboxes} mailboxes
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <MailOpen className="h-3 w-3" /> {user._count.emails} emails
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Forward className="h-3 w-3" /> {user._count.forwardRules} forwards
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Workflow className="h-3 w-3" /> {user._count.workflows} workflows
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" /> {user._count.domains} domains
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="mailboxes" className="gap-2">
            <Inbox className="h-4 w-4" />
            Mailboxes
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="forwards" className="gap-2">
            <Forward className="h-4 w-4" />
            Forwards
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <Workflow className="h-4 w-4" />
            Workflows
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as UserDetail["role"])}
                    disabled={!isSuperAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">USER</SelectItem>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                      <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isSuperAdmin && (
                    <p className="text-xs text-muted-foreground">
                      Only SUPER_ADMIN can change roles.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email Verified (ISO)</Label>
                  <Input
                    placeholder="2026-01-16T00:00:00.000Z"
                    value={emailVerified}
                    onChange={(e) => setEmailVerified(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">Disable user login</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingProfile ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleResetPassword} disabled={resettingPassword}>
                <Lock className="h-4 w-4 mr-2" />
                {resettingPassword ? "Resetting..." : "Reset Password"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Note: JWT sessions are not revoked automatically yet.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mailboxes" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Mailboxes</span>
                <Input
                  className="max-w-xs"
                  placeholder="Search…"
                  value={mailboxSearch}
                  onChange={(e) => setMailboxSearch(e.target.value)}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mailboxesLoading ? (
                <div className="flex justify-center p-8">Loading…</div>
              ) : mailboxes.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No mailboxes</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Emails</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mailboxes.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.address}</TableCell>
                        <TableCell>
                          <Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{m._count.emails}</TableCell>
                        <TableCell>
                          {m.expiresAt ? format(new Date(m.expiresAt), "PP") : "-"}
                        </TableCell>
                        <TableCell>{format(new Date(m.createdAt), "PP")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleMailbox(m.id, m.status)}
                            >
                              {m.status === "ACTIVE" ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteMailbox(m.id)}
                              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Emails</span>
                <Input
                  className="max-w-xs"
                  placeholder="Search…"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emailsLoading ? (
                <div className="flex justify-center p-8">Loading…</div>
              ) : emails.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No emails</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Mailbox</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.subject}</TableCell>
                        <TableCell>{e.fromAddress}</TableCell>
                        <TableCell>{e.mailbox.address}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "UNREAD" ? "default" : "secondary"}>
                            {e.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(e.receivedAt), "PPpp")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewEmail(e.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteEmail(e.id)}
                              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={emailDetailOpen} onOpenChange={setEmailDetailOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Email Details</DialogTitle>
              </DialogHeader>
              {!emailDetail ? (
                <div className="p-6 text-muted-foreground">Loading…</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Subject</p>
                      <p className="font-medium">{emailDetail.subject}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Received</p>
                      <p className="font-medium">
                        {format(new Date(emailDetail.receivedAt), "PPpp")}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">From</p>
                      <p className="font-medium">{emailDetail.fromAddress}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">To</p>
                      <p className="font-medium">{emailDetail.toAddress}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Text</Label>
                      <Textarea
                        value={emailDetail.textBody || ""}
                        readOnly
                        rows={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>HTML</Label>
                      <Textarea
                        value={emailDetail.htmlBody || ""}
                        readOnly
                        rows={10}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Headers</Label>
                      <div className="max-h-48 overflow-auto border rounded-md p-3 text-sm font-mono">
                        {emailDetail.headers.length === 0
                          ? "(none)"
                          : emailDetail.headers
                              .map((h) => `${h.name}: ${h.value}`)
                              .join("\\n")}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Attachments</Label>
                      <div className="max-h-48 overflow-auto border rounded-md p-3 text-sm">
                        {emailDetail.attachments.length === 0 ? (
                          "(none)"
                        ) : (
                          <ul className="space-y-1">
                            {emailDetail.attachments.map((a) => (
                              <li key={a.id}>
                                {a.filename} ({a.contentType}, {a.size} bytes)
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="forwards" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Forward Rules</span>
                <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      New Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create Forward Rule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Rule Name</Label>
                        <Input
                          placeholder="My forward rule"
                          value={forwardName}
                          onChange={(e) => setForwardName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Apply to Mailbox (Optional)</Label>
                        <Select
                          value={forwardMailboxId}
                          onValueChange={(value) =>
                            setForwardMailboxId(value === ALL_MAILBOXES_SELECT_VALUE ? "" : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All mailboxes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_MAILBOXES_SELECT_VALUE}>All mailboxes</SelectItem>
                            {mailboxes.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Forward Type</Label>
                        <Select
                          value={forwardType}
                          onValueChange={(v) => setForwardType(v as ForwardRule["type"])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {forwardTypes.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {forwardType === "EMAIL" && (
                        <div className="space-y-2">
                          <Label>Forward to Email Address</Label>
                          <Input
                            type="email"
                            placeholder="forward@example.com"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                          />
                        </div>
                      )}

                      {forwardType === "TELEGRAM" && (
                        <>
                          <div className="space-y-2">
                            <Label>Bot Token</Label>
                            <Input
                              placeholder="123456789:ABC..."
                              value={telegramToken}
                              onChange={(e) => setTelegramToken(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Chat ID</Label>
                            <Input
                              placeholder="-1001234567890"
                              value={telegramChatId}
                              onChange={(e) => setTelegramChatId(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      {(forwardType === "DISCORD" || forwardType === "SLACK" || forwardType === "WEBHOOK") && (
                        <>
                          <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                              placeholder="https://..."
                              value={webhookUrl}
                              onChange={(e) => setWebhookUrl(e.target.value)}
                            />
                          </div>
                          {forwardType === "WEBHOOK" && (
                            <div className="space-y-2">
                              <Label>Custom Headers (JSON, optional)</Label>
                              <Textarea
                                placeholder='{\"Authorization\": \"Bearer xxx\"}'
                                value={webhookHeaders}
                                onChange={(e) => setWebhookHeaders(e.target.value)}
                                rows={3}
                              />
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button className="flex-1" onClick={handleCreateForward}>
                          Create Rule
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setForwardOpen(false);
                            resetForwardForm();
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forwardsLoading ? (
                <div className="flex justify-center p-8">Loading…</div>
              ) : forwards.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No forward rules</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Last Triggered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forwards.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.mailbox?.address || "All mailboxes"}</TableCell>
                        <TableCell>
                          {r.lastTriggered ? format(new Date(r.lastTriggered), "PPpp") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleForward(r.id, r.status)}
                            >
                              {r.status === "ACTIVE" ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestForward(r.id)}
                              disabled={testingForwardId === r.id}
                            >
                              <TestTube className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteForward(r.id)}
                              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Workflows</span>
                <Button variant="outline" size="sm" onClick={fetchWorkflows}>
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workflowsLoading ? (
                <div className="flex justify-center p-8">Loading…</div>
              ) : workflows.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No workflows</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mailbox</TableHead>
                      <TableHead>Executions</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              w.status === "ACTIVE"
                                ? "default"
                                : w.status === "ERROR"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{w.mailbox?.address || "All mailboxes"}</TableCell>
                        <TableCell className="tabular-nums">{w._count.executions}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(w.updatedAt), "PPpp")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleWorkflow(w.id, w.status)}
                            >
                              {w.status === "ACTIVE" ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRenameWorkflow(w)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteWorkflow(w.id)}
                              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <Dialog open={renameWorkflowOpen} onOpenChange={setRenameWorkflowOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Rename Workflow</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Workflow Name</Label>
                      <Input
                        value={renameWorkflowName}
                        onChange={(e) => setRenameWorkflowName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" onClick={handleRenameWorkflow} disabled={renamingWorkflow}>
                        {renamingWorkflow ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRenameWorkflowOpen(false);
                          setRenameWorkflowId(null);
                          setRenameWorkflowName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
