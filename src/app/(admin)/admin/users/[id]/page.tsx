"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
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
  Trash2,
  Save,
  Eye,
  Workflow,
  Pencil,
  Power,
  PowerOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  authSources?: string[];
  userGroupId: string | null;
  maxStorageMb: number | null;
  maxStorageFiles: number | null;
  storageUsage?: { bytes: number; files: number };
  userGroup?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count: { mailboxes: number; domains: number; workflows: number; emails: number };
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

interface WorkflowItem {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ERROR";
  mailbox?: { id: string; address: string } | null;
  createdAt: string;
  updatedAt: string;
  _count: { executions: number; dispatchLogs: number };
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const t = useTranslations("admin");
  const formatAuthSource = (source: string) => {
    if (source === "password") return t("common.authSources.password");
    if (source === "github") return t("common.authSources.github");
    return source;
  };

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);

  // Profile form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserDetail["role"]>("USER");
  const [isActive, setIsActive] = useState(true);
  const [emailVerified, setEmailVerified] = useState<string>("");
  const [userGroupId, setUserGroupId] = useState<string>("");
  const [maxStorageMb, setMaxStorageMb] = useState<string>("");
  const [maxStorageFiles, setMaxStorageFiles] = useState<string>("");
  const [userGroups, setUserGroups] = useState<Array<{ id: string; name: string }>>([]);

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authWorking, setAuthWorking] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [passkeyCount, setPasskeyCount] = useState(0);

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

  // Workflows
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [renameWorkflowOpen, setRenameWorkflowOpen] = useState(false);
  const [renameWorkflowId, setRenameWorkflowId] = useState<string | null>(null);
  const [renameWorkflowName, setRenameWorkflowName] = useState("");
  const [renamingWorkflow, setRenamingWorkflow] = useState(false);

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
      toast.error(data.error || t("userDetail.toasts.loadUserFailed"));
      return;
    }

    const data: UserDetail = await res.json();
    setUser(data);
    setEmail(data.email);
    setName(data.name || "");
    setRole(data.role);
    setIsActive(data.isActive);
    setEmailVerified(data.emailVerified || "");
    setUserGroupId(data.userGroupId || "");
    setMaxStorageMb(data.maxStorageMb === null ? "" : String(data.maxStorageMb));
    setMaxStorageFiles(data.maxStorageFiles === null ? "" : String(data.maxStorageFiles));
  };

  const fetchUserGroups = async () => {
    const res = await fetch("/api/admin/usergroups");
    const data = await res.json().catch(() => []);
    if (!res.ok) {
      setUserGroups([]);
      return;
    }
    const rows = Array.isArray(data) ? (data as Array<{ id: string; name: string }>) : [];
    setUserGroups(rows.map((row) => ({ id: row.id, name: row.name })));
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
      await Promise.all([fetchUser(), fetchUserGroups(), fetchMailboxes(), fetchEmails(), fetchWorkflows(), fetchAuth()]);
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
    if ((userGroupId || null) !== (user.userGroupId || null)) {
      payload.userGroupId = userGroupId ? userGroupId : null;
    }
    const maxStorageMbInput = maxStorageMb.trim();
    if (!maxStorageMbInput) {
      if (user.maxStorageMb !== null) payload.maxStorageMb = null;
    } else {
      const parsedMaxStorageMb = Number(maxStorageMbInput);
      if (Number.isInteger(parsedMaxStorageMb) && parsedMaxStorageMb >= 0 && parsedMaxStorageMb !== user.maxStorageMb) {
        payload.maxStorageMb = parsedMaxStorageMb;
      }
    }

    const maxStorageFilesInput = maxStorageFiles.trim();
    if (!maxStorageFilesInput) {
      if (user.maxStorageFiles !== null) payload.maxStorageFiles = null;
    } else {
      const parsedMaxStorageFiles = Number(maxStorageFilesInput);
      if (Number.isInteger(parsedMaxStorageFiles) && parsedMaxStorageFiles >= 0 && parsedMaxStorageFiles !== user.maxStorageFiles) {
        payload.maxStorageFiles = parsedMaxStorageFiles;
      }
    }

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(t("userDetail.toasts.userUpdated"));
      await fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.updateUserFailed"));
    }

    setSavingProfile(false);
  };

  const handleVerifyEmail = async () => {
    if (!user) return;
    if (user.emailVerified) return;
    setVerifyingEmail(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailVerified: new Date().toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const nextEmailVerified =
          data && typeof data.emailVerified === "string" ? (data.emailVerified as string) : null;
        toast.success(t("userDetail.toasts.emailVerified"));
        setUser((prev) => (prev ? { ...prev, emailVerified: nextEmailVerified } : prev));
        setEmailVerified(nextEmailVerified || "");
      } else {
        toast.error(data.error || t("userDetail.toasts.verifyEmailFailed"));
      }
    } catch {
      toast.error(t("userDetail.toasts.verifyEmailFailed"));
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    if (!isSuperAdmin) return;
    if (id === session?.user?.id) {
      toast.error(t("userDetail.danger.cannotDeleteSelf"));
      return;
    }

    setDeletingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("userDetail.toasts.userDeleted"));
        setDeleteUserOpen(false);
        router.push("/admin/users");
      } else {
        toast.error(data.error || t("userDetail.toasts.deleteUserFailed"));
      }
    } catch {
      toast.error(t("userDetail.toasts.deleteUserFailed"));
    } finally {
      setDeletingUser(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      toast.error(t("userDetail.toasts.newPasswordRequired"));
      return;
    }

    setResettingPassword(true);
    const res = await fetch(`/api/admin/users/${id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });

    if (res.ok) {
      toast.success(t("userDetail.toasts.passwordReset"));
      setNewPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.resetPasswordFailed"));
    }
    setResettingPassword(false);
  };

  const fetchAuth = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/auth`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpEnabled(Boolean(data.otpEnabled));
        setPasskeyCount(Number(data.passkeyCount || 0));
      } else {
        toast.error(data.error || t("userDetail.toasts.loadAuthFailed"));
      }
    } catch {
      toast.error(t("userDetail.toasts.loadAuthFailed"));
    }
    setAuthLoading(false);
  };

  const handleDeleteOtp = async () => {
    if (!user) return;
    if (!confirm(t("userDetail.confirm.deleteOtp", { email: user.email }))) return;
    setAuthWorking(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/otp`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("userDetail.toasts.otpDeleted"));
        await fetchAuth();
      } else {
        toast.error(data.error || t("userDetail.toasts.deleteOtpFailed"));
      }
    } catch {
      toast.error(t("userDetail.toasts.deleteOtpFailed"));
    } finally {
      setAuthWorking(false);
    }
  };

  const handleDeletePasskeys = async () => {
    if (!user) return;
    if (!confirm(t("userDetail.confirm.deletePasskeys", { email: user.email }))) return;
    setAuthWorking(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/passkeys`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("userDetail.toasts.passkeysDeleted"));
        await fetchAuth();
      } else {
        toast.error(data.error || t("userDetail.toasts.deletePasskeysFailed"));
      }
    } catch {
      toast.error(t("userDetail.toasts.deletePasskeysFailed"));
    } finally {
      setAuthWorking(false);
    }
  };

  const handleToggleMailbox = async (mailboxId: string, status: Mailbox["status"]) => {
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/admin/mailboxes/${mailboxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      toast.success(t("userDetail.toasts.mailboxUpdated"));
      fetchMailboxes();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.updateMailboxFailed"));
    }
  };

  const handleDeleteMailbox = async (mailboxId: string) => {
    if (!confirm(t("userDetail.confirm.deleteMailbox"))) return;
    const res = await fetch(`/api/admin/mailboxes/${mailboxId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("userDetail.toasts.mailboxDeleted"));
      fetchMailboxes();
      fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.deleteMailboxFailed"));
    }
  };

  const handleViewEmail = async (emailId: string) => {
    const res = await fetch(`/api/admin/emails/${emailId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.loadEmailFailed"));
      return;
    }
    const data: EmailDetail = await res.json();
    setEmailDetail(data);
    setEmailDetailOpen(true);
  };

  const handleDeleteEmail = async (emailId: string) => {
    if (!confirm(t("userDetail.confirm.deleteEmail"))) return;
    const res = await fetch(`/api/admin/emails/${emailId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("userDetail.toasts.emailDeleted"));
      fetchEmails();
      fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.deleteEmailFailed"));
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
      toast.error(t("userDetail.toasts.workflowNameRequired"));
      return;
    }

    setRenamingWorkflow(true);
    const res = await fetch(`/api/admin/workflows/${renameWorkflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    if (res.ok) {
      toast.success(t("userDetail.toasts.workflowRenamed"));
      setRenameWorkflowOpen(false);
      setRenameWorkflowId(null);
      setRenameWorkflowName("");
      fetchWorkflows();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.renameWorkflowFailed"));
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
      toast.success(t("userDetail.toasts.workflowUpdated"));
      fetchWorkflows();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.updateWorkflowFailed"));
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm(t("userDetail.confirm.deleteWorkflow"))) return;
    const res = await fetch(`/api/admin/workflows/${workflowId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("userDetail.toasts.workflowDeleted"));
      fetchWorkflows();
      fetchUser();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || t("userDetail.toasts.deleteWorkflowFailed"));
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
            {t("common.back")}
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
                {user.isActive ? t("common.status.active") : t("common.status.inactive")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("userDetail.summary.created", { date: format(new Date(user.createdAt), "PP") })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Inbox className="h-3 w-3" /> {t("userDetail.summary.mailboxesCount", { count: user._count.mailboxes })}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <MailOpen className="h-3 w-3" /> {t("userDetail.summary.emailsCount", { count: user._count.emails })}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Workflow className="h-3 w-3" /> {t("userDetail.summary.workflowsCount", { count: user._count.workflows })}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" /> {t("userDetail.summary.domainsCount", { count: user._count.domains })}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            {t("userDetail.tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            {t("userDetail.tabs.security")}
          </TabsTrigger>
          <TabsTrigger value="mailboxes" className="gap-2">
            <Inbox className="h-4 w-4" />
            {t("userDetail.tabs.mailboxes")}
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            {t("userDetail.tabs.emails")}
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <Workflow className="h-4 w-4" />
            {t("userDetail.tabs.workflows")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>{t("userDetail.profile.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("userDetail.profile.authSource")}</Label>
                {!user.authSources || user.authSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">-</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {user.authSources.map((source) => (
                      <Badge key={source} variant="outline">
                        {formatAuthSource(source)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("common.table.email")}</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.table.name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>

	              <div className="grid gap-4 md:grid-cols-2">
	                <div className="space-y-2">
	                  <Label>{t("common.table.role")}</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as UserDetail["role"])}
                    disabled={!isSuperAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">{t("userDetail.profile.roles.user")}</SelectItem>
                      <SelectItem value="ADMIN">{t("userDetail.profile.roles.admin")}</SelectItem>
                      <SelectItem value="SUPER_ADMIN">{t("userDetail.profile.roles.superAdmin")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isSuperAdmin && (
                    <p className="text-xs text-muted-foreground">
                      {t("userDetail.profile.roleHelp")}
                    </p>
                  )}
	                </div>
	                <div className="space-y-2">
	                  <Label>{t("userDetail.profile.userGroup")}</Label>
	                  <Select
	                    value={userGroupId || "__none__"}
	                    onValueChange={(v) => setUserGroupId(v === "__none__" ? "" : v)}
	                  >
	                    <SelectTrigger>
	                      <SelectValue />
	                    </SelectTrigger>
	                    <SelectContent>
	                      <SelectItem value="__none__">{t("userDetail.profile.userGroupNone")}</SelectItem>
	                      {userGroups.map((g) => (
	                        <SelectItem key={g.id} value={g.id}>
	                          {g.name}
	                        </SelectItem>
	                      ))}
	                    </SelectContent>
	                  </Select>
	                </div>
	              </div>

	              <div className="space-y-2">
	                <Label>{t("userDetail.profile.emailVerified")}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="2026-01-16T00:00:00.000Z"
                      value={emailVerified}
                      onChange={(e) => setEmailVerified(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleVerifyEmail}
                      disabled={verifyingEmail || Boolean(user.emailVerified)}
                    >
                      {verifyingEmail ? t("userDetail.profile.verifyingEmail") : t("userDetail.profile.verifyEmail")}
                    </Button>
                  </div>
	              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("userDetail.profile.maxStorageMb")}</Label>
                  <Input
                    value={maxStorageMb}
                    onChange={(e) => setMaxStorageMb(e.target.value)}
                    placeholder={t("usergroups.placeholders.unlimited")}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("userDetail.profile.maxStorageFiles")}</Label>
                  <Input
                    value={maxStorageFiles}
                    onChange={(e) => setMaxStorageFiles(e.target.value)}
                    placeholder={t("usergroups.placeholders.unlimited")}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t("userDetail.profile.storageBytes")}</Label>
                  <p className="text-sm text-muted-foreground">{user.storageUsage?.bytes || 0}</p>
                </div>
                <div className="space-y-1">
                  <Label>{t("userDetail.profile.storageFiles")}</Label>
                  <p className="text-sm text-muted-foreground">{user.storageUsage?.files || 0}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("userDetail.profile.active")}</Label>
                  <p className="text-sm text-muted-foreground">{t("userDetail.profile.activeHelp")}</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingProfile ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">{t("userDetail.danger.title")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t("userDetail.danger.deleteUser")}</div>
                  <div className="text-sm text-muted-foreground">{t("userDetail.danger.deleteUserHelp")}</div>
                </div>
                <AlertDialog
                  open={deleteUserOpen}
                  onOpenChange={(open) => {
                    if (deletingUser) return;
                    setDeleteUserOpen(open);
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={deletingUser || id === session?.user?.id}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("userDetail.danger.deleteUser")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("userDetail.danger.deleteUser")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("userDetail.confirm.deleteUser", { email: user.email })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deletingUser}>{t("common.cancel")}</AlertDialogCancel>
                      <Button variant="destructive" onClick={handleDeleteUser} disabled={deletingUser}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deletingUser ? t("userDetail.danger.deleting") : t("userDetail.danger.deleteUser")}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>{t("userDetail.security.resetPassword.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("userDetail.security.resetPassword.newPassword")}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleResetPassword} disabled={resettingPassword}>
                <Lock className="h-4 w-4 mr-2" />
                {resettingPassword ? t("userDetail.security.resetPassword.resetting") : t("userDetail.security.resetPassword.action")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("userDetail.security.resetPassword.note")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>{t("userDetail.security.otpPasskeys.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {authLoading ? (
                  t("common.loading")
                ) : (
                  <>
                    <p>{t("userDetail.security.authStatus.otpEnabled", { value: otpEnabled ? t("common.yes") : t("common.no") })}</p>
                    <p>{t("userDetail.security.authStatus.passkeys", { count: passkeyCount })}</p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteOtp}
                  disabled={authWorking || authLoading || (user?.role !== "USER" && !isSuperAdmin)}
                >
                  {t("userDetail.security.actions.deleteOtp")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeletePasskeys}
                  disabled={authWorking || authLoading || passkeyCount === 0 || (user?.role !== "USER" && !isSuperAdmin)}
                >
                  {t("userDetail.security.actions.deletePasskeys")}
                </Button>
                <Button variant="outline" onClick={fetchAuth} disabled={authWorking || authLoading}>
                  {t("common.reload")}
                </Button>
              </div>
              {!isSuperAdmin && user?.role !== "USER" && (
                <p className="text-xs text-muted-foreground">
                  {t("userDetail.security.adminAuthHelp")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mailboxes" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t("userDetail.tabs.mailboxes")}</span>
                <Input
                  className="max-w-xs"
                  placeholder={t("common.searchPlaceholder")}
                  value={mailboxSearch}
                  onChange={(e) => setMailboxSearch(e.target.value)}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mailboxesLoading ? (
                <div className="flex justify-center p-8">{t("common.loading")}</div>
              ) : mailboxes.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">{t("userDetail.mailboxes.empty")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.table.address")}</TableHead>
                      <TableHead>{t("common.table.status")}</TableHead>
                      <TableHead>{t("common.table.emails")}</TableHead>
                      <TableHead>{t("common.table.expires")}</TableHead>
                      <TableHead>{t("common.table.created")}</TableHead>
                      <TableHead className="text-right">{t("common.table.actions")}</TableHead>
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
                              aria-label={
                                m.status === "ACTIVE"
                                  ? t("userDetail.mailboxes.actions.deactivate")
                                  : t("userDetail.mailboxes.actions.activate")
                              }
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
                              aria-label={t("common.delete")}
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
                <span>{t("userDetail.tabs.emails")}</span>
                <Input
                  className="max-w-xs"
                  placeholder={t("common.searchPlaceholder")}
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emailsLoading ? (
                <div className="flex justify-center p-8">{t("common.loading")}</div>
              ) : emails.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">{t("userDetail.emails.empty")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.table.subject")}</TableHead>
                      <TableHead>{t("common.table.from")}</TableHead>
                      <TableHead>{t("common.table.mailbox")}</TableHead>
                      <TableHead>{t("common.table.status")}</TableHead>
                      <TableHead>{t("common.table.received")}</TableHead>
                      <TableHead className="text-right">{t("common.table.actions")}</TableHead>
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
                              aria-label={t("common.view")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteEmail(e.id)}
                              aria-label={t("common.delete")}
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
                <DialogTitle>{t("userDetail.emails.detail.title")}</DialogTitle>
              </DialogHeader>
              {!emailDetail ? (
                <div className="p-6 text-muted-foreground">{t("common.loading")}</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("common.table.subject")}</p>
                      <p className="font-medium">{emailDetail.subject}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("common.table.received")}</p>
                      <p className="font-medium">
                        {format(new Date(emailDetail.receivedAt), "PPpp")}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("common.table.from")}</p>
                      <p className="font-medium">{emailDetail.fromAddress}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("common.table.to")}</p>
                      <p className="font-medium">{emailDetail.toAddress}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("userDetail.emails.detail.sections.text")}</Label>
                      <Textarea
                        value={emailDetail.textBody || ""}
                        readOnly
                        rows={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("userDetail.emails.detail.sections.html")}</Label>
                      <Textarea
                        value={emailDetail.htmlBody || ""}
                        readOnly
                        rows={10}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("userDetail.emails.detail.sections.headers")}</Label>
                      <div className="max-h-48 overflow-auto border rounded-md p-3 text-sm font-mono">
                        {emailDetail.headers.length === 0
                          ? t("common.none")
                          : emailDetail.headers
                              .map((h) => `${h.name}: ${h.value}`)
                              .join("\\n")}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("userDetail.emails.detail.sections.attachments")}</Label>
                      <div className="max-h-48 overflow-auto border rounded-md p-3 text-sm">
                        {emailDetail.attachments.length === 0 ? (
                          t("common.none")
                        ) : (
                          <ul className="space-y-1">
                            {emailDetail.attachments.map((a) => (
                              <li key={a.id}>
                                {t("userDetail.emails.detail.attachmentMeta", {
                                  filename: a.filename,
                                  contentType: a.contentType,
                                  size: a.size,
                                })}
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

        <TabsContent value="workflows" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t("userDetail.tabs.workflows")}</span>
                <Button variant="outline" size="sm" onClick={fetchWorkflows}>
                  {t("common.refresh")}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workflowsLoading ? (
                <div className="flex justify-center p-8">{t("common.loading")}</div>
              ) : workflows.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">{t("userDetail.workflows.empty")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.table.name")}</TableHead>
                      <TableHead>{t("common.table.status")}</TableHead>
                      <TableHead>{t("common.table.mailbox")}</TableHead>
                      <TableHead>{t("common.table.executions")}</TableHead>
                      <TableHead>{t("common.table.updated")}</TableHead>
                      <TableHead className="text-right">{t("common.table.actions")}</TableHead>
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
                        <TableCell>{w.mailbox?.address || t("userDetail.workflows.allMailboxes")}</TableCell>
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
                              aria-label={
                                w.status === "ACTIVE"
                                  ? t("userDetail.workflows.actions.deactivate")
                                  : t("userDetail.workflows.actions.activate")
                              }
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
                              aria-label={t("userDetail.workflows.actions.rename")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteWorkflow(w.id)}
                              aria-label={t("common.delete")}
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
                    <DialogTitle>{t("userDetail.workflows.renameDialog.title")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>{t("userDetail.workflows.renameDialog.nameLabel")}</Label>
                      <Input
                        value={renameWorkflowName}
                        onChange={(e) => setRenameWorkflowName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1" onClick={handleRenameWorkflow} disabled={renamingWorkflow}>
                        {renamingWorkflow ? t("common.saving") : t("common.save")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRenameWorkflowOpen(false);
                          setRenameWorkflowId(null);
                          setRenameWorkflowName("");
                        }}
                      >
                        {t("common.cancel")}
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
