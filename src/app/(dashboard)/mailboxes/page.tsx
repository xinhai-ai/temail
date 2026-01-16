"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Inbox, Trash2, Star, Copy, Search } from "lucide-react";
import { toast } from "sonner";

interface Domain {
  id: string;
  name: string;
}

interface Mailbox {
  id: string;
  address: string;
  prefix: string;
  note?: string;
  isStarred: boolean;
  status: string;
  domain: { name: string };
  _count: { emails: number };
  createdAt: string;
}

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [prefix, setPrefix] = useState("");
  const [domainId, setDomainId] = useState("");
  const [note, setNote] = useState("");

  const fetchData = async () => {
    const [mailboxRes, domainRes] = await Promise.all([
      fetch(`/api/mailboxes?search=${search}`),
      fetch("/api/domains"),
    ]);
    const [mailboxData, domainData] = await Promise.all([
      mailboxRes.json(),
      domainRes.json(),
    ]);
    setMailboxes(mailboxData);
    setDomains(domainData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const handleCreate = async () => {
    if (!prefix || !domainId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const res = await fetch("/api/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, domainId, note }),
    });

    if (res.ok) {
      toast.success("Mailbox created successfully");
      setOpen(false);
      setPrefix("");
      setNote("");
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to create mailbox");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    const res = await fetch(`/api/mailboxes/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Mailbox deleted");
      fetchData();
    }
  };

  const handleStar = async (id: string, isStarred: boolean) => {
    await fetch(`/api/mailboxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !isStarred }),
    });
    fetchData();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const generateRandom = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPrefix(result);
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
          <h1 className="text-3xl font-bold tracking-tight">Mailboxes</h1>
          <p className="text-muted-foreground mt-1">Manage your email addresses</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Mailbox
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Mailbox</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Domain</Label>
                <Select value={domainId} onValueChange={setDomainId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prefix</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="username"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  />
                  <Button variant="outline" onClick={generateRandom}>
                    Random
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note (Optional)</Label>
                <Input
                  placeholder="Add a note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                Create Mailbox
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search mailboxes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
          />
        </div>
      </div>

      {mailboxes.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No mailboxes yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Create your first mailbox to get started</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Emails</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStar(m.id, m.isStarred)}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          m.isStarred ? "fill-yellow-400 text-yellow-400" : ""
                        }`}
                      />
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{m.address}</TableCell>
                  <TableCell>{m._count.emails}</TableCell>
                  <TableCell>{m.note || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={m.status === "ACTIVE" ? "default" : "secondary"}
                      className={m.status === "ACTIVE" ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20" : ""}
                    >
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(m.address)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(m.id)}
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
