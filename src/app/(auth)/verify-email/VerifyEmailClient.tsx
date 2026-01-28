"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailCheck, XCircle } from "lucide-react";

type VerifyEmailResponse =
  | { ok: true; loginToken: string | null }
  | { error: string };

export default function VerifyEmailClient({ token }: { token: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const trimmedToken = (token || "").trim();
  const [status, setStatus] = useState<
    "idle" | "verifying" | "signing_in" | "success" | "success_no_login" | "error"
  >(trimmedToken ? "idle" : "error");
  const [errorKey, setErrorKey] = useState<"missing_token" | "invalid_or_expired" | "failed" | null>(
    trimmedToken ? null : "missing_token"
  );

  useEffect(() => {
    if (!trimmedToken) return;

    const run = async () => {
      setStatus("verifying");
      setErrorKey(null);

      let res: Response;
      try {
        res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmedToken }),
        });
      } catch {
        setStatus("error");
        setErrorKey("failed");
        return;
      }

      const data = (await res.json().catch(() => null)) as VerifyEmailResponse | null;
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
        setStatus("error");
        setErrorKey("failed");
        return;
      }

      const loginToken = (data as { loginToken?: string | null } | null)?.loginToken;
      if (!loginToken) {
        setStatus("success_no_login");
        return;
      }

      setStatus("signing_in");
      const result = await signIn("credentials", { loginToken, redirect: false });
      if (result?.error) {
        setStatus("success_no_login");
        return;
      }

      setStatus("success");
      router.push("/dashboard");
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
  const isSuccess = status === "success" || status === "success_no_login";
  const title = isSuccess
    ? t("verifyEmailPage.successTitle")
    : isError
    ? t("verifyEmailPage.errorTitle")
    : t("verifyEmailPage.title");

  const description = isSuccess
    ? status === "success"
      ? t("verifyEmailPage.redirecting")
      : t("verifyEmailPage.successDescription")
    : isError
    ? errorKey === "missing_token"
      ? t("verifyEmailPage.missingToken")
      : errorKey === "invalid_or_expired"
      ? t("verifyEmailPage.invalidOrExpired")
      : t("verifyEmailPage.failed")
    : status === "signing_in"
    ? t("verifyEmailPage.signingIn")
    : t("verifyEmailPage.verifying");

  const icon =
    isError ? (
      <XCircle className="w-6 h-6 text-destructive" />
    ) : isSuccess ? (
      <MailCheck className="w-6 h-6 text-green-600" />
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
          {status === "success_no_login" && (
            <Button asChild className="w-full h-11 font-medium">
              <Link href="/login">{t("verifyEmailPage.goToLogin")}</Link>
            </Button>
          )}
          {isError && (
            <Button asChild className="w-full h-11 font-medium">
              <Link href="/login">{t("verifyEmailPage.goToLogin")}</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
