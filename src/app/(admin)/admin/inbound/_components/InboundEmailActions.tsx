"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InboundEmailActions({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm("Delete this inbound email permanently? This cannot be undone.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/inbound/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Failed to delete");
        return;
      }
      toast.success("Deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/inbound/${id}`}>View</Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={deleting}
        onClick={handleDelete}
        className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

