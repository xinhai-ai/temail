"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Plus, Globe, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";

interface Domain {
  id: string;
  name: string;
  sourceType: "IMAP" | "WEBHOOK";
  status: string;
  description?: string;
  _count: { mailboxes: number };
}

export default function DomainsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"IMAP" | "WEBHOOK">("WEBHOOK");
  const [description, setDescription] = useState("");

  const fetchDomains = async () => {
    const res = await fetch("/api/domains");
    const data = await res.json();
    setDomains(data);
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await fetchDomains();
    };
    run();
  }, []);

  const handleCreate = async () => {
    if (!isAdmin) {
      toast.error("Only admins can create domains");
      return;
    }

    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sourceType, description }),
    });

    if (res.ok) {
      toast.success("Domain created successfully");
      setOpen(false);
      setName("");
      setDescription("");
      fetchDomains();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to create domain");
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this domain?")) return;

    const res = await fetch(`/api/domains/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Domain deleted");
      fetchDomains();
    } else {
      toast.error("Failed to delete domain");
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
          <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Manage inbound domains" : "Available inbound domains"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Domain</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Domain Name</Label>
                  <Input
                    placeholder="example.com"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <Select value={sourceType} onValueChange={(v) => setSourceType(v as "IMAP" | "WEBHOOK")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEBHOOK">Webhook</SelectItem>
                      <SelectItem value="IMAP">IMAP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Create Domain
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
              {isAdmin ? "No domains configured yet" : "No domains available"}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {isAdmin
                ? "Add a domain to start receiving emails"
                : "Ask an administrator to enable a domain"}
            </p>
            {isAdmin && (
              <Button className="mt-6" onClick={() => setOpen(true)}>
                Add Your First Domain
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
                  {domain.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Source: {domain.sourceType}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Mailboxes: {domain._count.mailboxes}
                  </p>
                  {domain.description && (
                    <p className="text-sm">{domain.description}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    {isAdmin && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={`/domains/${domain.id}`}>
                            <Settings className="h-4 w-4 mr-1" /> Configure
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
