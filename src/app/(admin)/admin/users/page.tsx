"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

type StatusFilter = "all" | "active" | "inactive";
type RegistrationEventFilter = "all" | "today" | "last7d" | "last30d";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  authSources?: string[];
  isActive: boolean;
  userGroupId: string | null;
  userGroup?: { id: string; name: string } | null;
  createdAt: string;
  _count: { mailboxes: number; domains: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Facets {
  userGroups: Array<{ id: string; name: string }>;
  authSources: string[];
}

interface QueryState {
  page: number;
  limit: number;
  name: string;
  email: string;
  userGroupId: string;
  status: StatusFilter;
  registrationEvent: RegistrationEventFilter;
  authSource: string;
}

const DEFAULT_LIMIT = 50;

function parseStatus(value: string | null): StatusFilter {
  if (value === "active" || value === "inactive") return value;
  return "all";
}

function parseRegistrationEvent(value: string | null): RegistrationEventFilter {
  if (value === "today" || value === "last7d" || value === "last30d") return value;
  return "all";
}

function buildParams(state: QueryState) {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("limit", String(state.limit));
  if (state.name) params.set("name", state.name);
  if (state.email) params.set("email", state.email);
  if (state.userGroupId) params.set("userGroupId", state.userGroupId);
  if (state.status !== "all") params.set("status", state.status);
  if (state.registrationEvent !== "all") params.set("registrationEvent", state.registrationEvent);
  if (state.authSource) params.set("authSource", state.authSource);
  return params;
}

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const router = useRouter();
  const searchParams = useSearchParams();

  const formatAuthSource = (source: string) => {
    if (source === "password") return t("common.authSources.password");
    if (source === "github") return t("common.authSources.github");
    if (source === "linuxdo") return t("common.authSources.linuxdo");
    return source;
  };

  const query = useMemo<QueryState>(() => {
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10)));
    return {
      page,
      limit,
      name: searchParams.get("name") || "",
      email: searchParams.get("email") || "",
      userGroupId: searchParams.get("userGroupId") || "",
      status: parseStatus(searchParams.get("status")),
      registrationEvent: parseRegistrationEvent(searchParams.get("registrationEvent")),
      authSource: searchParams.get("authSource") || "",
    };
  }, [searchParams]);

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: DEFAULT_LIMIT, total: 0, pages: 1 });
  const [facets, setFacets] = useState<Facets>({ userGroups: [], authSources: [] });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [statusInput, setStatusInput] = useState<StatusFilter>("all");
  const [registrationEventInput, setRegistrationEventInput] = useState<RegistrationEventFilter>("all");
  const [authSourceInput, setAuthSourceInput] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string>("__none__");

  useEffect(() => {
    setNameInput(query.name);
    setEmailInput(query.email);
    setGroupInput(query.userGroupId);
    setStatusInput(query.status);
    setRegistrationEventInput(query.registrationEvent);
    setAuthSourceInput(query.authSource);
  }, [query.authSource, query.email, query.name, query.registrationEvent, query.status, query.userGroupId]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);

      const params = buildParams(query);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setUsers([]);
        setPagination({ page: query.page, limit: query.limit, total: 0, pages: 1 });
        setFacets({ userGroups: [], authSources: [] });
        toast.error(data.error || t("common.unknownError"));
      } else {
        setUsers(Array.isArray(data.users) ? data.users : []);
        setPagination(
          data.pagination || {
            page: query.page,
            limit: query.limit,
            total: 0,
            pages: 1,
          }
        );
        setFacets({
          userGroups: Array.isArray(data.facets?.userGroups) ? data.facets.userGroups : [],
          authSources: Array.isArray(data.facets?.authSources) ? data.facets.authSources : [],
        });
      }

      setSelectedIds([]);
      setLoading(false);
    };

    fetchUsers();
  }, [query, reloadKey, t]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allChecked = users.length > 0 && users.every((user) => selectedSet.has(user.id));

  const updateQuery = (next: Partial<QueryState>, resetPage = false) => {
    const merged: QueryState = {
      ...query,
      ...next,
      page: resetPage ? 1 : next.page ?? query.page,
    };
    const params = buildParams(merged);
    router.replace(`/admin/users?${params.toString()}`, { scroll: false });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery(
      {
        name: nameInput.trim(),
        email: emailInput.trim(),
        userGroupId: groupInput,
        status: statusInput,
        registrationEvent: registrationEventInput,
        authSource: authSourceInput,
      },
      true
    );
  };

  const handleClear = () => {
    setNameInput("");
    setEmailInput("");
    setGroupInput("");
    setStatusInput("all");
    setRegistrationEventInput("all");
    setAuthSourceInput("");
    router.replace(`/admin/users?page=1&limit=${DEFAULT_LIMIT}`, { scroll: false });
  };

  const handleToggleAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedIds(users.map((user) => user.id));
      return;
    }
    setSelectedIds([]);
  };

  const handleToggleOne = (id: string, checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const performBulk = async (action: "activate" | "deactivate" | "assignGroup") => {
    if (selectedIds.length === 0) return;

    const payload: {
      action: "activate" | "deactivate" | "assignGroup";
      ids: string[];
      userGroupId?: string | null;
    } = {
      action,
      ids: selectedIds,
    };

    if (action === "assignGroup") {
      payload.userGroupId = bulkGroupId === "__none__" ? null : bulkGroupId;
    }

    setBulkWorking(true);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || t("common.unknownError"));
        return;
      }

      const processedCount = typeof data.processedCount === "number" ? data.processedCount : 0;
      const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;
      const notFoundCount = Array.isArray(data.notFoundIds) ? data.notFoundIds.length : 0;

      toast.success(t("users.bulk.toasts.done", { count: processedCount }));
      if (skippedCount > 0 || notFoundCount > 0) {
        toast.error(
          t("users.bulk.toasts.partial", {
            skipped: skippedCount,
            notFound: notFoundCount,
          })
        );
      }

      setReloadKey((prev) => prev + 1);
    } catch {
      toast.error(t("common.unknownError"));
    } finally {
      setBulkWorking(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("users.title")}</h1>
        <p className="text-muted-foreground">{t("users.subtitle")}</p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            placeholder={t("users.filters.namePlaceholder")}
          />
          <Input
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder={t("users.filters.emailPlaceholder")}
          />

          <Select value={groupInput || "__all__"} onValueChange={(value) => setGroupInput(value === "__all__" ? "" : value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("users.filters.group")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("users.filters.groupAll")}</SelectItem>
              <SelectItem value="__none__">{t("users.filters.groupNone")}</SelectItem>
              {facets.userGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusInput} onValueChange={(value) => setStatusInput(value as StatusFilter)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("users.filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("users.filters.statusAll")}</SelectItem>
              <SelectItem value="active">{t("common.status.active")}</SelectItem>
              <SelectItem value="inactive">{t("common.status.inactive")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={registrationEventInput} onValueChange={(value) => setRegistrationEventInput(value as RegistrationEventFilter)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("users.filters.registrationEvent")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("users.filters.registrationEventAll")}</SelectItem>
              <SelectItem value="today">{t("users.filters.registrationEventToday")}</SelectItem>
              <SelectItem value="last7d">{t("users.filters.registrationEventLast7d")}</SelectItem>
              <SelectItem value="last30d">{t("users.filters.registrationEventLast30d")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={authSourceInput || "__all__"} onValueChange={(value) => setAuthSourceInput(value === "__all__" ? "" : value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("users.filters.authSource")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("users.filters.authSourceAll")}</SelectItem>
              {facets.authSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {formatAuthSource(source)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 md:col-span-2 xl:col-span-3">
            <Button type="submit">{t("common.search")}</Button>
            <Button type="button" variant="ghost" onClick={handleClear}>
              {t("common.clear")}
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.pagination", {
            page: pagination.page,
            pages: pagination.pages,
            total: pagination.total,
          })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() => updateQuery({ page: pagination.page - 1 })}
          >
            {t("common.prev")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pagination.page >= pagination.pages}
            onClick={() => updateQuery({ page: pagination.page + 1 })}
          >
            {t("common.next")}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("users.bulk.selected", { count: selectedIds.length })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0 || bulkWorking}
              onClick={() => performBulk("activate")}
            >
              {t("users.bulk.activate")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0 || bulkWorking}
              onClick={() => performBulk("deactivate")}
            >
              {t("users.bulk.deactivate")}
            </Button>

            <Select value={bulkGroupId} onValueChange={setBulkGroupId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("users.bulk.assignGroup")}/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("users.filters.groupNone")}</SelectItem>
                {facets.userGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0 || bulkWorking}
              onClick={() => performBulk("assignGroup")}
            >
              {t("users.bulk.applyGroup")}
            </Button>
          </div>
        </div>
      </Card>

      {users.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("users.empty")}</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={allChecked} onCheckedChange={handleToggleAll} />
                </TableHead>
                <TableHead>{t("common.table.email")}</TableHead>
                <TableHead>{t("common.table.name")}</TableHead>
                <TableHead>{t("users.table.group")}</TableHead>
                <TableHead>{t("common.table.role")}</TableHead>
                <TableHead>{t("common.table.authSource")}</TableHead>
                <TableHead>{t("common.table.status")}</TableHead>
                <TableHead>{t("common.table.mailboxes")}</TableHead>
                <TableHead>{t("common.table.domains")}</TableHead>
                <TableHead>{t("common.table.created")}</TableHead>
                <TableHead className="text-right">{t("common.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedSet.has(user.id)}
                      onCheckedChange={(checked) => handleToggleOne(user.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.name || "-"}</TableCell>
                  <TableCell>{user.userGroup?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === "SUPER_ADMIN"
                          ? "destructive"
                          : user.role === "ADMIN"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!user.authSources || user.authSources.length === 0 ? (
                      <span className="text-sm text-muted-foreground">-</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.authSources.map((source) => (
                          <Badge key={source} variant="outline">
                            {formatAuthSource(source)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? t("common.status.active") : t("common.status.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>{user._count.mailboxes}</TableCell>
                  <TableCell>{user._count.domains}</TableCell>
                  <TableCell>
                    {format(new Date(user.createdAt), "PP")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/users/${user.id}`}>{t("common.manage")}</Link>
                    </Button>
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
