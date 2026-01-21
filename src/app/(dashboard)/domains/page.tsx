"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Globe, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Domain {
  id: string;
  name: string;
  sourceType: "IMAP" | "WEBHOOK";
  status: string;
  description?: string;
  isPublic?: boolean;
  _count: { mailboxes: number };
}

export default function DomainsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const t = useTranslations("domains");
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"IMAP" | "WEBHOOK">("WEBHOOK");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Redirect non-admin users
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/inbox");
    }
  }, [status, isAdmin, router]);

  const fetchDomains = async () => {
    const res = await fetch("/api/domains");
    const data = await res.json();
    setDomains(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    const run = async () => {
      await fetchDomains();
    };
    run();
  }, [isAdmin]);

  const handleCreate = async () => {
    if (!isAdmin) {
      toast.error(t("toast.adminOnlyCreate"));
      return;
    }

    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sourceType, description, isPublic }),
    });

    if (res.ok) {
      toast.success(t("toast.created"));
      setOpen(false);
      setName("");
      setDescription("");
      setIsPublic(true);
      fetchDomains();
    } else {
      const data = await res.json();
      toast.error(data.error || t("toast.createFailed"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm(t("confirm.delete"))) return;

    const res = await fetch(`/api/domains/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("toast.deleted"));
      fetchDomains();
    } else {
      toast.error(t("toast.deleteFailed"));
    }
  };

  const getSourceTypeLabel = (value: Domain["sourceType"]) => {
    if (value === "IMAP") return t("sourceType.imap");
    return t("sourceType.webhook");
  };

  const getStatusLabel = (value: Domain["status"]) => {
    if (value === "ACTIVE") return t("status.active");
    if (value === "PENDING") return t("status.pending");
    if (value === "ERROR") return t("status.error");
    return value;
  };

  if (status === "loading" || loading || !isAdmin) {
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
            {isAdmin ? t("subtitle.admin") : t("subtitle.user")}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> {t("actions.addDomain")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialog.addTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{t("dialog.domainName.label")}</Label>
                  <Input
                    placeholder={t("dialog.domainName.placeholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("dialog.sourceType.label")}</Label>
                  <Select value={sourceType} onValueChange={(v) => setSourceType(v as "IMAP" | "WEBHOOK")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEBHOOK">{t("sourceType.webhook")}</SelectItem>
                      <SelectItem value="IMAP">{t("sourceType.imap")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("dialog.description.label")}</Label>
                  <Input
                    placeholder={t("dialog.description.placeholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label>{t("dialog.visibility.label")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("dialog.visibility.help")}
                    </p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  {t("actions.createDomain")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {domains.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {isAdmin ? t("empty.adminTitle") : t("empty.userTitle")}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {isAdmin
                ? t("empty.adminDescription")
                : t("empty.userDescription")}
            </p>
            {isAdmin && (
              <Button className="mt-6" onClick={() => setOpen(true)}>
                {t("actions.addFirstDomain")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain) => (
            <Card key={domain.id} className="border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">{domain.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Badge variant={domain.isPublic ? "default" : "secondary"}>
                      {domain.isPublic ? t("visibility.public") : t("visibility.private")}
                    </Badge>
                  )}
                  <Badge
                    className={
                      domain.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20"
                        : domain.status === "PENDING"
                        ? "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20"
                        : domain.status === "ERROR"
                        ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {getStatusLabel(domain.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("labels.source", { source: getSourceTypeLabel(domain.sourceType) })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("labels.mailboxes", { count: domain._count.mailboxes })}
                  </p>
                  {domain.description && (
                    <p className="text-sm">{domain.description}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    {isAdmin && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={`/domains/${domain.id}`}>
                            <Settings className="h-4 w-4 mr-1" /> {t("actions.configure")}
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(domain.id)}
                          className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
