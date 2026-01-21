"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InboundEmailActions({ id }: { id: string }) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm(t("inbound.actions.deleteConfirm"))) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/inbound/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("inbound.actions.deleteFailed"));
        return;
      }
      toast.success(t("inbound.actions.deleted"));
      router.refresh();
    } catch {
      toast.error(t("inbound.actions.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/inbound/${id}`}>{t("common.view")}</Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={deleting}
        onClick={handleDelete}
        aria-label={t("common.delete")}
        className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
