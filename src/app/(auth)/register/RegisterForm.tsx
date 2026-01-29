"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, KeyRound, Lock, Mail, User, Loader2, MailCheck } from "lucide-react";
import type { RegistrationMode } from "@/lib/registration";

type TurnstileConfig = {
  enabled: boolean;
  bypass: boolean;
  siteKey: string | null;
  misconfigured: boolean;
};

export default function RegisterForm({
  mode,
  turnstile,
  githubRegistrationEnabled = false,
  emailRegistrationEnabled = true,
}: {
  mode: RegistrationMode;
  turnstile: TurnstileConfig;
  githubRegistrationEnabled?: boolean;
  emailRegistrationEnabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [done, setDone] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTurnstileToken, setResendTurnstileToken] = useState<string | null>(null);
  const [resendTurnstileReset, setResendTurnstileReset] = useState(0);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);

  const turnstileRequired = Boolean(turnstile.enabled && turnstile.siteKey);
  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleResendTurnstileToken = useCallback((token: string | null) => {
    setResendTurnstileToken(token);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "invite" && !inviteCode.trim()) {
      setError(t("errors.inviteCodeRequired"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("errors.passwordsDoNotMatch"));
      return;
    }

    if (password.length < 6) {
      setError(t("errors.passwordTooShort"));
      return;
    }

    if (turnstileRequired && !turnstileToken) {
      setError(t("errors.turnstileRequired"));
      return;
    }

    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        name,
        email,
        password,
        ...(mode === "invite" ? { inviteCode } : {}),
      };
      if (turnstileRequired && turnstileToken) {
        body.turnstileToken = turnstileToken;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data?.error || t("errors.registrationFailed");
        setError(message);
        if (turnstileRequired && typeof message === "string" && message.toLowerCase().includes("turnstile")) {
          setTurnstileToken(null);
          setTurnstileReset((prev) => prev + 1);
        }
        return;
      }

      const requiresEmailVerification = Boolean(data?.requiresEmailVerification);
      if (requiresEmailVerification) {
        const normalizedEmail = email.trim();
        setRegisteredEmail(normalizedEmail);
        setDone(true);
        setResendError("");
        setResendAvailableAt(Date.now() + 60_000);
        setResendCooldownSeconds(60);
        setResendTurnstileToken(null);
        setResendTurnstileReset((prev) => prev + 1);
        setPassword("");
        setConfirmPassword("");
        setTurnstileToken(null);
        setTurnstileReset((prev) => prev + 1);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendError("");
    if (!registeredEmail.trim()) return;
    if (!canResend) return;

    if (turnstileRequired && !resendTurnstileToken) {
      setResendError(t("errors.turnstileRequired"));
      return;
    }

    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registeredEmail,
          turnstileToken: turnstileRequired ? resendTurnstileToken : undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        const message = data?.error || t("registerPage.verifyEmail.resendFailed");
        setResendError(message);
        if (turnstileRequired && message.toLowerCase().includes("turnstile")) {
          setResendTurnstileToken(null);
          setResendTurnstileReset((prev) => prev + 1);
        }
        return;
      }

      setResendAvailableAt(Date.now() + 60_000);
      setResendCooldownSeconds(60);
      setResendTurnstileToken(null);
      setResendTurnstileReset((prev) => prev + 1);
    } catch {
      setResendError(t("registerPage.verifyEmail.resendFailed"));
    } finally {
      setResendLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    if (!githubRegistrationEnabled) return;
    setError("");
    await signIn("github", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-md relative z-10 border-border/50 shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {done ? <MailCheck className="w-6 h-6 text-primary" /> : <User className="w-6 h-6 text-primary" />}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight">
            {done ? t("registerPage.verifyEmail.title") : t("createAccount")}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {done
              ? t("registerPage.verifyEmail.description", { email: registeredEmail })
              : mode === "invite"
              ? t("registerPage.descriptionInvite")
              : t("registerPage.description")}
          </CardDescription>
        </CardHeader>
        {done ? (
          <>
            <CardContent className="space-y-4">
              {resendError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                  {resendError}
                </div>
              )}

              <div className="p-3 text-sm text-green-700 bg-green-500/10 rounded-lg border border-green-500/20">
                {t("registerPage.verifyEmail.sent")}
              </div>

              {turnstileRequired && (
                <div className="space-y-2">
                  <TurnstileWidget
                    siteKey={turnstile.siteKey as string}
                    onToken={handleResendTurnstileToken}
                    resetKey={resendTurnstileReset}
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
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full h-11 font-medium"
                onClick={handleResend}
                disabled={resendLoading || !canResend}
              >
                {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {resendCooldownSeconds > 0
                  ? t("registerPage.verifyEmail.resendIn", { seconds: resendCooldownSeconds })
                  : t("registerPage.verifyEmail.resend")}
              </Button>
              <Button asChild variant="outline" className="w-full h-11 font-medium">
                <Link href="/login">{t("verifyEmailPage.goToLogin")}</Link>
              </Button>
            </CardFooter>
          </>
        ) : !emailRegistrationEnabled ? (
          <>
            <CardContent className="space-y-4">
              {githubRegistrationEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 font-medium"
                  onClick={handleGitHubSignIn}
                  disabled={loading}
                >
                  <Github className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("oauth.continueWithGithub")}
                </Button>
              )}
              <p className="text-sm text-center text-muted-foreground">
                {t("registerPage.emailRegistrationDisabled")}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button asChild variant="outline" className="w-full h-11 font-medium">
                <Link href="/login">{t("login")}</Link>
              </Button>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}
              {githubRegistrationEnabled && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 font-medium"
                    onClick={handleGitHubSignIn}
                    disabled={loading}
                  >
                    <Github className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("oauth.continueWithGithub")}
                  </Button>
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground">{t("oauth.or")}</span>
                    <Separator className="flex-1" />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder={t("placeholders.name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("placeholders.email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {mode === "invite" && (
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">{t("inviteCode")}</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="inviteCode"
                      type="text"
                      placeholder={t("placeholders.inviteCode")}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("placeholders.newPassword")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t("placeholders.confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    required
                    disabled={loading}
                  />
                </div>
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
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("createAccount")}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                {t("registerPage.alreadyHaveAccount")}{" "}
                <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  {t("login")}
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
