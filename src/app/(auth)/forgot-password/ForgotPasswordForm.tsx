"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail } from "lucide-react";

type TurnstileConfig = {
  enabled: boolean;
  bypass: boolean;
  siteKey: string | null;
  misconfigured: boolean;
};

export default function ForgotPasswordForm({
  turnstile,
  enabled,
}: {
  turnstile: TurnstileConfig;
  enabled: boolean;
}) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  const turnstileRequired = Boolean(turnstile.enabled && turnstile.siteKey);
  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const canResend = done && resendAvailableAt !== null && resendCooldownSeconds === 0;

  useEffect(() => {
    if (!done) return;
    if (!resendAvailableAt) {
      setResendCooldownSeconds(0);
      return;
    }

    const update = () => {
      const next = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setResendCooldownSeconds(next);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [done, resendAvailableAt]);

  const sendResetEmail = useCallback(async () => {
    setError("");

    if (!enabled) {
      setError(t("forgotPasswordPage.disabledDescription"));
      return;
    }

    if (turnstileRequired && !turnstileToken) {
      setError(t("errors.turnstileRequired"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          turnstileToken: turnstileRequired ? turnstileToken : undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        const message = data?.error || t("forgotPasswordPage.failed");
        setError(message);
        if (turnstileRequired && typeof message === "string" && message.toLowerCase().includes("turnstile")) {
          setTurnstileToken(null);
          setTurnstileReset((prev) => prev + 1);
        }
        return;
      }

      setDone(true);
      setResendAvailableAt(Date.now() + 60_000);
      setResendCooldownSeconds(60);
      setTurnstileToken(null);
      setTurnstileReset((prev) => prev + 1);
    } catch {
      setError(t("forgotPasswordPage.failed"));
    } finally {
      setLoading(false);
    }
  }, [email, enabled, t, turnstileRequired, turnstileToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetEmail();
  };

  const handleResend = async () => {
    if (!canResend) return;
    await sendResetEmail();
  };

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        </div>
        <Card className="w-full max-w-md relative z-10 border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center tracking-tight">
              {t("forgotPasswordPage.disabledTitle")}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {t("forgotPasswordPage.disabledDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent />
          <CardFooter className="flex flex-col space-y-3 pt-2">
            <Button asChild className="w-full h-11 font-medium">
              <Link href="/login">{t("forgotPasswordPage.backToLogin")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
              <Mail className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight">
            {t("forgotPasswordPage.title")}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {t("forgotPasswordPage.description")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}
            {done ? (
              <>
                <div className="p-3 text-sm text-green-700 bg-green-500/10 rounded-lg border border-green-500/20">
                  {t("forgotPasswordPage.emailSent")}
                </div>

                {turnstileRequired && (
                  <div className="space-y-2">
                    <TurnstileWidget
                      siteKey={turnstile.siteKey as string}
                      onToken={handleTurnstileToken}
                      resetKey={turnstileReset}
                      className="flex justify-center"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t("turnstile.protected")}
                    </p>
                  </div>
                )}
                {!turnstileRequired && turnstile.bypass && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("turnstile.bypassEnabled")}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("placeholders.email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    required
                    disabled={loading}
                  />
                </div>

                {turnstileRequired && (
                  <div className="space-y-2">
                    <TurnstileWidget
                      siteKey={turnstile.siteKey as string}
                      onToken={handleTurnstileToken}
                      resetKey={turnstileReset}
                      className="flex justify-center"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t("turnstile.protected")}
                    </p>
                  </div>
                )}
                {!turnstileRequired && turnstile.bypass && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("turnstile.bypassEnabled")}
                  </p>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 pt-2">
            {done ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full h-11 font-medium"
                onClick={handleResend}
                disabled={loading || !canResend}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resendCooldownSeconds > 0
                  ? t("forgotPasswordPage.resendIn", { seconds: resendCooldownSeconds })
                  : t("forgotPasswordPage.resend")}
              </Button>
            ) : (
              <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? t("forgotPasswordPage.sending") : t("forgotPasswordPage.action")}
              </Button>
            )}
            <Button asChild variant="outline" className="w-full h-11 font-medium">
              <Link href="/login">{t("forgotPasswordPage.backToLogin")}</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
