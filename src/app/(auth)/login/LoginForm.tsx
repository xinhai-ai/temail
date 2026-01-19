"use client";

import { useCallback, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
}: {
  showRegisterLink?: boolean;
  turnstile: TurnstileConfig;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  const turnstileRequired = Boolean(turnstile.enabled && turnstile.siteKey);
  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (turnstileRequired && !turnstileToken) {
      setError("Please complete the Turnstile challenge.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          turnstileToken: turnstileRequired ? turnstileToken : undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as { loginToken?: string; error?: string } | null;
      if (!res.ok) {
        const message = data?.error || "Sign in failed";
        setError(message);
        if (turnstileRequired && message.toLowerCase().includes("turnstile")) {
          setTurnstileToken(null);
          setTurnstileReset((prev) => prev + 1);
        }
        return;
      }

      const loginToken = data?.loginToken;
      if (!loginToken) {
        setError("Sign in failed");
        return;
      }

      const result = await signIn("credentials", { loginToken, redirect: false });
      if (result?.error) {
        setError("Sign in failed");
        return;
      }

      router.push("/dashboard");
      router.refresh();
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
                  required
                />
              </div>
            </div>
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
                  Protected by Cloudflare Turnstile.
                </p>
              </div>
            )}
            {!turnstileRequired && turnstile.bypass && (
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
              Sign In
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
