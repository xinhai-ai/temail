"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminRefreshButton() {
  const router = useRouter();
  const t = useTranslations("admin");

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
      <RefreshCw className="h-4 w-4" />
      {t("common.refresh")}
    </Button>
  );
}
