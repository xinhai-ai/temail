"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type ConfirmEmailChangeResponse =
  | { ok: true }
  | { error: string };

export default function ConfirmEmailChangeClient({ token }: { token: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const trimmedToken = (token || "").trim();
  const [status, setStatus] = useState<"idle" | "confirming" | "success" | "error">(trimmedToken ? "idle" : "error");
  const [errorKey, setErrorKey] = useState<
    "missing_token" | "invalid_or_expired" | "email_in_use" | "failed" | null
  >(trimmedToken ? null : "missing_token");

  useEffect(() => {
    if (!trimmedToken) return;

    const run = async () => {
      setStatus("confirming");
      setErrorKey(null);

      let res: Response;
      try {
        res = await fetch("/api/users/email-change/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmedToken }),
        });
      } catch {
        setStatus("error");
        setErrorKey("failed");
        return;
      }

      const data = (await res.json().catch(() => null)) as ConfirmEmailChangeResponse | null;
      if (!res.ok) {
        const message = (data as { error?: string } | null)?.error || "";
        if (message.toLowerCase().includes("missing")) {
          setStatus("error");
          setErrorKey("missing_token");
          return;
        }
        if (message.toLowerCase().includes("invalid") || message.toLowerCase().includes("expired")) {
          setStatus("error");
          setErrorKey("invalid_or_expired");
          return;
        }
        if (message.toLowerCase().includes("already") && message.toLowerCase().includes("use")) {
          setStatus("error");
          setErrorKey("email_in_use");
          return;
        }
        setStatus("error");
        setErrorKey("failed");
        return;
      }

      setStatus("success");
      router.push("/settings");
      router.refresh();
    };

    const id = setTimeout(() => {
      run().catch(() => {
        setStatus("error");
        setErrorKey("failed");
      });
    }, 0);
    return () => clearTimeout(id);
  }, [router, trimmedToken]);

  const isError = status === "error";
  const isSuccess = status === "success";
  const title = isSuccess
    ? t("emailChangePage.successTitle")
    : isError
    ? t("emailChangePage.errorTitle")
    : t("emailChangePage.title");

  const description = isSuccess
    ? t("emailChangePage.redirecting")
    : isError
    ? errorKey === "missing_token"
      ? t("emailChangePage.missingToken")
      : errorKey === "invalid_or_expired"
      ? t("emailChangePage.invalidOrExpired")
      : errorKey === "email_in_use"
      ? t("emailChangePage.emailInUse")
      : t("emailChangePage.failed")
    : t("emailChangePage.confirming");

  const icon =
    isError ? (
      <XCircle className="w-6 h-6 text-destructive" />
    ) : isSuccess ? (
      <CheckCircle2 className="w-6 h-6 text-green-600" />
    ) : (
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-md relative z-10 border-border/50 shadow-xl">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight">{title}</CardTitle>
          <CardDescription className="text-center text-muted-foreground">{description}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex flex-col space-y-3 pt-2">
          {isError && (
            <Button asChild className="w-full h-11 font-medium">
              <Link href="/settings">{t("emailChangePage.goToSettings")}</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

