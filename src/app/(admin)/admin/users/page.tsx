"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
 import { Users } from "lucide-react";
 import { format } from "date-fns";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { mailboxes: number; domains: number };
}

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-8">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("users.title")}</h1>
        <p className="text-muted-foreground">{t("users.subtitle")}</p>
      </div>

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
                <TableHead>{t("common.table.email")}</TableHead>
                <TableHead>{t("common.table.name")}</TableHead>
                <TableHead>{t("common.table.role")}</TableHead>
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
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.name || "-"}</TableCell>
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
