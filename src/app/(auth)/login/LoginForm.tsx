"use client";

import { useCallback, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Lock, Loader2 } from "lucide-react";

type TurnstileConfig = {
  enabled: boolean;
  bypass: boolean;
  siteKey: string | null;
  misconfigured: boolean;
};

export default function LoginForm({
  showRegisterLink = true,
  turnstile,
  passkeyEnabled = false,
}: {
  showRegisterLink?: boolean;
  turnstile: TurnstileConfig;
  passkeyEnabled?: boolean;
}) {
  const router = useRouter();
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
      setError("Sign in failed");
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
      setError("Passkeys are not supported in this browser.");
      return;
    }

    setLoading(true);
    try {
      const beginRes = await fetch("/api/auth/passkey/begin", { method: "POST" });
      const beginData = (await beginRes.json().catch(() => null)) as
        | { options?: unknown; challengeId?: string; error?: string }
        | null;
      if (!beginRes.ok) {
        setError(beginData?.error || "Passkey sign-in failed");
        return;
      }

      const options = beginData?.options;
      const challengeId = beginData?.challengeId;
      if (!options || !challengeId) {
        setError("Passkey sign-in failed");
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
        setError(finishData?.error || "Passkey sign-in failed");
        return;
      }

      if (finishData?.requiresOtp) {
        if (!finishData.mfaToken) {
          setError("Passkey sign-in failed");
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
        setError("Passkey sign-in failed");
        return;
      }

      await completeLogin(loginToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("cancel")) {
        return;
      }
      setError("Passkey sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (step === "primary" && turnstileRequired && !turnstileToken) {
      setError("Please complete the Turnstile challenge.");
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
          const message = data?.error || "Sign in failed";
          setError(message);
          if (turnstileRequired && message.toLowerCase().includes("turnstile")) {
            setTurnstileToken(null);
            setTurnstileReset((prev) => prev + 1);
          }
          return;
        }

        if (data?.requiresOtp) {
          if (!data.mfaToken) {
            setError("Sign in failed");
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
          setError("Sign in failed");
          return;
        }

        await completeLogin(loginToken);
        return;
      }

      const currentMfaToken = mfaToken;
      if (!currentMfaToken) {
        setError("Sign in failed");
        setStep("primary");
        return;
      }
      if (!otpCode.trim()) {
        setError("Please enter your code.");
        return;
      }

      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken: currentMfaToken, code: otpCode }),
      });

      const data = (await res.json().catch(() => null)) as { loginToken?: string; error?: string } | null;
      if (!res.ok) {
        setError(data?.error || "Invalid code");
        return;
      }

      const loginToken = data?.loginToken;
      if (!loginToken) {
        setError("Sign in failed");
        return;
      }

      await completeLogin(loginToken);
    } catch {
      setError("An error occurred. Please try again.");
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
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Sign in to your TEmail account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}
            {step === "primary" && passkeyEnabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-medium"
                onClick={handlePasskeySignIn}
                disabled={loading}
              >
                Use passkey
              </Button>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  autoFocus
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the code from your authenticator app or a backup code.
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
                  Back
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
                  Protected by Cloudflare Turnstile.
                </p>
              </div>
            )}
            {step === "primary" && !turnstileRequired && turnstile.bypass && (
              <p className="text-[11px] text-muted-foreground">
                Turnstile bypass is enabled in development.
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
              {step === "primary" ? "Sign In" : "Verify"}
            </Button>
            {showRegisterLink ? (
              <p className="text-sm text-center text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Sign up
                </Link>
              </p>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                Registration is disabled on this server.
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
