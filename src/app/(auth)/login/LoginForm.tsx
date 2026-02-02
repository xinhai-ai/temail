"use client";

import { useCallback, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Github, Globe, KeyRound, Loader2, Lock, Mail } from "lucide-react";

type TurnstileConfig = {
  enabled: boolean;
  bypass: boolean;
  siteKey: string | null;
  misconfigured: boolean;
};

export default function LoginForm({
  showRegisterLink = true,
  turnstile,
  githubEnabled = false,
  linuxdoEnabled = false,
  passkeyEnabled = false,
  passwordResetEnabled = false,
}: {
  showRegisterLink?: boolean;
  turnstile: TurnstileConfig;
  githubEnabled?: boolean;
  linuxdoEnabled?: boolean;
  passkeyEnabled?: boolean;
  passwordResetEnabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"primary" | "otp">("primary");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  const turnstileRequired = Boolean(turnstile.enabled && turnstile.siteKey);
  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const completeLogin = async (loginToken: string) => {
    const result = await signIn("credentials", { loginToken, redirect: false });
    if (result?.error) {
      setError(t("errors.signInFailed"));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handlePasskeySignIn = async () => {
    setError("");
    if (!passkeyEnabled) return;
    if (step !== "primary") return;

    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      setError(t("errors.passkeyNotSupported"));
      return;
    }

    setLoading(true);
    try {
      const beginRes = await fetch("/api/auth/passkey/begin", { method: "POST" });
      const beginData = (await beginRes.json().catch(() => null)) as
        | { options?: unknown; challengeId?: string; error?: string }
        | null;
      if (!beginRes.ok) {
        setError(beginData?.error || t("errors.passkeySignInFailed"));
        return;
      }

      const options = beginData?.options;
      const challengeId = beginData?.challengeId;
      if (!options || !challengeId) {
        setError(t("errors.passkeySignInFailed"));
        return;
      }

      const response = await startAuthentication(options as PublicKeyCredentialRequestOptionsJSON);

      const finishRes = await fetch("/api/auth/passkey/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, response }),
      });
      const finishData = (await finishRes.json().catch(() => null)) as
        | { loginToken?: string; requiresOtp?: boolean; mfaToken?: string; error?: string }
        | null;
      if (!finishRes.ok) {
        setError(finishData?.error || t("errors.passkeySignInFailed"));
        return;
      }

      if (finishData?.requiresOtp) {
        if (!finishData.mfaToken) {
          setError(t("errors.passkeySignInFailed"));
          return;
        }
        setMfaToken(finishData.mfaToken);
        setOtpCode("");
        setPassword("");
        setStep("otp");
        return;
      }

      const loginToken = finishData?.loginToken;
      if (!loginToken) {
        setError(t("errors.passkeySignInFailed"));
        return;
      }

      await completeLogin(loginToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("cancel")) {
        return;
      }
      setError(t("errors.passkeySignInFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    if (!githubEnabled) return;
    if (step !== "primary") return;
    setError("");
    await signIn("github", { callbackUrl: "/dashboard" });
  };

  const handleLinuxDoSignIn = async () => {
    if (!linuxdoEnabled) return;
    if (step !== "primary") return;
    setError("");
    await signIn("linuxdo", { callbackUrl: "/dashboard" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (step === "primary" && turnstileRequired && !turnstileToken) {
      setError(t("errors.turnstileRequired"));
      return;
    }

    setLoading(true);

    try {
      if (step === "primary") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            turnstileToken: turnstileRequired ? turnstileToken : undefined,
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | { loginToken?: string; requiresOtp?: boolean; mfaToken?: string; error?: string }
          | null;
        if (!res.ok) {
          const message = data?.error || t("errors.signInFailed");
          setError(message);
          if (turnstileRequired && message.toLowerCase().includes("turnstile")) {
            setTurnstileToken(null);
            setTurnstileReset((prev) => prev + 1);
          }
          return;
        }

        if (data?.requiresOtp) {
          if (!data.mfaToken) {
            setError(t("errors.signInFailed"));
            return;
          }
          setMfaToken(data.mfaToken);
          setOtpCode("");
          setPassword("");
          setStep("otp");
          return;
        }

        const loginToken = data?.loginToken;
        if (!loginToken) {
          setError(t("errors.signInFailed"));
          return;
        }

        await completeLogin(loginToken);
        return;
      }

      const currentMfaToken = mfaToken;
      if (!currentMfaToken) {
        setError(t("errors.signInFailed"));
        setStep("primary");
        return;
      }
      if (!otpCode.trim()) {
        setError(t("errors.enterCode"));
        return;
      }

      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken: currentMfaToken, code: otpCode }),
      });

      const data = (await res.json().catch(() => null)) as { loginToken?: string; error?: string } | null;
      if (!res.ok) {
        setError(data?.error || t("errors.invalidCode"));
        return;
      }

      const loginToken = data?.loginToken;
      if (!loginToken) {
        setError(t("errors.signInFailed"));
        return;
      }

      await completeLogin(loginToken);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* 装饰背景 */}
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
            {t("welcomeBack")}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {t("loginPage.description")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}
            {step === "primary" && (githubEnabled || linuxdoEnabled) && (
              <>
                {linuxdoEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 font-medium"
                    onClick={handleLinuxDoSignIn}
                    disabled={loading}
                  >
                    <Globe className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("oauth.continueWithLinuxDO")}
                  </Button>
                )}
                {githubEnabled && (
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
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">{t("oauth.or")}</span>
                  <Separator className="flex-1" />
                </div>
              </>
            )}
            {step === "primary" && passkeyEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-medium"
                onClick={handlePasskeySignIn}
                disabled={loading}
              >
                <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("usePasskey")}
              </Button>
            )}
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
                  required={step === "primary"}
                  disabled={step !== "primary" || loading}
                />
              </div>
            </div>
            {step === "primary" ? (
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("placeholders.password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    required
                    disabled={loading}
                  />
                </div>
                {passwordResetEnabled && (
                  <div className="flex justify-end">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      {t("loginPage.forgotPassword")}
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="otp">{t("verificationCode")}</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  placeholder={t("placeholders.otpCode")}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  autoFocus
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {t("loginPage.otpHelp")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("primary");
                    setMfaToken(null);
                    setOtpCode("");
                  }}
                  disabled={loading}
                >
                  {t("back")}
                </Button>
              </div>
            )}

            {step === "primary" && turnstileRequired && (
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
            {step === "primary" && !turnstileRequired && turnstile.bypass && (
              <p className="text-[11px] text-muted-foreground">
                {t("turnstile.bypassEnabled")}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === "primary" ? t("login") : t("verify")}
            </Button>
            {showRegisterLink ? (
              <p className="text-sm text-center text-muted-foreground">
                {t("loginPage.dontHaveAccount")}{" "}
                <Link
                  href="/register"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {t("register")}
                </Link>
              </p>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                {t("loginPage.registrationDisabled")}
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
